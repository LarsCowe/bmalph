import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  readState,
  writeState,
  getPhaseLabel,
  getPhaseInfo,
  readRalphStatus,
  type BmalphState,
} from "../../src/utils/state.js";
import { mkdir, rm, writeFile } from "fs/promises";
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

  describe("readState", () => {
    it("returns null when state does not exist", async () => {
      const state = await readState(testDir);
      expect(state).toBeNull();
    });

    it("reads written state", async () => {
      const state: BmalphState = {
        currentPhase: 2,
        status: "planning",
        startedAt: "2025-01-01T00:00:00.000Z",
        lastUpdated: "2025-01-01T01:00:00.000Z",
      };

      await writeState(testDir, state);
      const result = await readState(testDir);

      expect(result).toEqual(state);
    });

    it("throws on corrupt state file", async () => {
      await writeFile(join(testDir, "bmalph/state/current-phase.json"), "not json{{{");
      await expect(readState(testDir)).rejects.toThrow("Invalid JSON");
    });

    it("throws on invalid state structure", async () => {
      await writeFile(
        join(testDir, "bmalph/state/current-phase.json"),
        JSON.stringify({ currentPhase: "not-a-number" }),
      );
      await expect(readState(testDir)).rejects.toThrow();
    });
  });

  describe("writeState", () => {
    it("creates state directory if it does not exist", async () => {
      await rm(join(testDir, "bmalph/state"), { recursive: true, force: true });

      const state: BmalphState = {
        currentPhase: 1,
        status: "planning",
        startedAt: "2025-01-01T00:00:00.000Z",
        lastUpdated: "2025-01-01T00:00:00.000Z",
      };
      await writeState(testDir, state);

      const result = await readState(testDir);
      expect(result).toEqual(state);
    });

    it("overwrites existing state atomically", async () => {
      const state1: BmalphState = {
        currentPhase: 1,
        status: "planning",
        startedAt: "2025-01-01T00:00:00.000Z",
        lastUpdated: "2025-01-01T00:00:00.000Z",
      };
      await writeState(testDir, state1);

      const state2: BmalphState = {
        currentPhase: 3,
        status: "implementing",
        startedAt: "2025-01-01T00:00:00.000Z",
        lastUpdated: "2025-01-02T00:00:00.000Z",
      };
      await writeState(testDir, state2);

      const result = await readState(testDir);
      expect(result).toEqual(state2);
    });
  });

  describe("getPhaseLabel", () => {
    it("returns correct labels", () => {
      expect(getPhaseLabel(1)).toBe("Analysis");
      expect(getPhaseLabel(2)).toBe("Planning");
      expect(getPhaseLabel(3)).toBe("Solutioning");
      expect(getPhaseLabel(4)).toBe("Implementation");
    });

    it("returns Unknown for invalid phase", () => {
      expect(getPhaseLabel(5)).toBe("Unknown");
    });
  });

  describe("getPhaseInfo", () => {
    it("returns correct info for phase 1 (Analysis)", () => {
      const info = getPhaseInfo(1);
      expect(info.name).toBe("Analysis");
      expect(info.agent).toBe("Analyst");
      expect(info.commands).toHaveLength(6);
      expect(info.commands[0].code).toBe("BP");
    });

    it("returns correct info for phase 2 (Planning)", () => {
      const info = getPhaseInfo(2);
      expect(info.name).toBe("Planning");
      expect(info.agent).toBe("PM (John)");
      expect(info.commands.find((c) => c.code === "CP")?.required).toBe(true);
    });

    it("returns correct info for phase 3 (Solutioning)", () => {
      const info = getPhaseInfo(3);
      expect(info.name).toBe("Solutioning");
      expect(info.agent).toBe("Architect");
      expect(info.commands.find((c) => c.code === "CA")?.required).toBe(true);
      expect(info.commands.find((c) => c.code === "CE")?.required).toBe(true);
      expect(info.commands.find((c) => c.code === "IR")?.required).toBe(true);
    });

    it("returns correct info for phase 4 (Implementation)", () => {
      const info = getPhaseInfo(4);
      expect(info.name).toBe("Implementation");
      expect(info.agent).toBe("Developer (Amelia)");
      expect(info.commands).toHaveLength(0);
    });

    it("returns unknown info for invalid phase", () => {
      const info = getPhaseInfo(99);
      expect(info.name).toBe("Unknown");
      expect(info.agent).toBe("Unknown");
    });
  });

  describe("readRalphStatus", () => {
    it("returns default status when no file exists", async () => {
      const status = await readRalphStatus(testDir);
      expect(status).toEqual({
        loopCount: 0,
        status: "not_started",
        tasksCompleted: 0,
        tasksTotal: 0,
      });
    });

    it("reads status from file", async () => {
      await mkdir(join(testDir, ".ralph"), { recursive: true });
      const statusData = {
        loopCount: 5,
        status: "running",
        tasksCompleted: 3,
        tasksTotal: 10,
      };
      await writeFile(
        join(testDir, ".ralph/status.json"),
        JSON.stringify(statusData),
      );

      const result = await readRalphStatus(testDir);
      expect(result).toEqual(statusData);
    });
  });
});
