import { readFile, mkdir, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { SWARM_DIR } from "../utils/constants.js";

const WORKTREE_PREFIX = "worker-";
const BRANCH_PREFIX = "swarm/worker-";
const CONFLICT_BRANCHES_FILE = ".conflict-branches";

export interface WorktreeInfo {
  worktreePath: string;
  branchName: string;
}

/**
 * Creates a git worktree for a swarm worker.
 */
export async function createWorktree(projectDir: string, workerId: number): Promise<WorktreeInfo> {
  const swarmDir = join(projectDir, SWARM_DIR);
  await mkdir(swarmDir, { recursive: true });

  const worktreePath = join(swarmDir, `${WORKTREE_PREFIX}${workerId}`);
  const branchName = `${BRANCH_PREFIX}${workerId}`;

  execFileSync("git", ["worktree", "add", worktreePath, "-b", branchName, "HEAD"], {
    cwd: projectDir,
    stdio: "ignore",
  });

  return { worktreePath, branchName };
}

/**
 * Removes a worktree and its branch.
 */
export async function removeWorktree(projectDir: string, workerId: number): Promise<void> {
  const worktreePath = join(projectDir, SWARM_DIR, `${WORKTREE_PREFIX}${workerId}`);
  const branchName = `${BRANCH_PREFIX}${workerId}`;

  try {
    execFileSync("git", ["worktree", "remove", "--force", worktreePath], {
      cwd: projectDir,
      stdio: "ignore",
    });
  } catch {
    // Worktree may already be removed; prune stale entries
    execFileSync("git", ["worktree", "prune"], { cwd: projectDir, stdio: "ignore" });
  }

  try {
    execFileSync("git", ["branch", "-D", branchName], { cwd: projectDir, stdio: "ignore" });
  } catch {
    // Branch may already be deleted
  }
}

/**
 * Cleans up orphaned worktrees and branches from previous runs.
 * Preserves branches listed in .swarm/.conflict-branches.
 */
export async function cleanupOrphanedWorktrees(projectDir: string): Promise<void> {
  const preservedBranches = await loadConflictBranches(projectDir);

  // Find and remove stale swarm worktrees
  const worktrees = listSwarmWorktrees(projectDir);
  for (const wt of worktrees) {
    const branchName = worktreeBranchName(wt);
    if (branchName && preservedBranches.has(branchName)) {
      continue;
    }

    try {
      execFileSync("git", ["worktree", "remove", "--force", wt], {
        cwd: projectDir,
        stdio: "ignore",
      });
    } catch {
      // May already be gone
    }
  }

  // Prune stale worktree entries (handles manually deleted directories)
  execFileSync("git", ["worktree", "prune"], { cwd: projectDir, stdio: "ignore" });

  // Delete orphaned swarm branches (not in conflict list)
  const branches = listSwarmBranches(projectDir);
  for (const branch of branches) {
    if (preservedBranches.has(branch)) {
      continue;
    }
    try {
      execFileSync("git", ["branch", "-D", branch], { cwd: projectDir, stdio: "ignore" });
    } catch {
      // May already be deleted
    }
  }

  // Remove .swarm/ if empty (no conflict branches preserved)
  if (preservedBranches.size === 0) {
    const swarmDir = join(projectDir, SWARM_DIR);
    try {
      await rm(swarmDir, { recursive: true, force: true });
    } catch {
      // May not exist
    }
  }
}

// TODO: detectPackageManager + worktree dependency installation planned for Phase 2

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function loadConflictBranches(projectDir: string): Promise<Set<string>> {
  const filePath = join(projectDir, SWARM_DIR, CONFLICT_BRANCHES_FILE);
  try {
    const content = await readFile(filePath, "utf-8");
    const branches = content
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => /^swarm\/worker-\d+$/.test(l));
    return new Set(branches);
  } catch {
    return new Set();
  }
}

function listSwarmWorktrees(projectDir: string): string[] {
  try {
    const output = execFileSync("git", ["worktree", "list", "--porcelain"], {
      cwd: projectDir,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return output
      .split("\n")
      .filter((l) => l.startsWith("worktree "))
      .map((l) => l.slice("worktree ".length))
      .filter((p) => p.includes(`${SWARM_DIR}/`) || p.includes(`${SWARM_DIR}\\`));
  } catch {
    return [];
  }
}

function worktreeBranchName(worktreePath: string): string | null {
  try {
    const output = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd: worktreePath,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return output.trim();
  } catch {
    return null;
  }
}

function listSwarmBranches(projectDir: string): string[] {
  try {
    const output = execFileSync("git", ["branch", "--list", `${BRANCH_PREFIX}*`], {
      cwd: projectDir,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return output
      .split("\n")
      .map((l) => l.replace(/^\*?\s*/, "").trim())
      .filter((l) => l.startsWith(BRANCH_PREFIX));
  } catch {
    return [];
  }
}
