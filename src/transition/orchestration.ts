import { readFile, rm, rename } from "node:fs/promises";
import { join, relative } from "node:path";
import { debug, info, warn } from "../utils/logger.js";
import { isEnoent, formatError } from "../utils/errors.js";
import { atomicWriteFile, exists, getFilesRecursive } from "../utils/file-system.js";
import { readConfig } from "../utils/config.js";
import { readState, writeState, type BmalphState } from "../utils/state.js";
import type { Story, TransitionResult, TransitionOptions, GeneratedFile } from "./types.js";
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
import { findArtifactsDir, resolvePlanningSpecsSubpath } from "./artifacts.js";
import { runPreflight, PreflightValidationError } from "./preflight.js";
import { collectTransitionArtifacts, combineArtifactContents } from "./artifact-collection.js";
import {
  extractProjectContext,
  generateProjectContextMd,
  generatePrompt,
  detectTruncation,
} from "./context.js";
import { generateSpecsChangelog, formatChangelog } from "./specs-changelog.js";
import { generateSpecsIndex, formatSpecsIndexMd } from "./specs-index.js";
import { parseSprintStatus } from "./sprint-status.js";
import { prepareSpecsDirectory } from "./specs-sync.js";

function compareStoryIds(left: string, right: string): number {
  const [leftEpic = 0, leftStory = 0] = left.split(".").map((part) => Number(part));
  const [rightEpic = 0, rightStory = 0] = right.split(".").map((part) => Number(part));

  if (leftEpic !== rightEpic) {
    return leftEpic - rightEpic;
  }

  return leftStory - rightStory;
}

function ensureUniqueStoryIds(stories: Story[]): void {
  const sourceById = new Map<string, string>();

  for (const story of stories) {
    const existingSource = sourceById.get(story.id);
    if (existingSource) {
      throw new Error(
        `Duplicate story ID "${story.id}" found in ${existingSource} and ${story.sourceFile}`
      );
    }

    sourceById.set(story.id, story.sourceFile);
  }
}

interface ResolvedSprintStatusSource {
  displayPath: string;
  content: string | null;
  readError?: string;
}

async function resolveSprintStatusSource(
  projectDir: string,
  artifactsDir: string,
  collectedArtifacts: ReturnType<typeof collectTransitionArtifacts>,
  artifactContents: ReadonlyMap<string, string>
): Promise<ResolvedSprintStatusSource | null> {
  const canonicalCandidates = [
    "_bmad-output/implementation-artifacts/sprint-status.yaml",
    "_bmad-output/implementation_artifacts/sprint-status.yaml",
  ];

  for (const candidate of canonicalCandidates) {
    const candidatePath = join(projectDir, candidate);
    if (!(await exists(candidatePath))) {
      continue;
    }

    try {
      return {
        displayPath: candidate,
        content: await readFile(candidatePath, "utf-8"),
      };
    } catch (err) {
      return {
        displayPath: candidate,
        content: null,
        readError: formatError(err),
      };
    }
  }

  if (!collectedArtifacts.sprintStatusFile) {
    return null;
  }

  const artifactsRelativeDir = relative(projectDir, artifactsDir).replace(/\\/g, "/");

  return {
    displayPath: `${artifactsRelativeDir}/${collectedArtifacts.sprintStatusFile}`,
    content: artifactContents.get(collectedArtifacts.sprintStatusFile) ?? null,
  };
}

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

  const files = await getFilesRecursive(artifactsDir);
  const collectedArtifacts = collectTransitionArtifacts(files);

  // Read artifact contents early for preflight validation and later use
  const artifactContents = new Map<string, string>();
  for (const file of collectedArtifacts.files) {
    if (!/\.(?:md|ya?ml)$/i.test(file)) {
      continue;
    }

    try {
      const content = await readFile(join(artifactsDir, file), "utf-8");
      artifactContents.set(file, content);
    } catch (err) {
      warn(`Could not read artifact ${file}: ${formatError(err)}`);
    }
  }

  if (collectedArtifacts.storyFiles.length === 0) {
    debug(`Files in artifacts dir: ${collectedArtifacts.files.join(", ")}`);
    throw new Error(
      `No epics/stories file found in ${artifactsDir}. Available files: ${collectedArtifacts.files.join(", ")}. Run 'CE' (Create Epics and Stories) first.`
    );
  }
  debug(`Using stories files: ${collectedArtifacts.storyFiles.join(", ")}`);

  info("Parsing stories...");
  const stories: Story[] = [];
  const parseWarnings: string[] = [];
  for (const storyFile of collectedArtifacts.storyFiles) {
    const storiesContent = artifactContents.get(storyFile);
    if (!storiesContent) {
      warn(`Could not read stories artifact ${storyFile}`);
      continue;
    }

    const parsedStories = parseStoriesWithWarnings(storiesContent, storyFile);
    stories.push(...parsedStories.stories);
    parseWarnings.push(...parsedStories.warnings);
  }

  ensureUniqueStoryIds(stories);
  stories.sort(
    (left, right) =>
      compareStoryIds(left.id, right.id) ||
      left.sourceFile.localeCompare(right.sourceFile) ||
      left.title.localeCompare(right.title)
  );

  if (stories.length === 0) {
    throw new Error(
      "No stories parsed from the epics files. Ensure stories follow the format: ### Story N.M: Title"
    );
  }

  // Pre-flight validation
  info("Pre-flight validation...");
  const preflightResult = runPreflight(
    artifactContents,
    collectedArtifacts.files,
    stories,
    parseWarnings
  );

  if (!preflightResult.pass) {
    if (options?.force) {
      warn("Pre-flight validation has errors but --force was used, continuing...");
    } else {
      throw new PreflightValidationError(preflightResult.issues);
    }
  }

  // Track generated files for summary output
  const generatedFiles: GeneratedFile[] = [];

  // Check existing fix_plan for completed items (smart merge)
  let completedIds = new Set<string>();
  let existingItems: { id: string; completed: boolean; title?: string }[] = [];
  let orphanWarnings: string[] = [];
  let renumberWarnings: string[] = [];
  const completionWarnings: string[] = [];
  let useTitleBasedMerge = true;
  let fixPlanPreserved = false;
  const fixPlanPath = join(projectDir, ".ralph/@fix_plan.md");
  const fixPlanExisted = await exists(fixPlanPath);
  try {
    const existingFixPlan = await readFile(fixPlanPath, "utf-8");
    existingItems = parseFixPlan(existingFixPlan);
    debug(
      `Found ${existingItems.filter((item) => item.completed).length} completed stories in existing fix_plan`
    );
  } catch (err) {
    if (isEnoent(err)) {
      debug("No existing fix_plan found, starting fresh");
    } else {
      warn(`Could not read existing fix_plan: ${formatError(err)}`);
    }
  }

  const sprintStatusSource = await resolveSprintStatusSource(
    projectDir,
    artifactsDir,
    collectedArtifacts,
    artifactContents
  );
  if (sprintStatusSource) {
    useTitleBasedMerge = false;
    if (sprintStatusSource.readError) {
      completionWarnings.push(
        `Sprint status file "${sprintStatusSource.displayPath}" could not be read: ${sprintStatusSource.readError}. All stories were left unchecked.`
      );
    } else if (!sprintStatusSource.content) {
      completionWarnings.push(
        `Sprint status file "${sprintStatusSource.displayPath}" could not be read. All stories were left unchecked.`
      );
    } else {
      const sprintStatus = parseSprintStatus(sprintStatusSource.content);
      completionWarnings.push(...sprintStatus.warnings);

      if (sprintStatus.valid) {
        completedIds = new Set(
          stories
            .filter((story) => sprintStatus.storyStatusById.get(story.id) === "done")
            .map((story) => story.id)
        );
        fixPlanPreserved = completedIds.size > 0;

        for (const story of stories) {
          if (!sprintStatus.storyStatusById.has(story.id)) {
            completionWarnings.push(
              `Sprint status is missing story ${story.id} (${story.title}); leaving it unchecked.`
            );
          }
        }
      }
    }
  } else {
    completedIds = new Set(existingItems.filter((item) => item.completed).map((item) => item.id));
    fixPlanPreserved = completedIds.size > 0;

    // Detect orphaned completed stories (Bug #2)
    const newStoryIds = new Set(stories.map((story) => story.id));
    orphanWarnings = detectOrphanedCompletedStories(existingItems, newStoryIds);

    // Build title maps for title-based merge (Gap 3: renumbered story preservation)
    const completedTitles = buildCompletedTitleMap(existingItems);
    const newTitleMap = new Map(stories.map((story) => [story.id, story.title]));

    // Detect which stories were preserved via title match (for renumber warning suppression)
    const preservedIds = new Set<string>();
    for (const [id, title] of newTitleMap) {
      if (!completedIds.has(id) && completedTitles.has(normalizeTitle(title))) {
        preservedIds.add(id);
      }
    }

    // Detect renumbered stories (Bug #3), skipping auto-preserved ones
    renumberWarnings = detectRenumberedStories(existingItems, stories, preservedIds);
  }

  const completedTitles = buildCompletedTitleMap(existingItems);
  const newTitleMap = new Map(stories.map((story) => [story.id, story.title]));

  // Generate new fix_plan from current stories, preserving completion status
  info(`Generating fix plan for ${stories.length} stories...`);
  const planningSpecsSubpath = resolvePlanningSpecsSubpath(projectDir, artifactsDir);
  const newFixPlan = generateFixPlan(stories, undefined, planningSpecsSubpath);
  const mergedFixPlan = mergeFixPlanProgress(
    newFixPlan,
    completedIds,
    useTitleBasedMerge ? newTitleMap : undefined,
    useTitleBasedMerge ? completedTitles : undefined
  );
  await atomicWriteFile(fixPlanPath, mergedFixPlan);
  generatedFiles.push({
    path: ".ralph/@fix_plan.md",
    action: fixPlanExisted ? "updated" : "created",
  });

  const specsDir = join(projectDir, ".ralph/specs");
  const specsTmpDir = join(projectDir, ".ralph/specs.new");
  info("Preparing specs tree...");
  await prepareSpecsDirectory(projectDir, artifactsDir, collectedArtifacts.files, specsTmpDir);

  try {
    const changes = await generateSpecsChangelog(specsDir, specsTmpDir);
    if (changes.length > 0) {
      const changelog = formatChangelog(changes, new Date().toISOString());
      await atomicWriteFile(join(projectDir, ".ralph/SPECS_CHANGELOG.md"), changelog);
      generatedFiles.push({ path: ".ralph/SPECS_CHANGELOG.md", action: "updated" });
      debug(`Generated SPECS_CHANGELOG.md with ${changes.length} changes`);
    }
  } catch (err) {
    warn(`Could not generate SPECS_CHANGELOG.md: ${formatError(err)}`);
  }

  info("Copying specs to .ralph/specs/...");
  await rm(specsDir, { recursive: true, force: true });
  await rename(specsTmpDir, specsDir);
  generatedFiles.push({ path: ".ralph/specs/", action: "updated" });

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
  const combinedArchitectureContent = combineArtifactContents(
    collectedArtifacts.architectureFiles,
    artifactContents
  );
  if (combinedArchitectureContent) {
    try {
      const stack = detectTechStack(combinedArchitectureContent);
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
    ...completionWarnings,
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
