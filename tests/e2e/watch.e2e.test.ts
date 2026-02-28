import { describe, it, expect, afterEach } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runInit, runWatch } from "./helpers/cli-runner.js";
import { createTestProject, type TestProject } from "./helpers/project-scaffold.js";

describe("bmalph watch e2e", { timeout: 60000 }, () => {
  let project: TestProject | null = null;

  afterEach(async () => {
    if (project) {
      await project.cleanup();
      project = null;
    }
  });

  it("renders dashboard with Ralph state files", async () => {
    project = await createTestProject();
    await runInit(project.path);

    const ralphDir = join(project.path, ".ralph");
    const logsDir = join(ralphDir, "logs");
    await mkdir(logsDir, { recursive: true });

    await writeFile(
      join(ralphDir, "status.json"),
      JSON.stringify({
        loop_count: 7,
        status: "running",
        calls_made_this_hour: 15,
        max_calls_per_hour: 100,
        last_action: "building",
      })
    );

    const logLines = [
      "[2026-02-25 14:20:00] [INFO] Loop #7 started",
      "[2026-02-25 14:20:30] [INFO] Building project",
    ];
    await writeFile(join(logsDir, "ralph.log"), logLines.join("\n"));

    const result = await runWatch(project.path, 500, 3000);

    expect(result.stdout).toContain("RALPH MONITOR");
    expect(result.stdout).toContain("#7");
  });

  it("exits with error when project not initialized", async () => {
    project = await createTestProject();

    const result = await runWatch(project.path, 500, 3000);

    expect(result.stderr).toContain("not initialized");
    expect(result.exitCode).toBe(1);
  });

  it("shows waiting state when no Ralph state files exist", async () => {
    project = await createTestProject();
    await runInit(project.path);

    const result = await runWatch(project.path, 500, 3000);

    expect(result.stdout).toContain("Waiting for Ralph");
  });
});
