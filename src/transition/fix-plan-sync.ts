import { readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { debug, info, warn } from "../utils/logger.js";
import { isEnoent, formatError } from "../utils/errors.js";
import { atomicWriteFile, exists } from "../utils/file-system.js";
import {
  generateFixPlan,
  parseFixPlan,
  mergeFixPlanProgress,
  collapseCompletedStories,
  detectOrphanedCompletedStories,
  detectRenumberedStories,
  buildCompletedTitleMap,
  normalizeTitle,
} from "./fix-plan.js";
import { parseSprintStatus } from "./sprint-status.js";
import type { GeneratedFile } from "./types.js";
import type { LoadedTransitionInputs } from "./artifact-loading.js";

interface ResolvedSprintStatusSource {
  displayPath: string;
  content: string | null;
  readError?: string;
}

export interface FixPlanSyncResult {
  warnings: string[];
  fixPlanPreserved: boolean;
  generatedFile: GeneratedFile;
}

export async function syncFixPlan(
  projectDir: string,
  inputs: LoadedTransitionInputs
): Promise<FixPlanSyncResult> {
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

  const completedTitles = buildCompletedTitleMap(existingItems);
  const newTitleMap = new Map(inputs.stories.map((story) => [story.id, story.title]));

  const sprintStatusSource = await resolveSprintStatusSource(projectDir, inputs);
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
          inputs.stories
            .filter((story) => sprintStatus.storyStatusById.get(story.id) === "done")
            .map((story) => story.id)
        );
        fixPlanPreserved = completedIds.size > 0;

        for (const story of inputs.stories) {
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

    const newStoryIds = new Set(inputs.stories.map((story) => story.id));
    orphanWarnings = detectOrphanedCompletedStories(existingItems, newStoryIds);

    const preservedIds = new Set<string>();

    for (const [id, title] of newTitleMap) {
      if (!completedIds.has(id) && completedTitles.has(normalizeTitle(title))) {
        preservedIds.add(id);
      }
    }

    renumberWarnings = detectRenumberedStories(existingItems, inputs.stories, preservedIds);
  }

  info(`Generating fix plan for ${inputs.stories.length} stories...`);
  const newFixPlan = generateFixPlan(inputs.stories, undefined, inputs.planningSpecsSubpath);
  const mergedFixPlan = mergeFixPlanProgress(
    newFixPlan,
    completedIds,
    useTitleBasedMerge ? newTitleMap : undefined,
    useTitleBasedMerge ? completedTitles : undefined
  );
  const compactedFixPlan = collapseCompletedStories(mergedFixPlan);
  await atomicWriteFile(fixPlanPath, compactedFixPlan);

  return {
    warnings: [...completionWarnings, ...orphanWarnings, ...renumberWarnings],
    fixPlanPreserved,
    generatedFile: {
      path: ".ralph/@fix_plan.md",
      action: fixPlanExisted ? "updated" : "created",
    },
  };
}

async function resolveSprintStatusSource(
  projectDir: string,
  inputs: LoadedTransitionInputs
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

  if (!inputs.collectedArtifacts.sprintStatusFile) {
    return null;
  }

  const artifactsRelativeDir = relative(projectDir, inputs.artifactsDir).replace(/\\/g, "/");

  return {
    displayPath: `${artifactsRelativeDir}/${inputs.collectedArtifacts.sprintStatusFile}`,
    content: inputs.artifactContents.get(inputs.collectedArtifacts.sprintStatusFile) ?? null,
  };
}
