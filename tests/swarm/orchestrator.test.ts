import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  createTestProject,
  createFile,
  type TestProject,
} from "../e2e/helpers/project-scaffold.js";
import { validateSwarmPrerequisites, resolveStartBranch } from "../../src/swarm/orchestrator.js";
import { SWARM_MAX_WORKERS } from "../../src/utils/constants.js";

function gitCommit(cwd: string, message: string): void {
  execFileSync("git", ["add", "-A"], { cwd, stdio: "ignore" });
  execFileSync("git", ["commit", "--quiet", "-m", message], { cwd, stdio: "ignore" });
}

const VALID_FIX_PLAN = [
  "# Ralph Fix Plan",
  "",
  "## Stories to Implement",
  "",
  "### Auth",
  "> Goal: User authentication",
  "- [ ] Story 1.1: Login form",
  "- [ ] Story 1.2: Logout",
  "",
  "### Search",
  "> Goal: Full-text search",
  "- [ ] Story 2.1: Search bar",
  "",
  "## Completed",
].join("\n");

describe("orchestrator", () => {
  let project: TestProject | null = null;

  beforeEach(async () => {
    project = await createTestProject("bmalph-orchestrator");
  });

  afterEach(async () => {
    if (project) {
      await project.cleanup();
      project = null;
    }
  });

  describe("resolveStartBranch", () => {
    it("returns the current branch name", async () => {
      const branch = await resolveStartBranch(project!.path);
      // Default branch varies — just check it's a non-empty string
      expect(branch.length).toBeGreaterThan(0);
    });

    it("throws on detached HEAD", async () => {
      const sha = execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: project!.path,
        encoding: "utf-8",
      }).trim();
      execFileSync("git", ["checkout", sha], { cwd: project!.path, stdio: "ignore" });

      await expect(resolveStartBranch(project!.path)).rejects.toThrow("detached HEAD");
    });
  });

  describe("validateSwarmPrerequisites", () => {
    it("succeeds with a clean tree and valid fix plan", async () => {
      await mkdir(join(project!.path, ".ralph"), { recursive: true });
      await createFile(project!.path, ".ralph/@fix_plan.md", VALID_FIX_PLAN);
      gitCommit(project!.path, "add fix plan");

      const result = await validateSwarmPrerequisites(project!.path, 2);

      expect(result.epicGroups.length).toBeGreaterThanOrEqual(2);
      expect(result.workerCount).toBe(2);
    });

    it("throws when working tree is dirty", async () => {
      await mkdir(join(project!.path, ".ralph"), { recursive: true });
      await createFile(project!.path, ".ralph/@fix_plan.md", VALID_FIX_PLAN);
      gitCommit(project!.path, "add fix plan");
      // Make the tree dirty
      await writeFile(join(project!.path, "dirty.txt"), "uncommitted");

      await expect(validateSwarmPrerequisites(project!.path, 2)).rejects.toThrow(
        "clean working tree"
      );
    });

    it("throws when fix plan does not exist", async () => {
      await expect(validateSwarmPrerequisites(project!.path, 2)).rejects.toThrow("fix plan");
    });

    it("throws when only one incomplete epic", async () => {
      await mkdir(join(project!.path, ".ralph"), { recursive: true });
      const singleEpicPlan = [
        "# Ralph Fix Plan",
        "",
        "## Stories to Implement",
        "",
        "### Auth",
        "- [ ] Story 1.1: Login form",
        "",
        "## Completed",
      ].join("\n");
      await createFile(project!.path, ".ralph/@fix_plan.md", singleEpicPlan);
      gitCommit(project!.path, "add fix plan");

      await expect(validateSwarmPrerequisites(project!.path, 2)).rejects.toThrow("at least 2");
    });

    it("reduces worker count to match available epics", async () => {
      await mkdir(join(project!.path, ".ralph"), { recursive: true });
      await createFile(project!.path, ".ralph/@fix_plan.md", VALID_FIX_PLAN);
      gitCommit(project!.path, "add fix plan");

      const result = await validateSwarmPrerequisites(project!.path, 10);

      expect(result.workerCount).toBe(2); // only 2 epics
      expect(result.warnings).toContainEqual(expect.stringContaining("reduced"));
    });

    it("caps worker count at SWARM_MAX_WORKERS", async () => {
      const epicCount = SWARM_MAX_WORKERS + 2;
      const manyEpicsPlan = [
        "# Ralph Fix Plan",
        "",
        "## Stories to Implement",
        "",
        ...Array.from({ length: epicCount }, (_, i) => [
          `### Epic ${i + 1}`,
          `- [ ] Story ${i + 1}.1: Feature ${i + 1}`,
          "",
        ]).flat(),
        "## Completed",
      ].join("\n");
      await mkdir(join(project!.path, ".ralph"), { recursive: true });
      await createFile(project!.path, ".ralph/@fix_plan.md", manyEpicsPlan);
      gitCommit(project!.path, "add fix plan");

      const result = await validateSwarmPrerequisites(project!.path, 100);

      expect(result.workerCount).toBeLessThanOrEqual(SWARM_MAX_WORKERS);
    });
  });
});
