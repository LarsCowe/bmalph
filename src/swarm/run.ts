import chalk from "chalk";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { spawnRalphLoop } from "../run/ralph-process.js";
import {
  RALPH_DIR,
  RALPH_FIX_PLAN_FILE,
  SWARM_DIR,
  SWARM_STAGGER_DELAY_MS,
  SWARM_DEFAULT_RATE_LIMIT,
} from "../utils/constants.js";
import { atomicWriteFile } from "../utils/file-system.js";
import { resolveStartBranch, validateSwarmPrerequisites } from "./orchestrator.js";
import { generateWorkerFixPlan } from "./fix-plan-parser.js";
import { createWorktree, removeWorktree, cleanupOrphanedWorktrees } from "./worktree.js";
import { mergeWorkerBranches } from "./merger.js";
import type { SwarmWorker, SwarmRunOptions, MergeResult } from "./types.js";

/**
 * Runs the Ralph loop in swarm mode: N parallel workers in git worktrees.
 */
export async function executeSwarmRun(options: SwarmRunOptions): Promise<void> {
  const { projectDir, platformId, reviewMode, workerCount } = options;

  // --- Validate ---
  const startBranch = await resolveStartBranch(projectDir);
  const prereqs = await validateSwarmPrerequisites(projectDir, workerCount);

  for (const w of prereqs.warnings) {
    console.log(chalk.yellow(`Warning: ${w}`));
  }

  console.log(
    chalk.cyan(
      `Swarm: ${prereqs.workerCount} workers, ${prereqs.partitions.flat().reduce((s, g) => s + g.stories.length, 0)} stories across ${prereqs.partitions.length} partitions`
    )
  );

  // --- Setup ---
  const workers: SwarmWorker[] = [];
  let cleanupInProgress = false;
  const killWorkers = (): void => {
    for (const worker of workers) {
      if (worker.ralph?.state === "running") {
        worker.ralph.kill();
      }
    }
  };

  const handleSignal = (): void => {
    if (cleanupInProgress) return;
    cleanupInProgress = true;
    killWorkers();
    cleanupMergedWorkers(projectDir, workers, [])
      .catch(() => {})
      .finally(() => process.exit(130));
  };
  process.on("SIGINT", handleSignal);
  process.on("SIGTERM", handleSignal);

  try {
    await cleanupOrphanedWorktrees(projectDir);
    await setupWorkers(projectDir, prereqs, workers);
    await spawnWorkers(workers, platformId, reviewMode, prereqs.workerCount);

    // Wait for all workers to finish
    await Promise.all(
      workers.map(
        (worker) =>
          new Promise<void>((resolve) => {
            worker.ralph!.onExit((code) => {
              worker.status = code === 0 ? "done" : "error";
              worker.completedAt = new Date();
              console.log(
                chalk.yellow(
                  `Worker ${worker.id} exited (${worker.status}${code !== 0 ? `, code ${code}` : ""})`
                )
              );
              resolve();
            });
          })
      )
    );

    // --- Merge only successful workers ---
    console.log(chalk.cyan("\nMerging worker branches..."));
    const successfulWorkers = workers.filter((w) => w.status === "done");
    const failedWorkers = workers.filter((w) => w.status === "error");

    for (const w of failedWorkers) {
      console.log(chalk.red(`Worker ${w.id}: FAILED (branch ${w.branchName} preserved)`));
    }

    const results = await mergeWorkerBranches(projectDir, successfulWorkers, startBranch);
    reportResults(results);

    // Persist conflict branches so cleanupOrphanedWorktrees preserves them
    await persistConflictBranches(projectDir, workers, results);

    // Only clean up merged workers' worktrees
    await cleanupMergedWorkers(projectDir, workers, results);

    const merged = results.filter((r) => r.status === "merged").length;
    const conflicts = results.filter((r) => r.status === "conflict").length;
    const failed = failedWorkers.length;
    console.log(
      chalk.cyan(`\nSwarm complete: ${merged} merged, ${conflicts} conflicts, ${failed} failed`)
    );
  } catch (err) {
    if (!cleanupInProgress) {
      cleanupInProgress = true;
      killWorkers();
      await cleanupMergedWorkers(projectDir, workers, []);
    }
    throw err;
  } finally {
    process.removeListener("SIGINT", handleSignal);
    process.removeListener("SIGTERM", handleSignal);
  }
}

async function setupWorkers(
  projectDir: string,
  prereqs: Awaited<ReturnType<typeof validateSwarmPrerequisites>>,
  workers: SwarmWorker[]
): Promise<void> {
  for (let i = 0; i < prereqs.workerCount; i++) {
    const partition = prereqs.partitions[i]!;
    const wt = await createWorktree(projectDir, i + 1);
    const workerFixPlan = generateWorkerFixPlan(partition);
    await mkdir(join(wt.worktreePath, RALPH_DIR), { recursive: true });
    await atomicWriteFile(join(wt.worktreePath, RALPH_DIR, RALPH_FIX_PLAN_FILE), workerFixPlan);

    workers.push({
      id: i + 1,
      worktreePath: wt.worktreePath,
      branchName: wt.branchName,
      assignedEpics: partition.map((g) => g.epicHeading.replace(/^###\s*/, "")),
      epicGroups: partition,
      ralph: null,
      status: "pending",
      completedAt: null,
    });
  }
}

async function spawnWorkers(
  workers: SwarmWorker[],
  platformId: string,
  reviewMode: SwarmRunOptions["reviewMode"],
  workerCount: number
): Promise<void> {
  const baseRateLimit = Number(process.env.MAX_CALLS_PER_HOUR) || SWARM_DEFAULT_RATE_LIMIT;
  const perWorkerRateLimit = Math.max(1, Math.floor(baseRateLimit / workerCount));

  for (const worker of workers) {
    if (worker.id > 1) {
      await sleep(SWARM_STAGGER_DELAY_MS);
    }

    const ralph = spawnRalphLoop(worker.worktreePath, platformId, {
      inheritStdio: false,
      reviewMode,
      env: {
        MAX_CALLS_PER_HOUR: String(perWorkerRateLimit),
        // Disable git auto-gc in worktrees to avoid lock contention on shared .git
        GIT_CONFIG_COUNT: "1",
        GIT_CONFIG_KEY_0: "gc.auto",
        GIT_CONFIG_VALUE_0: "0",
      },
    });

    worker.ralph = ralph;
    worker.status = "running";
    console.log(chalk.green(`Worker ${worker.id} started (${worker.assignedEpics.join(", ")})`));
  }
}

function reportResults(results: MergeResult[]): void {
  for (const result of results) {
    if (result.status === "merged") {
      console.log(chalk.green(`Worker ${result.workerId}: merged`));
    } else if (result.status === "conflict") {
      console.log(
        chalk.red(
          `Worker ${result.workerId}: CONFLICT in ${result.conflictFiles?.join(", ") ?? "unknown files"}`
        )
      );
    }
  }
}

async function persistConflictBranches(
  projectDir: string,
  workers: SwarmWorker[],
  results: MergeResult[]
): Promise<void> {
  const conflictWorkerIds = new Set(
    results.filter((r) => r.status === "conflict").map((r) => r.workerId)
  );
  const failedWorkerIds = new Set(workers.filter((w) => w.status === "error").map((w) => w.id));
  const preserveIds = new Set([...conflictWorkerIds, ...failedWorkerIds]);

  if (preserveIds.size === 0) return;

  const branches = workers
    .filter((w) => preserveIds.has(w.id))
    .map((w) => w.branchName)
    .join("\n");

  await mkdir(join(projectDir, SWARM_DIR), { recursive: true });
  await writeFile(join(projectDir, SWARM_DIR, ".conflict-branches"), branches + "\n");
}

async function cleanupMergedWorkers(
  projectDir: string,
  workers: SwarmWorker[],
  results: MergeResult[]
): Promise<void> {
  const mergedIds = new Set(results.filter((r) => r.status === "merged").map((r) => r.workerId));

  for (const worker of workers) {
    // Only remove worktrees for merged workers; preserve conflict/error branches
    if (results.length === 0 || mergedIds.has(worker.id)) {
      try {
        await removeWorktree(projectDir, worker.id);
      } catch {
        // best effort
      }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
