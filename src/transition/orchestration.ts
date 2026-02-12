import { readFile, writeFile, readdir, cp, mkdir, access, rm } from "fs/promises";
import { join } from "path";
import { debug } from "../utils/logger.js";
import { readConfig } from "../utils/config.js";
import { readState, writeState, type BmalphState } from "../utils/state.js";
import type { TransitionResult } from "./types.js";
import { parseStoriesWithWarnings } from "./story-parsing.js";
import {
  generateFixPlan,
  parseFixPlan,
  mergeFixPlanProgress,
  detectOrphanedCompletedStories,
  detectRenumberedStories,
} from "./fix-plan.js";
import { detectTechStack, customizeAgentMd } from "./tech-stack.js";
import { findArtifactsDir, validateArtifacts } from "./artifacts.js";
import {
  extractProjectContext,
  generateProjectContextMd,
  generatePrompt,
  detectTruncation,
} from "./context.js";
import { generateSpecsChangelog, formatChangelog } from "./specs-changelog.js";
import { generateSpecsIndex, formatSpecsIndexMd } from "./specs-index.js";

export async function runTransition(projectDir: string): Promise<TransitionResult> {
  const artifactsDir = await findArtifactsDir(projectDir);
  if (!artifactsDir) {
    throw new Error(
      "No BMAD artifacts found. Run BMAD planning phases first (at minimum: Create PRD, Create Architecture, Create Epics and Stories)."
    );
  }

  // Find and parse stories file
  const files = await readdir(artifactsDir);
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
  const { stories, warnings: parseWarnings } = parseStoriesWithWarnings(storiesContent);

  if (stories.length === 0) {
    throw new Error(
      "No stories parsed from the epics file. Ensure stories follow the format: ### Story N.M: Title"
    );
  }

  // Check existing fix_plan for completed items (smart merge)
  let completedIds = new Set<string>();
  let existingItems: { id: string; completed: boolean; title?: string }[] = [];
  const fixPlanPath = join(projectDir, ".ralph/@fix_plan.md");
  try {
    const existingFixPlan = await readFile(fixPlanPath, "utf-8");
    existingItems = parseFixPlan(existingFixPlan);
    completedIds = new Set(existingItems.filter((i) => i.completed).map((i) => i.id));
    debug(`Found ${completedIds.size} completed stories in existing fix_plan`);
  } catch {
    // No existing file, start fresh
    debug("No existing fix_plan found, starting fresh");
  }

  // Detect orphaned completed stories (Bug #2)
  const newStoryIds = new Set(stories.map((s) => s.id));
  const orphanWarnings = detectOrphanedCompletedStories(existingItems, newStoryIds);

  // Detect renumbered stories (Bug #3)
  const renumberWarnings = detectRenumberedStories(existingItems, stories);

  // Generate new fix_plan from current stories, preserving completion status
  const newFixPlan = generateFixPlan(stories);
  const mergedFixPlan = mergeFixPlanProgress(newFixPlan, completedIds);
  await writeFile(fixPlanPath, mergedFixPlan);

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
      await writeFile(join(projectDir, ".ralph/SPECS_CHANGELOG.md"), changelog);
      debug(`Generated SPECS_CHANGELOG.md with ${changes.length} changes`);
    }
  } catch {
    // No bmad-output directory yet, skip changelog
    debug("Skipping SPECS_CHANGELOG.md (no _bmad-output directory)");
  }

  // Copy entire _bmad-output/ tree to .ralph/specs/ (preserving structure)
  let bmadOutputExists = false;
  try {
    await access(bmadOutputDir);
    bmadOutputExists = true;
  } catch {
    // _bmad-output doesn't exist, will fall back to artifactsDir
    debug("_bmad-output not found, falling back to artifacts directory");
  }

  if (bmadOutputExists) {
    // Clean stale files from specs before copying fresh artifacts
    await rm(join(projectDir, ".ralph/specs"), { recursive: true, force: true });
    await mkdir(join(projectDir, ".ralph/specs"), { recursive: true });
    await cp(bmadOutputDir, join(projectDir, ".ralph/specs"), { recursive: true });
    debug("Copied _bmad-output/ to .ralph/specs/");
  } else {
    // Fall back to just artifactsDir if _bmad-output root doesn't exist
    await mkdir(join(projectDir, ".ralph/specs"), { recursive: true });
    for (const file of files) {
      await cp(join(artifactsDir, file), join(projectDir, ".ralph/specs", file), {
        recursive: true,
      });
    }
  }

  // Generate SPECS_INDEX.md for intelligent spec reading
  try {
    const specsIndex = await generateSpecsIndex(specsDir);
    if (specsIndex.totalFiles > 0) {
      await writeFile(join(projectDir, ".ralph/SPECS_INDEX.md"), formatSpecsIndexMd(specsIndex));
      debug(`Generated SPECS_INDEX.md with ${specsIndex.totalFiles} files`);
    }
  } catch {
    debug("Could not generate SPECS_INDEX.md");
  }

  // Generate PROJECT_CONTEXT.md from planning artifacts
  const artifactContents = new Map<string, string>();
  for (const file of files) {
    if (file.endsWith(".md")) {
      try {
        const content = await readFile(join(artifactsDir, file), "utf-8");
        artifactContents.set(file, content);
      } catch {
        debug(`Could not read artifact: ${file}`);
      }
    }
  }

  let projectName = "project";
  try {
    const config = await readConfig(projectDir);
    if (config?.name) {
      projectName = config.name;
    }
  } catch {
    // Invalid config, use default project name
    debug("Could not read config for project name, using default");
  }

  // Extract project context for both PROJECT_CONTEXT.md and PROMPT.md
  let projectContext = null;
  let truncationWarnings: string[] = [];
  if (artifactContents.size > 0) {
    const { context, truncated } = extractProjectContext(artifactContents);
    projectContext = context;
    truncationWarnings = detectTruncation(truncated);
    const contextMd = generateProjectContextMd(projectContext, projectName);
    await writeFile(join(projectDir, ".ralph/PROJECT_CONTEXT.md"), contextMd);
    debug("Generated PROJECT_CONTEXT.md");
  }

  // Generate PROMPT.md with embedded context
  // Try to preserve rich PROMPT.md template if it has the placeholder
  let prompt: string;
  try {
    const existingPrompt = await readFile(join(projectDir, ".ralph/PROMPT.md"), "utf-8");
    if (existingPrompt.includes("[YOUR PROJECT NAME]")) {
      prompt = existingPrompt.replace(/\[YOUR PROJECT NAME\]/g, projectName);
    } else {
      // Pass context to embed critical specs directly in PROMPT.md
      prompt = generatePrompt(projectName, projectContext ?? undefined);
    }
  } catch {
    // No existing PROMPT.md or read failed, generate new one
    debug("No existing PROMPT.md found, generating from template");
    prompt = generatePrompt(projectName, projectContext ?? undefined);
  }
  await writeFile(join(projectDir, ".ralph/PROMPT.md"), prompt);

  // Customize @AGENT.md based on detected tech stack from architecture
  const architectureFile = files.find((f) => /architect/i.test(f));
  if (architectureFile) {
    try {
      const archContent = await readFile(join(artifactsDir, architectureFile), "utf-8");
      const stack = detectTechStack(archContent);
      if (stack) {
        const agentPath = join(projectDir, ".ralph/@AGENT.md");
        const agentTemplate = await readFile(agentPath, "utf-8");
        const customized = customizeAgentMd(agentTemplate, stack);
        await writeFile(agentPath, customized);
        debug("Customized @AGENT.md with detected tech stack");
      }
    } catch {
      debug("Could not customize @AGENT.md");
    }
  }

  // Validate artifacts and collect warnings
  const artifactWarnings = await validateArtifacts(files, artifactsDir);
  const warnings = [
    ...parseWarnings,
    ...artifactWarnings,
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
  debug("Updated phase state to 4 (implementing)");

  return { storiesCount: stories.length, warnings, fixPlanPreserved };
}
