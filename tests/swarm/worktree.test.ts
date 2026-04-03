import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { join } from "node:path";
import {
  createTestProject,
  createFile,
  type TestProject,
} from "../e2e/helpers/project-scaffold.js";
import {
  createWorktree,
  removeWorktree,
  cleanupOrphanedWorktrees,
} from "../../src/swarm/worktree.js";

function gitInRepo(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

describe("worktree", () => {
  let project: TestProject | null = null;

  beforeEach(async () => {
    project = await createTestProject("bmalph-worktree");
    // Create a tracked file so worktrees have content
    await createFile(project.path, "src/index.ts", 'export const main = "hello";');
    execFileSync("git", ["add", "-A"], { cwd: project.path, stdio: "ignore" });
    execFileSync("git", ["commit", "--quiet", "-m", "add source"], {
      cwd: project.path,
      stdio: "ignore",
    });
  });

  afterEach(async () => {
    if (project) {
      // Clean up any worktrees before removing the project
      try {
        const output = gitInRepo(project.path, "worktree", "list", "--porcelain");
        const worktreePaths = output
          .split("\n")
          .filter((l) => l.startsWith("worktree "))
          .map((l) => l.slice("worktree ".length))
          .filter((p) => p !== project!.path);
        for (const wt of worktreePaths) {
          try {
            execFileSync("git", ["worktree", "remove", "--force", wt], {
              cwd: project.path,
              stdio: "ignore",
            });
          } catch {
            // best effort
          }
        }
      } catch (err) {
        console.warn(`[afterEach] worktree cleanup failed: ${err}`);
      }
      await project.cleanup();
      project = null;
    }
  });

  describe("createWorktree", () => {
    it("creates a git worktree with the expected branch", async () => {
      const result = await createWorktree(project!.path, 1);

      expect(result.worktreePath).toContain(".swarm/worker-1");
      expect(result.branchName).toBe("swarm/worker-1");

      // Verify git worktree exists
      const output = gitInRepo(project!.path, "worktree", "list", "--porcelain");
      expect(output).toContain("worker-1");

      // Verify branch exists
      const branches = gitInRepo(project!.path, "branch", "--list");
      expect(branches).toContain("swarm/worker-1");
    });

    it("creates a worktree with tracked files from HEAD", async () => {
      const result = await createWorktree(project!.path, 1);

      const content = await readFile(join(result.worktreePath, "src/index.ts"), "utf-8");
      expect(content).toBe('export const main = "hello";');
    });

    it("creates the .swarm directory if it does not exist", async () => {
      await createWorktree(project!.path, 1);

      expect(await fileExists(join(project!.path, ".swarm"))).toBe(true);
    });

    it("creates multiple independent worktrees", async () => {
      const wt1 = await createWorktree(project!.path, 1);
      const wt2 = await createWorktree(project!.path, 2);

      expect(wt1.worktreePath).not.toBe(wt2.worktreePath);
      expect(wt1.branchName).toBe("swarm/worker-1");
      expect(wt2.branchName).toBe("swarm/worker-2");

      // Both should have the tracked file
      expect(await fileExists(join(wt1.worktreePath, "src/index.ts"))).toBe(true);
      expect(await fileExists(join(wt2.worktreePath, "src/index.ts"))).toBe(true);
    });
  });

  describe("removeWorktree", () => {
    it("removes the worktree and branch", async () => {
      await createWorktree(project!.path, 1);
      await removeWorktree(project!.path, 1);

      const output = gitInRepo(project!.path, "worktree", "list", "--porcelain");
      expect(output).not.toContain("worker-1");

      const branches = gitInRepo(project!.path, "branch", "--list");
      expect(branches).not.toContain("swarm/worker-1");
    });

    it("succeeds even if worktree has uncommitted changes", async () => {
      const result = await createWorktree(project!.path, 1);
      await writeFile(join(result.worktreePath, "dirty.txt"), "uncommitted");

      await expect(removeWorktree(project!.path, 1)).resolves.not.toThrow();
    });
  });

  describe("cleanupOrphanedWorktrees", () => {
    it("removes stale worktrees from previous runs", async () => {
      await createWorktree(project!.path, 1);
      await createWorktree(project!.path, 2);

      await cleanupOrphanedWorktrees(project!.path);

      const output = gitInRepo(project!.path, "worktree", "list", "--porcelain");
      expect(output).not.toContain("worker-1");
      expect(output).not.toContain("worker-2");
    });

    it("succeeds when no worktrees exist", async () => {
      await expect(cleanupOrphanedWorktrees(project!.path)).resolves.not.toThrow();
    });

    it("preserves conflict branches listed in .conflict-branches", async () => {
      await createWorktree(project!.path, 1);
      await createWorktree(project!.path, 2);

      // Mark worker 1's branch as having unresolved conflicts
      await mkdir(join(project!.path, ".swarm"), { recursive: true });
      await writeFile(join(project!.path, ".swarm/.conflict-branches"), "swarm/worker-1\n");

      await cleanupOrphanedWorktrees(project!.path);

      const branches = gitInRepo(project!.path, "branch", "--list");
      expect(branches).toContain("swarm/worker-1"); // preserved
      expect(branches).not.toContain("swarm/worker-2"); // cleaned
    });
  });
});
