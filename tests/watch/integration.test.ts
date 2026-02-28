import { describe, it, expect, vi, afterEach } from "vitest";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

vi.mock("chalk", () => ({
  default: {
    red: (s: string) => s,
    green: (s: string) => s,
    blue: (s: string) => s,
    yellow: (s: string) => s,
    cyan: (s: string) => s,
    white: (s: string) => s,
    bold: (s: string) => s,
    dim: (s: string) => s,
  },
}));

import { readDashboardState } from "../../src/watch/state-reader.js";
import { renderDashboard } from "../../src/watch/renderer.js";

function makeTmpDir(): string {
  return join(tmpdir(), `bmalph-watch-int-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

async function writeJson(path: string, data: unknown): Promise<void> {
  await writeFile(path, JSON.stringify(data));
}

async function writeAllStateFiles(testDir: string): Promise<void> {
  const ralphDir = join(testDir, ".ralph");
  const logsDir = join(ralphDir, "logs");
  await mkdir(logsDir, { recursive: true });

  await writeJson(join(ralphDir, "status.json"), {
    loop_count: 5,
    status: "running",
    calls_made_this_hour: 10,
    max_calls_per_hour: 100,
    last_action: "testing",
  });

  await writeJson(join(ralphDir, ".circuit_breaker_state"), {
    state: "CLOSED",
    consecutive_no_progress: 0,
    total_opens: 1,
  });

  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const now = new Date().toISOString();
  await writeJson(join(ralphDir, ".ralph_session"), {
    session_id: "test-session",
    created_at: thirtyMinAgo,
    last_used: now,
  });

  await writeJson(join(ralphDir, ".response_analysis"), {
    analysis: {
      files_modified: 3,
      confidence_score: 72,
      is_test_only: false,
      is_stuck: false,
      exit_signal: false,
      has_permission_denials: false,
      permission_denial_count: 0,
    },
  });

  await writeJson(join(ralphDir, "progress.json"), {
    status: "executing",
    elapsed_seconds: 45,
  });

  await writeFile(
    join(ralphDir, "@fix_plan.md"),
    `# Ralph Fix Plan

## Stories to Implement

- [x] Story 1.1: Setup database schema
- [x] Story 1.2: Create migration scripts
- [ ] Story 2.1: Implement user service
`
  );

  const logLines = [
    "[2026-02-25 14:20:00] [INFO] Loop #4 started",
    "[2026-02-25 14:20:30] [INFO] Executing story 1.2",
    "[2026-02-25 14:21:00] [INFO] Tests passing",
  ];
  await writeFile(join(logsDir, "ralph.log"), logLines.join("\n"));
}

describe("watch integration", () => {
  let testDir: string;

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Windows file locking
    }
  });

  it("readDashboardState returns all 7 sub-readers populated from state files", async () => {
    testDir = makeTmpDir();
    await mkdir(testDir, { recursive: true });
    await writeAllStateFiles(testDir);

    const state = await readDashboardState(testDir);

    expect(state.loop).not.toBeNull();
    expect(state.loop!.loopCount).toBe(5);
    expect(state.loop!.status).toBe("running");
    expect(state.loop!.callsMadeThisHour).toBe(10);
    expect(state.loop!.maxCallsPerHour).toBe(100);
    expect(state.loop!.lastAction).toBe("testing");

    expect(state.circuitBreaker).not.toBeNull();
    expect(state.circuitBreaker!.state).toBe("CLOSED");
    expect(state.circuitBreaker!.consecutiveNoProgress).toBe(0);
    expect(state.circuitBreaker!.totalOpens).toBe(1);

    expect(state.session).not.toBeNull();
    expect(state.session!.createdAt).toBeDefined();

    expect(state.analysis).not.toBeNull();
    expect(state.analysis!.filesModified).toBe(3);
    expect(state.analysis!.confidenceScore).toBe(72);
    expect(state.analysis!.isTestOnly).toBe(false);
    expect(state.analysis!.isStuck).toBe(false);

    expect(state.execution).not.toBeNull();
    expect(state.execution!.status).toBe("executing");
    expect(state.execution!.elapsedSeconds).toBe(45);

    expect(state.stories).not.toBeNull();
    expect(state.stories!.completed).toBe(2);
    expect(state.stories!.total).toBe(3);
    expect(state.stories!.nextStory).toBe("Story 2.1: Implement user service");

    expect(state.recentLogs).toHaveLength(3);
    expect(state.recentLogs[0]!.message).toBe("Loop #4 started");
    expect(state.recentLogs[2]!.message).toBe("Tests passing");

    expect(state.lastUpdated).toBeInstanceOf(Date);
  });

  it("full pipeline renders state files through readDashboardState and renderDashboard", async () => {
    testDir = makeTmpDir();
    await mkdir(testDir, { recursive: true });
    await writeAllStateFiles(testDir);

    const state = await readDashboardState(testDir);
    const output = renderDashboard(state, 80);

    expect(output).toContain("RALPH MONITOR");
    expect(output).toContain("#5");
    expect(output).toContain("running");
    expect(output).toContain("10/100");
    expect(output).toContain("CLOSED");
    expect(output).toContain("2/3");
    expect(output).toContain("Files: 3");
    expect(output).toContain("Confidence: 72%");
    expect(output).toContain("Loop #4 started");
    expect(output).toContain("Tests passing");
    expect(output).toContain("q quit");
  });

  it("pipeline renders gracefully with only status.json present", async () => {
    testDir = makeTmpDir();
    const ralphDir = join(testDir, ".ralph");
    await mkdir(ralphDir, { recursive: true });

    await writeJson(join(ralphDir, "status.json"), {
      loop_count: 5,
      status: "running",
      calls_made_this_hour: 10,
      max_calls_per_hour: 100,
      last_action: "testing",
    });

    const state = await readDashboardState(testDir);
    const output = renderDashboard(state, 80);

    expect(output).toContain("#5");
    expect(output).toContain("N/A");
    expect(output).toContain("RALPH MONITOR");
    expect(output).toContain("q quit");
  });
});
