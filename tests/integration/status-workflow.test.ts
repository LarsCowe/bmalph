import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { readState, writeState, type BmalphState, readRalphStatus } from "../../src/utils/state.js";
import { writeConfig, readConfig, type BmalphConfig } from "../../src/utils/config.js";

describe("status workflow", { timeout: 30000 }, () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `bmalph-status-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Windows file locking
    }
  });

  it("init state shows phase 1 planning", async () => {
    await mkdir(join(testDir, "bmalph/state"), { recursive: true });

    const config: BmalphConfig = {
      name: "status-test",
      description: "Testing status",
      level: 2,
      createdAt: new Date().toISOString(),
    };
    await writeConfig(testDir, config);

    const state: BmalphState = {
      currentPhase: 1,
      status: "planning",
      startedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    };
    await writeState(testDir, state);

    const readBack = await readState(testDir);
    expect(readBack).not.toBeNull();
    expect(readBack!.currentPhase).toBe(1);
    expect(readBack!.status).toBe("planning");
  });

  it("state transitions through phases correctly", async () => {
    await mkdir(join(testDir, "bmalph/state"), { recursive: true });

    // Phase 1
    await writeState(testDir, {
      currentPhase: 1,
      status: "planning",
      startedAt: "2025-01-01T00:00:00.000Z",
      lastUpdated: "2025-01-01T00:00:00.000Z",
    });
    let state = await readState(testDir);
    expect(state!.currentPhase).toBe(1);

    // Phase 2
    await writeState(testDir, {
      currentPhase: 2,
      status: "planning",
      startedAt: "2025-01-01T00:00:00.000Z",
      lastUpdated: "2025-01-02T00:00:00.000Z",
    });
    state = await readState(testDir);
    expect(state!.currentPhase).toBe(2);

    // Phase 4 (implementing)
    await writeState(testDir, {
      currentPhase: 4,
      status: "implementing",
      startedAt: "2025-01-01T00:00:00.000Z",
      lastUpdated: "2025-01-03T00:00:00.000Z",
    });
    state = await readState(testDir);
    expect(state!.currentPhase).toBe(4);
    expect(state!.status).toBe("implementing");
  });

  it("ralph status returns defaults when no status file exists", async () => {
    const status = await readRalphStatus(testDir);
    expect(status.loopCount).toBe(0);
    expect(status.status).toBe("not_started");
    expect(status.tasksCompleted).toBe(0);
    expect(status.tasksTotal).toBe(0);
  });

  it("ralph status reads from .ralph/status.json", async () => {
    await mkdir(join(testDir, ".ralph"), { recursive: true });
    await writeFile(
      join(testDir, ".ralph/status.json"),
      JSON.stringify({
        loopCount: 5,
        status: "running",
        tasksCompleted: 3,
        tasksTotal: 10,
      }),
    );

    const status = await readRalphStatus(testDir);
    expect(status.loopCount).toBe(5);
    expect(status.status).toBe("running");
    expect(status.tasksCompleted).toBe(3);
    expect(status.tasksTotal).toBe(10);
  });

  it("config and state can coexist independently", async () => {
    await mkdir(join(testDir, "bmalph/state"), { recursive: true });

    const config: BmalphConfig = {
      name: "coexist-test",
      description: "",
      level: 3,
      createdAt: "2025-06-01T00:00:00.000Z",
    };
    await writeConfig(testDir, config);

    const state: BmalphState = {
      currentPhase: 3,
      status: "planning",
      startedAt: "2025-06-01T00:00:00.000Z",
      lastUpdated: "2025-06-02T00:00:00.000Z",
    };
    await writeState(testDir, state);

    // Both readable independently
    const readBackConfig = await readConfig(testDir);
    const readBackState = await readState(testDir);

    expect(readBackConfig!.name).toBe("coexist-test");
    expect(readBackState!.currentPhase).toBe(3);
  });
});
