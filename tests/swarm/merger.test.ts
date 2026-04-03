import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  createTestProject,
  createFile,
  type TestProject,
} from "../e2e/helpers/project-scaffold.js";
import { createWorktree, removeWorktree } from "../../src/swarm/worktree.js";
import { collectWorkerCompletions, mergeWorkerBranches } from "../../src/swarm/merger.js";
import type { SwarmWorker } from "../../src/swarm/types.js";

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function gitCommit(cwd: string, message: string): void {
  execFileSync("git", ["add", "-A"], { cwd, stdio: "ignore" });
  execFileSync("git", ["commit", "--quiet", "-m", message], { cwd, stdio: "ignore" });
}

function makeWorker(id: number, worktreePath: string, branchName: string): SwarmWorker {
  return {
    id,
    worktreePath,
    branchName,
    assignedEpics: [`Epic ${id}`],
    epicGroups: [],
    ralph: null,
    status: "done",
    completedAt: new Date(),
  };
}

describe("merger", () => {
  let project: TestProject | null = null;
  const workerIds: number[] = [];

  beforeEach(async () => {
    project = await createTestProject("bmalph-merger");
    // Set up a project with .ralph/@fix_plan.md
    await mkdir(join(project.path, ".ralph"), { recursive: true });
    await createFile(
      project.path,
      ".ralph/@fix_plan.md",
      [
        "# Ralph Fix Plan",
        "",
        "## Stories to Implement",
        "",
        "### Auth",
        "- [ ] Story 1.1: Login form",
        "- [ ] Story 1.2: Logout",
        "",
        "### Search",
        "- [ ] Story 2.1: Search bar",
        "",
        "## Completed",
      ].join("\n")
    );
    await createFile(project.path, "src/index.ts", "export const app = true;");
    gitCommit(project.path, "setup project");
    workerIds.length = 0;
  });

  afterEach(async () => {
    if (project) {
      for (const id of workerIds) {
        try {
          await removeWorktree(project.path, id);
        } catch {
          // best effort
        }
      }
      await project.cleanup();
      project = null;
    }
  });

  describe("collectWorkerCompletions", () => {
    it("collects completed story IDs from a worker fix plan", async () => {
      const wt = await createWorktree(project!.path, 1);
      workerIds.push(1);

      // Simulate worker completing stories
      const fixPlanPath = join(wt.worktreePath, ".ralph/@fix_plan.md");
      const content = await readFile(fixPlanPath, "utf-8");
      await writeFile(fixPlanPath, content.replace("- [ ] Story 1.1:", "- [x] Story 1.1:"));

      const completedIds = await collectWorkerCompletions(wt.worktreePath);
      expect(completedIds).toContain("1.1");
      expect(completedIds).not.toContain("1.2");
    });
  });

  describe("mergeWorkerBranches", () => {
    it("merges non-conflicting worker branches", async () => {
      const wt1 = await createWorktree(project!.path, 1);
      const wt2 = await createWorktree(project!.path, 2);
      workerIds.push(1, 2);

      // Worker 1 modifies auth.ts
      await createFile(wt1.worktreePath, "src/auth.ts", "export const auth = true;");
      gitCommit(wt1.worktreePath, "implement auth");

      // Worker 2 modifies search.ts
      await createFile(wt2.worktreePath, "src/search.ts", "export const search = true;");
      gitCommit(wt2.worktreePath, "implement search");

      const startBranch = git(project!.path, "symbolic-ref", "--short", "HEAD").trim();
      const workers = [
        makeWorker(1, wt1.worktreePath, "swarm/worker-1"),
        makeWorker(2, wt2.worktreePath, "swarm/worker-2"),
      ];

      const results = await mergeWorkerBranches(project!.path, workers, startBranch);

      expect(results).toHaveLength(2);
      expect(results[0]!.status).toBe("merged");
      expect(results[1]!.status).toBe("merged");

      // Both files should exist on main
      const authContent = await readFile(join(project!.path, "src/auth.ts"), "utf-8");
      expect(authContent).toContain("auth");
      const searchContent = await readFile(join(project!.path, "src/search.ts"), "utf-8");
      expect(searchContent).toContain("search");
    });

    it("keeps main .ralph/ state and discards worker .ralph/ changes", async () => {
      const wt1 = await createWorktree(project!.path, 1);
      workerIds.push(1);

      // Worker modifies both source and .ralph/ state
      await createFile(wt1.worktreePath, "src/auth.ts", "export const auth = true;");
      await writeFile(join(wt1.worktreePath, ".ralph/@fix_plan.md"), "worker-modified fix plan");
      gitCommit(wt1.worktreePath, "implement auth + update fix plan");

      const startBranch = git(project!.path, "symbolic-ref", "--short", "HEAD").trim();
      const workers = [makeWorker(1, wt1.worktreePath, "swarm/worker-1")];

      await mergeWorkerBranches(project!.path, workers, startBranch);

      // Source should be merged
      const auth = await readFile(join(project!.path, "src/auth.ts"), "utf-8");
      expect(auth).toContain("auth");

      // .ralph/ should NOT have the worker's changes — main's original version is preserved
      const fixPlan = await readFile(join(project!.path, ".ralph/@fix_plan.md"), "utf-8");
      expect(fixPlan).not.toBe("worker-modified fix plan");
      expect(fixPlan).toContain("# Ralph Fix Plan");
    });

    it("auto-resolves conflicts confined to .ralph/ files", async () => {
      const wt1 = await createWorktree(project!.path, 1);
      const wt2 = await createWorktree(project!.path, 2);
      workerIds.push(1, 2);

      // Worker 1: changes source AND .ralph/
      await createFile(wt1.worktreePath, "src/auth.ts", "export const auth = true;");
      await writeFile(join(wt1.worktreePath, ".ralph/@fix_plan.md"), "worker 1 plan");
      gitCommit(wt1.worktreePath, "worker 1");

      // Worker 2: changes different source AND .ralph/ (will conflict on .ralph/)
      await createFile(wt2.worktreePath, "src/search.ts", "export const search = true;");
      await writeFile(join(wt2.worktreePath, ".ralph/@fix_plan.md"), "worker 2 plan");
      gitCommit(wt2.worktreePath, "worker 2");

      const startBranch = git(project!.path, "symbolic-ref", "--short", "HEAD").trim();
      const workers = [
        makeWorker(1, wt1.worktreePath, "swarm/worker-1"),
        makeWorker(2, wt2.worktreePath, "swarm/worker-2"),
      ];

      const results = await mergeWorkerBranches(project!.path, workers, startBranch);

      expect(results).toHaveLength(2);
      expect(results[0]!.status).toBe("merged");
      expect(results[1]!.status).toBe("merged");
    });

    it("rebuilds unified fix plan with combined completions", async () => {
      const wt1 = await createWorktree(project!.path, 1);
      const wt2 = await createWorktree(project!.path, 2);
      workerIds.push(1, 2);

      // Worker 1 completes story 1.1 and modifies source
      await createFile(wt1.worktreePath, "src/auth.ts", "export const auth = true;");
      const plan1 = await readFile(join(wt1.worktreePath, ".ralph/@fix_plan.md"), "utf-8");
      await writeFile(
        join(wt1.worktreePath, ".ralph/@fix_plan.md"),
        plan1.replace("- [ ] Story 1.1:", "- [x] Story 1.1:")
      );
      gitCommit(wt1.worktreePath, "complete story 1.1");

      // Worker 2 completes story 2.1 and modifies source
      await createFile(wt2.worktreePath, "src/search.ts", "export const search = true;");
      const plan2 = await readFile(join(wt2.worktreePath, ".ralph/@fix_plan.md"), "utf-8");
      await writeFile(
        join(wt2.worktreePath, ".ralph/@fix_plan.md"),
        plan2.replace("- [ ] Story 2.1:", "- [x] Story 2.1:")
      );
      gitCommit(wt2.worktreePath, "complete story 2.1");

      const startBranch = git(project!.path, "symbolic-ref", "--short", "HEAD").trim();
      const workers = [
        makeWorker(1, wt1.worktreePath, "swarm/worker-1"),
        makeWorker(2, wt2.worktreePath, "swarm/worker-2"),
      ];

      await mergeWorkerBranches(project!.path, workers, startBranch);

      // Verify unified fix plan has both stories marked complete
      const finalPlan = await readFile(join(project!.path, ".ralph/@fix_plan.md"), "utf-8");
      expect(finalPlan).toContain("- [x] Story 1.1:");
      expect(finalPlan).toContain("- [x] Story 2.1:");
      // Story 1.2 should still be incomplete
      expect(finalPlan).toContain("- [ ] Story 1.2:");
    });

    it("stops on source code conflicts", async () => {
      const wt1 = await createWorktree(project!.path, 1);
      const wt2 = await createWorktree(project!.path, 2);
      workerIds.push(1, 2);

      // Both workers modify the same file
      await writeFile(join(wt1.worktreePath, "src/index.ts"), "export const app = 'worker1';");
      gitCommit(wt1.worktreePath, "worker 1 change");

      await writeFile(join(wt2.worktreePath, "src/index.ts"), "export const app = 'worker2';");
      gitCommit(wt2.worktreePath, "worker 2 change");

      const startBranch = git(project!.path, "symbolic-ref", "--short", "HEAD").trim();
      const workers = [
        makeWorker(1, wt1.worktreePath, "swarm/worker-1"),
        makeWorker(2, wt2.worktreePath, "swarm/worker-2"),
      ];

      const results = await mergeWorkerBranches(project!.path, workers, startBranch);

      expect(results[0]!.status).toBe("merged"); // first merge succeeds
      expect(results[1]!.status).toBe("conflict"); // second merge conflicts
      expect(results[1]!.conflictFiles).toContain("src/index.ts");
    });

    it("handles workers with null completedAt (sort coercion)", async () => {
      const wt1 = await createWorktree(project!.path, 1);
      const wt2 = await createWorktree(project!.path, 2);
      workerIds.push(1, 2);

      await createFile(wt1.worktreePath, "src/auth.ts", "export const auth = true;");
      gitCommit(wt1.worktreePath, "implement auth");

      await createFile(wt2.worktreePath, "src/search.ts", "export const search = true;");
      gitCommit(wt2.worktreePath, "implement search");

      const startBranch = git(project!.path, "symbolic-ref", "--short", "HEAD").trim();
      const workers = [
        // Worker 1 has completedAt: null (simulating error exit)
        { ...makeWorker(1, wt1.worktreePath, "swarm/worker-1"), completedAt: null },
        makeWorker(2, wt2.worktreePath, "swarm/worker-2"),
      ];

      const results = await mergeWorkerBranches(project!.path, workers, startBranch);

      // Both should merge — the sort handles null via ?? 0 coercion
      expect(results).toHaveLength(2);
      expect(results.every((r) => r.status === "merged")).toBe(true);
    });

    it("excludes conflicted worker completions from unified fix plan", async () => {
      const wt1 = await createWorktree(project!.path, 1);
      const wt2 = await createWorktree(project!.path, 2);
      workerIds.push(1, 2);

      // Worker 1: completes story 1.1, modifies unique file
      await createFile(wt1.worktreePath, "src/auth.ts", "export const auth = true;");
      const plan1 = await readFile(join(wt1.worktreePath, ".ralph/@fix_plan.md"), "utf-8");
      await writeFile(
        join(wt1.worktreePath, ".ralph/@fix_plan.md"),
        plan1.replace("- [ ] Story 1.1:", "- [x] Story 1.1:")
      );
      gitCommit(wt1.worktreePath, "complete story 1.1");

      // Worker 2: completes story 2.1, modifies SAME file as worker 1 → will conflict
      await createFile(wt2.worktreePath, "src/auth.ts", "export const auth = 'conflict';");
      const plan2 = await readFile(join(wt2.worktreePath, ".ralph/@fix_plan.md"), "utf-8");
      await writeFile(
        join(wt2.worktreePath, ".ralph/@fix_plan.md"),
        plan2.replace("- [ ] Story 2.1:", "- [x] Story 2.1:")
      );
      gitCommit(wt2.worktreePath, "complete story 2.1");

      const startBranch = git(project!.path, "symbolic-ref", "--short", "HEAD").trim();
      const workers = [
        makeWorker(1, wt1.worktreePath, "swarm/worker-1"),
        makeWorker(2, wt2.worktreePath, "swarm/worker-2"),
      ];

      await mergeWorkerBranches(project!.path, workers, startBranch);

      // Story 1.1 (merged worker) should be marked complete
      // Story 2.1 (conflicted worker) should NOT be marked complete
      const finalPlan = await readFile(join(project!.path, ".ralph/@fix_plan.md"), "utf-8");
      expect(finalPlan).toContain("- [x] Story 1.1:");
      expect(finalPlan).toContain("- [ ] Story 2.1:");
    });

    it("returns empty array when given no workers", async () => {
      const startBranch = git(project!.path, "symbolic-ref", "--short", "HEAD").trim();
      const results = await mergeWorkerBranches(project!.path, [], startBranch);
      expect(results).toEqual([]);
    });
  });

  describe("collectWorkerCompletions", () => {
    it("returns empty set when fix plan is missing", async () => {
      const wt = await createWorktree(project!.path, 1);
      workerIds.push(1);
      // Worktree has no .ralph/@fix_plan.md → should gracefully return empty
      const completedIds = await collectWorkerCompletions(join(wt.worktreePath, "nonexistent-dir"));
      expect(completedIds.size).toBe(0);
    });
  });
});
