import { readFile, readdir, cp, mkdir, access, rm, rename } from "node:fs/promises";
import { join } from "node:path";
import { debug, info, warn } from "../utils/logger.js";
import { isEnoent, formatError } from "../utils/errors.js";
import { atomicWriteFile, exists } from "../utils/file-system.js";
import { readConfig } from "../utils/config.js";
import { readState, writeState, type BmalphState } from "../utils/state.js";
import type { TransitionResult, TransitionOptions, GeneratedFile } from "./types.js";
import { parseStoriesWithWarnings } from "./story-parsing.js";
import {
  generateFixPlan,
  parseFixPlan,
  mergeFixPlanProgress,
  detectOrphanedCompletedStories,
  detectRenumberedStories,
  buildCompletedTitleMap,
  normalizeTitle,
} from "./fix-plan.js";
import { detectTechStack, customizeAgentMd } from "./tech-stack.js";
import { findArtifactsDir } from "./artifacts.js";
import { runPreflight } from "./preflight.js";
import {
  extractProjectContext,
  generateProjectContextMd,
  generatePrompt,
  detectTruncation,
} from "./context.js";
import { generateSpecsChangelog, formatChangelog } from "./specs-changelog.js";
import { generateSpecsIndex, formatSpecsIndexMd } from "./specs-index.js";

export async function runTransition(
  projectDir: string,
  options?: TransitionOptions
): Promise<TransitionResult> {
  info("Locating BMAD artifacts...");
  const artifactsDir = await findArtifactsDir(projectDir);
  if (!artifactsDir) {
    throw new Error(
      "No BMAD artifacts found. Run BMAD planning phases first (at minimum: Create PRD, Create Architecture, Create Epics and Stories)."
    );
  }

  // Find and parse stories file
  const files = await readdir(artifactsDir);

  // Read artifact contents early for preflight validation and later use
  const artifactContents = new Map<string, string>();
  for (const file of files) {
    if (file.endsWith(".md")) {
      try {
        const content = await readFile(join(artifactsDir, file), "utf-8");
        artifactContents.set(file, content);
      } catch (err) {
        warn(`Could not read artifact ${file}: ${formatError(err)}`);
      }
    }
  }

  const storiesPattern = /^(epics[-_]?(and[-_]?)?)?stor(y|ies)([-_]\d+)?\.md$/i;
  const storiesFile = files.find((f) => storiesPattern.test(f) || /epic/i.test(f));

  if (!storiesFile) {
    debug(`Files in artifacts dir: ${files.join(", ")}`);
    throw new Error(
      `No epics/stories file found in ${artifactsDir}. Available files: ${files.join(", ")}. Run 'CE' (Create Epics and Stories) first.`
    );
  }
  debug(`Using stories file: ${storiesFile}`);

  const storiesContent = await readFile(join(artifactsDir, storiesFile), "utf-8");
  info("Parsing stories...");
  const { stories, warnings: parseWarnings } = parseStoriesWithWarnings(storiesContent);

  if (stories.length === 0) {
    throw new Error(
      "No stories parsed from the epics file. Ensure stories follow the format: ### Story N.M: Title"
    );
  }

  // Pre-flight validation
  info("Pre-flight validation...");
  const preflightResult = runPreflight(artifactContents, files, stories, parseWarnings);

  for (const issue of preflightResult.issues) {
    if (issue.severity === "error") {
      warn(`  ERROR  ${issue.id}: ${issue.message}`);
      if (issue.suggestion) warn(`         ${issue.suggestion}`);
    } else if (issue.severity === "warning") {
      warn(`  WARN   ${issue.id}: ${issue.message}`);
      if (issue.suggestion) warn(`         ${issue.suggestion}`);
    } else {
      info(`  INFO   ${issue.id}: ${issue.message}`);
    }
  }

  if (!preflightResult.pass) {
    if (options?.force) {
      warn("Pre-flight validation has errors but --force was used, continuing...");
    } else {
      const errors = preflightResult.issues.filter((i) => i.severity === "error");
      throw new Error(
        `Pre-flight validation failed: ${errors.map((e) => e.message).join("; ")}. Use --force to override.`
      );
    }
  }

  // Track generated files for summary output
  const generatedFiles: GeneratedFile[] = [];

  // Check existing fix_plan for completed items (smart merge)
  let completedIds = new Set<string>();
  let existingItems: { id: string; completed: boolean; title?: string }[] = [];
  const fixPlanPath = join(projectDir, ".ralph/@fix_plan.md");
  const fixPlanExisted = await exists(fixPlanPath);
  try {
    const existingFixPlan = await readFile(fixPlanPath, "utf-8");
    existingItems = parseFixPlan(existingFixPlan);
    completedIds = new Set(existingItems.filter((i) => i.completed).map((i) => i.id));
    debug(`Found ${completedIds.size} completed stories in existing fix_plan`);
  } catch (err) {
    if (isEnoent(err)) {
      debug("No existing fix_plan found, starting fresh");
    } else {
      warn(`Could not read existing fix_plan: ${formatError(err)}`);
    }
  }

  // Detect orphaned completed stories (Bug #2)
  const newStoryIds = new Set(stories.map((s) => s.id));
  const orphanWarnings = detectOrphanedCompletedStories(existingItems, newStoryIds);
  for (const w of orphanWarnings) {
    warn(w);
  }

  // Build title maps for title-based merge (Gap 3: renumbered story preservation)
  const completedTitles = buildCompletedTitleMap(existingItems);
  const newTitleMap = new Map(stories.map((s) => [s.id, s.title]));

  // Generate new fix_plan from current stories, preserving completion status
  info(`Generating fix plan for ${stories.length} stories...`);
  const newFixPlan = generateFixPlan(stories, storiesFile);
  const mergedFixPlan = mergeFixPlanProgress(
    newFixPlan,
    completedIds,
    newTitleMap,
    completedTitles
  );

  // Detect which stories were preserved via title match (for renumber warning suppression)
  const preservedIds = new Set<string>();
  for (const [id, title] of newTitleMap) {
    if (!completedIds.has(id) && completedTitles.has(normalizeTitle(title))) {
      preservedIds.add(id);
    }
  }

  // Detect renumbered stories (Bug #3), skipping auto-preserved ones
  const renumberWarnings = detectRenumberedStories(existingItems, stories, preservedIds);
  for (const w of renumberWarnings) {
    warn(w);
  }
  await atomicWriteFile(fixPlanPath, mergedFixPlan);
  generatedFiles.push({
    path: ".ralph/@fix_plan.md",
    action: fixPlanExisted ? "updated" : "created",
  });

  // Track whether progress was preserved for return value
  const fixPlanPreserved = completedIds.size > 0;

  // Generate changelog before overwriting specs/
  const specsDir = join(projectDir, ".ralph/specs");
  const bmadOutputDir = join(projectDir, "_bmad-output");
  try {
    await access(bmadOutputDir);
    const changes = await generateSpecsChangelog(specsDir, bmadOutputDir);
    if (changes.length > 0) {
      const changelog = formatChangelog(changes, new Date().toISOString());
      await atomicWriteFile(join(projectDir, ".ralph/SPECS_CHANGELOG.md"), changelog);
      generatedFiles.push({ path: ".ralph/SPECS_CHANGELOG.md", action: "updated" });
      debug(`Generated SPECS_CHANGELOG.md with ${changes.length} changes`);
    }
  } catch (err) {
    if (isEnoent(err)) {
      debug("Skipping SPECS_CHANGELOG.md (no _bmad-output directory)");
    } else {
      warn(`Could not generate SPECS_CHANGELOG.md: ${formatError(err)}`);
    }
  }

  // Copy entire _bmad-output/ tree to .ralph/specs/ (preserving structure)
  let bmadOutputExists = false;
  try {
    await access(bmadOutputDir);
    bmadOutputExists = true;
  } catch (err) {
    if (isEnoent(err)) {
      debug("_bmad-output not found, falling back to artifacts directory");
    } else {
      warn(`Error checking _bmad-output: ${formatError(err)}`);
    }
  }

  info("Copying specs to .ralph/specs/...");
  const specsTmpDir = join(projectDir, ".ralph/specs.new");
  if (bmadOutputExists) {
    // Atomic copy: write to temp dir, verify, then swap
    await rm(specsTmpDir, { recursive: true, force: true });
    await mkdir(specsTmpDir, { recursive: true });
    await cp(bmadOutputDir, specsTmpDir, { recursive: true, dereference: false });
    // Verify the copy succeeded before swapping
    await access(specsTmpDir);
    await rm(specsDir, { recursive: true, force: true });
    await rename(specsTmpDir, specsDir);
    generatedFiles.push({ path: ".ralph/specs/", action: "updated" });
    debug("Copied _bmad-output/ to .ralph/specs/ (atomic)");
  } else {
    // Fall back to just artifactsDir if _bmad-output root doesn't exist
    await rm(specsTmpDir, { recursive: true, force: true });
    await mkdir(specsTmpDir, { recursive: true });
    for (const file of files) {
      await cp(join(artifactsDir, file), join(specsTmpDir, file), {
        recursive: true,
        dereference: false,
      });
    }
    await access(specsTmpDir);
    await rm(specsDir, { recursive: true, force: true });
    await rename(specsTmpDir, specsDir);
    generatedFiles.push({ path: ".ralph/specs/", action: "updated" });
  }

  // Generate SPECS_INDEX.md for intelligent spec reading
  info("Generating SPECS_INDEX.md...");
  const specsIndexPath = join(projectDir, ".ralph/SPECS_INDEX.md");
  const specsIndexExisted = await exists(specsIndexPath);
  try {
    const specsIndex = await generateSpecsIndex(specsDir);
    if (specsIndex.totalFiles > 0) {
      await atomicWriteFile(specsIndexPath, formatSpecsIndexMd(specsIndex));
      generatedFiles.push({
        path: ".ralph/SPECS_INDEX.md",
        action: specsIndexExisted ? "updated" : "created",
      });
      debug(`Generated SPECS_INDEX.md with ${specsIndex.totalFiles} files`);
    }
  } catch (err) {
    warn(`Could not generate SPECS_INDEX.md: ${formatError(err)}`);
  }

  // Generate PROJECT_CONTEXT.md from planning artifacts
  let projectName = "project";
  try {
    const config = await readConfig(projectDir);
    if (config?.name) {
      projectName = config.name;
    }
  } catch (err) {
    debug(`Could not read config for project name: ${formatError(err)}`);
  }

  // Extract project context for both PROJECT_CONTEXT.md and PROMPT.md
  info("Generating PROJECT_CONTEXT.md...");
  const projectContextPath = join(projectDir, ".ralph/PROJECT_CONTEXT.md");
  const projectContextExisted = await exists(projectContextPath);
  let projectContext = null;
  let truncationWarnings: string[] = [];
  if (artifactContents.size > 0) {
    const { context, truncated } = extractProjectContext(artifactContents);
    projectContext = context;
    truncationWarnings = detectTruncation(truncated);
    const contextMd = generateProjectContextMd(projectContext, projectName);
    await atomicWriteFile(projectContextPath, contextMd);
    generatedFiles.push({
      path: ".ralph/PROJECT_CONTEXT.md",
      action: projectContextExisted ? "updated" : "created",
    });
    debug("Generated PROJECT_CONTEXT.md");
  }

  // Generate PROMPT.md with embedded context
  info("Generating PROMPT.md...");
  // Try to preserve rich PROMPT.md template if it has the placeholder
  let prompt: string;
  let promptExisted = false;
  try {
    const existingPrompt = await readFile(join(projectDir, ".ralph/PROMPT.md"), "utf-8");
    promptExisted = true;
    if (existingPrompt.includes("[YOUR PROJECT NAME]")) {
      prompt = existingPrompt.replace(/\[YOUR PROJECT NAME\]/g, projectName);
    } else {
      // Pass context to embed critical specs directly in PROMPT.md
      prompt = generatePrompt(projectName, projectContext ?? undefined);
    }
  } catch (err) {
    if (isEnoent(err)) {
      debug("No existing PROMPT.md found, generating from template");
    } else {
      warn(`Could not read existing PROMPT.md: ${formatError(err)}`);
    }
    prompt = generatePrompt(projectName, projectContext ?? undefined);
  }
  await atomicWriteFile(join(projectDir, ".ralph/PROMPT.md"), prompt);
  generatedFiles.push({ path: ".ralph/PROMPT.md", action: promptExisted ? "updated" : "created" });

  // Customize @AGENT.md based on detected tech stack from architecture
  const architectureFile = files.find((f) => /architect/i.test(f));
  if (architectureFile) {
    const archContent = artifactContents.get(architectureFile);
    if (archContent) {
      try {
        const stack = detectTechStack(archContent);
        if (stack) {
          const agentPath = join(projectDir, ".ralph/@AGENT.md");
          const agentTemplate = await readFile(agentPath, "utf-8");
          const customized = customizeAgentMd(agentTemplate, stack);
          await atomicWriteFile(agentPath, customized);
          generatedFiles.push({ path: ".ralph/@AGENT.md", action: "updated" });
          debug("Customized @AGENT.md with detected tech stack");
        }
      } catch (err) {
        warn(`Could not customize @AGENT.md: ${formatError(err)}`);
      }
    }
  }

  // Collect warnings from all sources
  const preflightWarnings = preflightResult.issues
    .filter((i) => i.severity === "warning" || (i.severity === "error" && options?.force))
    .map((i) => i.message);

  // Keep parse warnings not already covered by preflight (e.g., malformed IDs)
  const nonPreflightParseWarnings = parseWarnings.filter(
    (w) =>
      !/has no acceptance criteria/i.test(w) &&
      !/has no description/i.test(w) &&
      !/not under an epic/i.test(w)
  );

  const warnings = [
    ...preflightWarnings,
    ...nonPreflightParseWarnings,
    ...orphanWarnings,
    ...renumberWarnings,
    ...truncationWarnings,
  ];

  // Update phase state to 4 (Implementation) - Bug #1
  const now = new Date().toISOString();
  const currentState = await readState(projectDir);
  const newState: BmalphState = {
    currentPhase: 4,
    status: "implementing",
    startedAt: currentState?.startedAt ?? now,
    lastUpdated: now,
  };
  await writeState(projectDir, newState);
  info("Transition complete: phase 4 (implementing)");

  return {
    storiesCount: stories.length,
    warnings,
    fixPlanPreserved,
    preflightIssues: preflightResult.issues,
    generatedFiles,
  };
}
