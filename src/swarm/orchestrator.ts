import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { RALPH_DIR, RALPH_FIX_PLAN_FILE, SWARM_MAX_WORKERS } from "../utils/constants.js";
import { parseFixPlanWithEpics } from "./fix-plan-parser.js";
import { partitionByEpic, type PartitionResult } from "./partitioner.js";
import type { FixPlanEpicGroup } from "./types.js";

export interface SwarmPrerequisites {
  epicGroups: FixPlanEpicGroup[];
  partitions: FixPlanEpicGroup[][];
  workerCount: number;
  warnings: string[];
}

/**
 * Resolves the current branch name. Throws on detached HEAD.
 */
export async function resolveStartBranch(projectDir: string): Promise<string> {
  try {
    const output = execFileSync("git", ["symbolic-ref", "--short", "HEAD"], {
      cwd: projectDir,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return output.trim();
  } catch {
    throw new Error("Swarm does not support detached HEAD. Check out a branch first.");
  }
}

/**
 * Validates all prerequisites for swarm mode:
 * - Clean working tree
 * - Fix plan exists with >= 2 incomplete epics
 * - Worker count within limits
 */
export async function validateSwarmPrerequisites(
  projectDir: string,
  requestedWorkers: number
): Promise<SwarmPrerequisites> {
  // 1. Clean working tree
  assertCleanWorkingTree(projectDir);

  // 2. Read and parse fix plan
  const fixPlanPath = join(projectDir, RALPH_DIR, RALPH_FIX_PLAN_FILE);
  let fixPlanContent: string;
  try {
    fixPlanContent = await readFile(fixPlanPath, "utf-8");
  } catch {
    throw new Error(
      `No fix plan found at ${RALPH_DIR}/${RALPH_FIX_PLAN_FILE}. Run: bmalph implement`
    );
  }

  const epicGroups = parseFixPlanWithEpics(fixPlanContent);

  // 3. Partition and validate
  const capped = Math.min(requestedWorkers, SWARM_MAX_WORKERS);
  const result: PartitionResult = partitionByEpic(epicGroups, capped);

  return {
    epicGroups,
    partitions: result.partitions,
    workerCount: result.adjustedWorkerCount,
    warnings: result.warnings,
  };
}

function assertCleanWorkingTree(projectDir: string): void {
  const output = execFileSync("git", ["status", "--porcelain"], {
    cwd: projectDir,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (output.trim().length > 0) {
    throw new Error("Swarm requires a clean working tree. Commit or stash your changes first.");
  }
}
