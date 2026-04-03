import { readFile } from "node:fs/promises";
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { atomicWriteFile } from "../utils/file-system.js";
import {
  parseFixPlan,
  mergeFixPlanProgress,
  collapseCompletedStories,
} from "../transition/fix-plan.js";
import { RALPH_DIR, RALPH_FIX_PLAN_FILE } from "../utils/constants.js";
import type { MergeResult, SwarmWorker } from "./types.js";

/**
 * Reads a worker's fix plan and returns the set of completed story IDs.
 */
export async function collectWorkerCompletions(worktreePath: string): Promise<Set<string>> {
  const fixPlanPath = join(worktreePath, RALPH_DIR, RALPH_FIX_PLAN_FILE);
  try {
    const content = await readFile(fixPlanPath, "utf-8");
    const items = parseFixPlan(content);
    return new Set(items.filter((item) => item.completed).map((item) => item.id));
  } catch {
    return new Set();
  }
}

/**
 * Merges worker branches back to the starting branch.
 *
 * Strategy: merge source code only, exclude .ralph/ entirely.
 * 1. Save original fix plan before any merges
 * 2. Merge workers sequentially (stop on source conflict)
 * 3. After each merge, restore .ralph/ from saved original
 * 4. Rebuild unified fix plan from collected completions
 */
export async function mergeWorkerBranches(
  projectDir: string,
  workers: SwarmWorker[],
  startBranch: string
): Promise<MergeResult[]> {
  if (workers.length === 0) return [];

  const results: MergeResult[] = [];

  // PRE-MERGE: Save original fix plan; completions collected AFTER merge from merged workers only
  const originalFixPlan = await readFixPlan(projectDir);

  // Ensure we're on the starting branch
  execFileSync("git", ["checkout", startBranch], { cwd: projectDir, stdio: "ignore" });

  // MERGE: Sequential, ordered by completion time
  const sorted = [...workers].sort(
    (a, b) => (a.completedAt?.getTime() ?? 0) - (b.completedAt?.getTime() ?? 0)
  );

  for (const worker of sorted) {
    const result = mergeWorkerBranch(projectDir, worker, originalFixPlan);
    results.push(result);
    if (result.status === "conflict") {
      break;
    }
  }

  // POST-MERGE: Collect completions ONLY from successfully merged workers
  const mergedWorkerIds = new Set(
    results.filter((r) => r.status === "merged").map((r) => r.workerId)
  );

  if (originalFixPlan && mergedWorkerIds.size > 0) {
    const mergedCompletedIds = new Set<string>();
    for (const worker of workers) {
      if (!mergedWorkerIds.has(worker.id)) continue;
      const ids = await collectWorkerCompletions(worker.worktreePath);
      for (const id of ids) mergedCompletedIds.add(id);
    }

    if (mergedCompletedIds.size > 0) {
      const merged = mergeFixPlanProgress(originalFixPlan, mergedCompletedIds);
      const compacted = collapseCompletedStories(merged);
      const fixPlanPath = join(projectDir, RALPH_DIR, RALPH_FIX_PLAN_FILE);
      await atomicWriteFile(fixPlanPath, compacted);
      execFileSync("git", ["add", fixPlanPath], { cwd: projectDir, stdio: "ignore" });
      tryCommit(projectDir, "swarm: update fix plan progress");
    }
  }

  return results;
}

function mergeWorkerBranch(
  projectDir: string,
  worker: SwarmWorker,
  originalFixPlan: string | null
): MergeResult {
  const epicNames = worker.assignedEpics.join(", ");
  const mergeMessage = `swarm: merge worker ${worker.id} (${epicNames})`;

  try {
    execFileSync("git", ["merge", "--no-ff", "-m", mergeMessage, worker.branchName], {
      cwd: projectDir,
      stdio: "ignore",
    });
  } catch {
    // Verify we're actually in a merge state before attempting conflict resolution
    if (!isInMergeState(projectDir)) {
      return { workerId: worker.id, status: "conflict", conflictFiles: [] };
    }
    const resolved = tryResolveRalphConflicts(projectDir);
    if (!resolved) {
      const conflictFiles = getConflictFiles(projectDir);
      execFileSync("git", ["merge", "--abort"], { cwd: projectDir, stdio: "ignore" });
      return { workerId: worker.id, status: "conflict", conflictFiles };
    }
  }

  // Restore original .ralph/ state (discard worker's ephemeral state)
  restoreRalph(projectDir, originalFixPlan);

  return { workerId: worker.id, status: "merged" };
}

/**
 * Resolves merge conflicts if they are only in .ralph/ files.
 */
function tryResolveRalphConflicts(projectDir: string): boolean {
  const conflictFiles = getConflictFiles(projectDir);
  const nonRalphConflicts = conflictFiles.filter(
    (f) => !f.startsWith(".ralph/") && !f.startsWith(".ralph\\")
  );

  if (nonRalphConflicts.length > 0) {
    return false;
  }

  try {
    execFileSync("git", ["checkout", "HEAD", "--", ".ralph/"], {
      cwd: projectDir,
      stdio: "ignore",
    });
    execFileSync("git", ["add", ".ralph/"], { cwd: projectDir, stdio: "ignore" });
    execFileSync("git", ["commit", "--quiet", "--no-edit"], { cwd: projectDir, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Restores .ralph/ to its original state after a merge.
 * Writes the original fix plan content back and commits if changed.
 */
function restoreRalph(projectDir: string, originalFixPlan: string | null): void {
  if (!originalFixPlan) return;

  const fixPlanPath = join(projectDir, RALPH_DIR, RALPH_FIX_PLAN_FILE);
  try {
    writeFileSync(fixPlanPath, originalFixPlan);
    execFileSync("git", ["add", ".ralph/"], { cwd: projectDir, stdio: "ignore" });
    tryCommit(projectDir, "swarm: restore .ralph/ state");
  } catch {
    // .ralph/ may not have changed
  }
}

/**
 * Attempts a git commit, silently succeeding if there's nothing to commit.
 */
function tryCommit(projectDir: string, message: string): void {
  try {
    execFileSync("git", ["diff", "--cached", "--quiet"], { cwd: projectDir, stdio: "ignore" });
    // Exit code 0 means no staged changes — nothing to commit
  } catch {
    // Exit code 1 means there ARE staged changes — commit them
    execFileSync("git", ["commit", "--quiet", "-m", message], {
      cwd: projectDir,
      stdio: "ignore",
    });
  }
}

function isInMergeState(projectDir: string): boolean {
  try {
    execFileSync("git", ["rev-parse", "--verify", "MERGE_HEAD"], {
      cwd: projectDir,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function getConflictFiles(projectDir: string): string[] {
  try {
    const output = execFileSync("git", ["diff", "--name-only", "--diff-filter=U"], {
      cwd: projectDir,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return output
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
  } catch {
    return [];
  }
}

async function readFixPlan(projectDir: string): Promise<string | null> {
  try {
    return await readFile(join(projectDir, RALPH_DIR, RALPH_FIX_PLAN_FILE), "utf-8");
  } catch {
    return null;
  }
}
