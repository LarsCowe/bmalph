import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  readPhaseState,
  writePhaseState,
  readPhaseTasks,
  writePhaseTasks,
  getPhaseLabel,
  type PhaseState,
  type PhaseTask,
} from "../../src/utils/state.js";
import { mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

describe("state", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `bmalph-state-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(join(testDir, "bmalph/state"), { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Windows file locking - ignore cleanup errors
    }
  });

  describe("readPhaseState", () => {
    it("returns null when state does not exist", async () => {
      const state = await readPhaseState(testDir);
      expect(state).toBeNull();
    });

    it("reads written state", async () => {
      const state: PhaseState = {
        currentPhase: 2,
        iteration: 3,
        status: "running",
        startedAt: "2025-01-01T00:00:00.000Z",
        lastUpdated: "2025-01-01T01:00:00.000Z",
      };

      await writePhaseState(testDir, state);
      const result = await readPhaseState(testDir);

      expect(result).toEqual(state);
    });
  });

  describe("phase tasks", () => {
    it("returns empty array when no tasks exist", async () => {
      const tasks = await readPhaseTasks(testDir, 1);
      expect(tasks).toEqual([]);
    });

    it("writes and reads tasks", async () => {
      const tasks: PhaseTask[] = [
        { id: "1", title: "Research competitors", status: "completed", priority: 1 },
        { id: "2", title: "Interview stakeholders", status: "pending", priority: 2 },
      ];

      await writePhaseTasks(testDir, 1, tasks);
      const result = await readPhaseTasks(testDir, 1);

      expect(result).toEqual(tasks);
    });
  });

  describe("getPhaseLabel", () => {
    it("returns correct labels", () => {
      expect(getPhaseLabel(1)).toBe("Analysis");
      expect(getPhaseLabel(2)).toBe("Planning");
      expect(getPhaseLabel(3)).toBe("Design");
      expect(getPhaseLabel(4)).toBe("Implementation");
    });

    it("returns Unknown for invalid phase", () => {
      expect(getPhaseLabel(5)).toBe("Unknown");
    });
  });
});
