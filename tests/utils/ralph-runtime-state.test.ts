import { describe, it, expect, afterEach } from "vitest";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  readRalphRuntimeStatus,
  readRalphRuntimeSession,
  readRalphCircuitBreaker,
} from "../../src/utils/ralph-runtime-state.js";

function makeTmpDir(): string {
  return join(
    tmpdir(),
    `bmalph-ralph-runtime-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

async function writeJson(path: string, data: unknown): Promise<void> {
  await writeFile(path, JSON.stringify(data));
}

describe("ralph-runtime-state", () => {
  let testDir: string;

  afterEach(async () => {
    if (!testDir) return;

    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Windows file locking
    }
  });

  describe("readRalphRuntimeStatus", () => {
    it("returns missing when status.json does not exist", async () => {
      testDir = makeTmpDir();
      await mkdir(testDir, { recursive: true });

      const result = await readRalphRuntimeStatus(testDir);

      expect(result.kind).toBe("missing");
    });

    it("reads valid camelCase status and defaults runtime metadata", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      await writeJson(join(ralphDir, "status.json"), {
        loopCount: 6,
        status: "running",
        tasksCompleted: 2,
        tasksTotal: 8,
      });

      const result = await readRalphRuntimeStatus(testDir);

      expect(result).toEqual({
        kind: "ok",
        path: join(testDir, ".ralph", "status.json"),
        value: {
          loopCount: 6,
          status: "running",
          tasksCompleted: 2,
          tasksTotal: 8,
          callsMadeThisHour: 0,
          maxCallsPerHour: 0,
          lastAction: "",
        },
      });
    });

    it("reads valid snake_case status and normalizes shared fields", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      await writeJson(join(ralphDir, "status.json"), {
        loop_count: 12,
        status: "success",
        tasks_completed: 9,
        tasks_total: 9,
        calls_made_this_hour: 41,
        max_calls_per_hour: 120,
        last_action: "running tests",
      });

      const result = await readRalphRuntimeStatus(testDir);

      expect(result).toEqual({
        kind: "ok",
        path: join(testDir, ".ralph", "status.json"),
        value: {
          loopCount: 12,
          status: "completed",
          tasksCompleted: 9,
          tasksTotal: 9,
          callsMadeThisHour: 41,
          maxCallsPerHour: 120,
          lastAction: "running tests",
        },
      });
    });

    it("normalizes a valid Ralph paused status to blocked", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      await writeJson(join(ralphDir, "status.json"), {
        loop_count: 12,
        status: "paused",
        calls_made_this_hour: 41,
        max_calls_per_hour: 120,
        last_action: "api_limit",
      });

      const result = await readRalphRuntimeStatus(testDir);

      expect(result).toEqual({
        kind: "ok",
        path: join(testDir, ".ralph", "status.json"),
        value: {
          loopCount: 12,
          status: "blocked",
          tasksCompleted: 0,
          tasksTotal: 0,
          callsMadeThisHour: 41,
          maxCallsPerHour: 120,
          lastAction: "api_limit",
        },
      });
    });

    it("normalizes a valid Ralph error status to blocked", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      await writeJson(join(ralphDir, "status.json"), {
        loop_count: 12,
        status: "error",
        calls_made_this_hour: 41,
        max_calls_per_hour: 120,
        last_action: "failed",
      });

      const result = await readRalphRuntimeStatus(testDir);

      expect(result).toEqual({
        kind: "ok",
        path: join(testDir, ".ralph", "status.json"),
        value: {
          loopCount: 12,
          status: "blocked",
          tasksCompleted: 0,
          tasksTotal: 0,
          callsMadeThisHour: 41,
          maxCallsPerHour: 120,
          lastAction: "failed",
        },
      });
    });

    it("accepts valid snake_case status with extra camelCase runtime metadata", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      await writeJson(join(ralphDir, "status.json"), {
        loop_count: 5,
        status: "running",
        calls_made_this_hour: 12,
        max_calls_per_hour: 100,
        lastAction: "mirror",
      });

      const result = await readRalphRuntimeStatus(testDir);

      expect(result).toEqual({
        kind: "ok",
        path: join(testDir, ".ralph", "status.json"),
        value: {
          loopCount: 5,
          status: "running",
          tasksCompleted: 0,
          tasksTotal: 0,
          callsMadeThisHour: 12,
          maxCallsPerHour: 100,
          lastAction: "mirror",
        },
      });
    });

    it("prefers snake_case runtime metadata when mixed payloads contain conflicting values", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      await writeJson(join(ralphDir, "status.json"), {
        loop_count: 5,
        status: "running",
        calls_made_this_hour: 12,
        max_calls_per_hour: 100,
        callsMadeThisHour: 0,
        last_action: "executing",
        lastAction: "stale",
      });

      const result = await readRalphRuntimeStatus(testDir);

      expect(result).toEqual({
        kind: "ok",
        path: join(testDir, ".ralph", "status.json"),
        value: {
          loopCount: 5,
          status: "running",
          tasksCompleted: 0,
          tasksTotal: 0,
          callsMadeThisHour: 12,
          maxCallsPerHour: 100,
          lastAction: "executing",
        },
      });
    });

    it("treats malformed snake_case metadata as invalid even when a camelCase mirror exists", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      await writeJson(join(ralphDir, "status.json"), {
        loop_count: 5,
        status: "running",
        calls_made_this_hour: "oops",
        callsMadeThisHour: 12,
        max_calls_per_hour: 100,
      });

      const result = await readRalphRuntimeStatus(testDir);

      expect(result.kind).toBe("invalid");
    });

    it("treats malformed camelCase metadata as invalid even when a snake_case mirror exists", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      await writeJson(join(ralphDir, "status.json"), {
        loopCount: 5,
        status: "running",
        tasksCompleted: 1,
        tasksTotal: 2,
        callsMadeThisHour: "oops",
        calls_made_this_hour: 12,
      });

      const result = await readRalphRuntimeStatus(testDir);

      expect(result.kind).toBe("invalid");
    });

    it("treats malformed objects as invalid instead of normalizing fallback defaults", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      await writeFile(join(ralphDir, "status.json"), '{"loopCount":"not-a-number"}');

      const result = await readRalphRuntimeStatus(testDir);

      expect(result.kind).toBe("invalid");
    });

    it("treats mixed-format payloads with invalid camelCase loop fields as invalid", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      await writeJson(join(ralphDir, "status.json"), {
        loopCount: "oops",
        status: "running",
        last_action: "retrying",
      });

      const result = await readRalphRuntimeStatus(testDir);

      expect(result.kind).toBe("invalid");
    });

    it("treats malformed snake_case API counters as invalid", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      await writeJson(join(ralphDir, "status.json"), {
        loop_count: 3,
        status: "running",
        calls_made_this_hour: "oops",
        max_calls_per_hour: 100,
      });

      const result = await readRalphRuntimeStatus(testDir);

      expect(result.kind).toBe("invalid");
    });

    it("treats malformed snake_case loop fields as invalid", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      await writeJson(join(ralphDir, "status.json"), {
        loop_count: "oops",
        status: "running",
        tasks_completed: 2,
        tasks_total: 4,
        calls_made_this_hour: 5,
        max_calls_per_hour: 100,
      });

      const result = await readRalphRuntimeStatus(testDir);

      expect(result.kind).toBe("invalid");
    });

    it("treats metadata-only snake_case payloads as invalid", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      await writeJson(join(ralphDir, "status.json"), {
        calls_made_this_hour: 5,
        max_calls_per_hour: 100,
        last_action: "retrying",
      });

      const result = await readRalphRuntimeStatus(testDir);

      expect(result.kind).toBe("invalid");
    });

    it("treats snake_case payloads without status as invalid", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      await writeJson(join(ralphDir, "status.json"), {
        loop_count: 7,
        calls_made_this_hour: 5,
        max_calls_per_hour: 100,
      });

      const result = await readRalphRuntimeStatus(testDir);

      expect(result.kind).toBe("invalid");
    });

    it("treats a bare shared status field as invalid", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      await writeJson(join(ralphDir, "status.json"), {
        status: "running",
      });

      const result = await readRalphRuntimeStatus(testDir);

      expect(result.kind).toBe("invalid");
    });

    it("treats unrecognized snake_case statuses as invalid", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      await writeJson(join(ralphDir, "status.json"), {
        loop_count: 7,
        status: "mystery",
        tasks_completed: 2,
        tasks_total: 4,
      });

      const result = await readRalphRuntimeStatus(testDir);

      expect(result.kind).toBe("invalid");
    });

    it("treats mixed core keys from both formats as invalid", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      await writeJson(join(ralphDir, "status.json"), {
        loop_count: 7,
        status: "running",
        tasksCompleted: 2,
        max_calls_per_hour: 100,
      });

      const result = await readRalphRuntimeStatus(testDir);

      expect(result.kind).toBe("invalid");
    });

    it("returns invalid for non-JSON content", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      await writeFile(join(ralphDir, "status.json"), "{ not valid json !!!");

      const result = await readRalphRuntimeStatus(testDir);

      expect(result.kind).toBe("invalid");
    });

    it("returns unreadable when status.json is not a readable file", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(join(ralphDir, "status.json"), { recursive: true });

      const result = await readRalphRuntimeStatus(testDir);

      expect(result.kind).toBe("unreadable");
    });
  });

  describe("readRalphRuntimeSession", () => {
    it("reads a valid Ralph session", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      await writeJson(join(ralphDir, ".ralph_session"), {
        session_id: "sess-123",
        created_at: "2026-03-01T10:00:00.000Z",
        last_used: "2026-03-01T10:05:00.000Z",
      });

      const result = await readRalphRuntimeSession(testDir);

      expect(result).toEqual({
        kind: "ok",
        path: join(testDir, ".ralph", ".ralph_session"),
        value: {
          session_id: "sess-123",
          created_at: "2026-03-01T10:00:00.000Z",
          last_used: "2026-03-01T10:05:00.000Z",
        },
      });
    });
  });

  describe("readRalphCircuitBreaker", () => {
    it("reads a valid circuit breaker and defaults total opens", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      await writeJson(join(ralphDir, ".circuit_breaker_state"), {
        state: "CLOSED",
        consecutive_no_progress: 1,
      });

      const result = await readRalphCircuitBreaker(testDir);

      expect(result).toEqual({
        kind: "ok",
        path: join(testDir, ".ralph", ".circuit_breaker_state"),
        value: {
          state: "CLOSED",
          consecutiveNoProgress: 1,
          totalOpens: 0,
          reason: undefined,
        },
      });
    });

    it("prefers Ralph total_opens over conflicting camelCase mirrors", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      await writeJson(join(ralphDir, ".circuit_breaker_state"), {
        state: "CLOSED",
        consecutive_no_progress: 1,
        total_opens: 4,
        totalOpens: 2,
      });

      const result = await readRalphCircuitBreaker(testDir);

      expect(result).toEqual({
        kind: "ok",
        path: join(testDir, ".ralph", ".circuit_breaker_state"),
        value: {
          state: "CLOSED",
          consecutiveNoProgress: 1,
          totalOpens: 4,
          reason: undefined,
        },
      });
    });

    it("treats malformed Ralph total_opens as invalid even when a camelCase mirror exists", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      await writeJson(join(ralphDir, ".circuit_breaker_state"), {
        state: "CLOSED",
        consecutive_no_progress: 1,
        total_opens: "oops",
        totalOpens: 2,
      });

      const result = await readRalphCircuitBreaker(testDir);

      expect(result.kind).toBe("invalid");
    });
  });
});
