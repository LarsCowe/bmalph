import { describe, it, expect, afterEach } from "vitest";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  readDashboardState,
  readLoopInfo,
  readCircuitBreakerInfo,
  readStoryProgress,
  readAnalysisInfo,
  readExecutionProgress,
  readSessionInfo,
  readRecentLogs,
  readLiveLog,
} from "../../src/watch/state-reader.js";

function makeTmpDir(): string {
  return join(tmpdir(), `bmalph-watch-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

async function writeJson(path: string, data: unknown): Promise<void> {
  await writeFile(path, JSON.stringify(data));
}

describe("state-reader", () => {
  let testDir: string;

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Windows file locking
    }
  });

  describe("readDashboardState", () => {
    it("returns empty state when no .ralph directory exists", async () => {
      testDir = makeTmpDir();
      await mkdir(testDir, { recursive: true });

      const state = await readDashboardState(testDir);

      expect(state.loop).toBeNull();
      expect(state.circuitBreaker).toBeNull();
      expect(state.stories).toBeNull();
      expect(state.analysis).toBeNull();
      expect(state.execution).toBeNull();
      expect(state.session).toBeNull();
      expect(state.recentLogs).toEqual([]);
      expect(state.lastUpdated).toBeInstanceOf(Date);
    });
  });

  describe("readLoopInfo", () => {
    it("reads camelCase status.json correctly", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      await writeJson(join(ralphDir, "status.json"), {
        loopCount: 4,
        status: "running",
        tasksCompleted: 1,
        tasksTotal: 5,
      });

      const info = await readLoopInfo(testDir);

      expect(info).not.toBeNull();
      expect(info!.loopCount).toBe(4);
      expect(info!.status).toBe("running");
      expect(info!.lastAction).toBe("");
      expect(info!.callsMadeThisHour).toBe(0);
      expect(info!.maxCallsPerHour).toBe(0);
    });

    it("reads status.json correctly", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      await writeJson(join(ralphDir, "status.json"), {
        loop_count: 12,
        status: "running",
        calls_made_this_hour: 23,
        max_calls_per_hour: 100,
        last_action: "executing",
      });

      const info = await readLoopInfo(testDir);

      expect(info).not.toBeNull();
      expect(info!.loopCount).toBe(12);
      expect(info!.status).toBe("running");
      expect(info!.lastAction).toBe("executing");
      expect(info!.callsMadeThisHour).toBe(23);
      expect(info!.maxCallsPerHour).toBe(100);
    });

    it("returns null when status.json is missing", async () => {
      testDir = makeTmpDir();
      await mkdir(testDir, { recursive: true });

      const info = await readLoopInfo(testDir);

      expect(info).toBeNull();
    });

    it("handles corrupt JSON gracefully", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      await writeFile(join(ralphDir, "status.json"), "{ not valid json !!!");

      const info = await readLoopInfo(testDir);

      expect(info).toBeNull();
    });

    it("returns null when snake_case payload is missing status", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      await writeJson(join(ralphDir, "status.json"), {
        loop_count: 5,
        calls_made_this_hour: 10,
      });

      const info = await readLoopInfo(testDir);

      expect(info).toBeNull();
    });

    it("returns null when snake_case loop fields are malformed", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      await writeJson(join(ralphDir, "status.json"), {
        loop_count: "oops",
        status: "running",
        tasks_completed: 2,
        tasks_total: 4,
      });

      const info = await readLoopInfo(testDir);

      expect(info).toBeNull();
    });

    it("returns null when snake_case payload only contains metadata", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      await writeJson(join(ralphDir, "status.json"), {
        calls_made_this_hour: 5,
        max_calls_per_hour: 100,
        last_action: "retrying",
      });

      const info = await readLoopInfo(testDir);

      expect(info).toBeNull();
    });

    it("returns null when snake_case status is unrecognized", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      await writeJson(join(ralphDir, "status.json"), {
        loop_count: 7,
        status: "mystery",
        tasks_completed: 2,
        tasks_total: 4,
      });

      const info = await readLoopInfo(testDir);

      expect(info).toBeNull();
    });

    it("normalizes paused snake_case status to blocked", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      await writeJson(join(ralphDir, "status.json"), {
        loop_count: 7,
        status: "paused",
        calls_made_this_hour: 5,
        max_calls_per_hour: 100,
        last_action: "api_limit",
      });

      const info = await readLoopInfo(testDir);

      expect(info).not.toBeNull();
      expect(info!.status).toBe("blocked");
      expect(info!.lastAction).toBe("api_limit");
    });

    it("normalizes error snake_case status to blocked", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      await writeJson(join(ralphDir, "status.json"), {
        loop_count: 7,
        status: "error",
        calls_made_this_hour: 5,
        max_calls_per_hour: 100,
        last_action: "failed",
      });

      const info = await readLoopInfo(testDir);

      expect(info).not.toBeNull();
      expect(info!.status).toBe("blocked");
      expect(info!.lastAction).toBe("failed");
    });
  });

  describe("readCircuitBreakerInfo", () => {
    it("reads circuit breaker with CLOSED state", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      await writeJson(join(ralphDir, ".circuit_breaker_state"), {
        state: "CLOSED",
        consecutive_no_progress: 0,
        total_opens: 1,
      });

      const info = await readCircuitBreakerInfo(testDir);

      expect(info).not.toBeNull();
      expect(info!.state).toBe("CLOSED");
      expect(info!.consecutiveNoProgress).toBe(0);
      expect(info!.totalOpens).toBe(1);
      expect(info!.reason).toBeUndefined();
    });

    it("reads circuit breaker with OPEN state and reason", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      await writeJson(join(ralphDir, ".circuit_breaker_state"), {
        state: "OPEN",
        consecutive_no_progress: 5,
        total_opens: 2,
        reason: "No progress detected",
      });

      const info = await readCircuitBreakerInfo(testDir);

      expect(info).not.toBeNull();
      expect(info!.state).toBe("OPEN");
      expect(info!.consecutiveNoProgress).toBe(5);
      expect(info!.totalOpens).toBe(2);
      expect(info!.reason).toBe("No progress detected");
    });

    it("returns null when circuit breaker file is missing", async () => {
      testDir = makeTmpDir();
      await mkdir(testDir, { recursive: true });

      const info = await readCircuitBreakerInfo(testDir);

      expect(info).toBeNull();
    });

    it("returns null when state value is invalid", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      await writeJson(join(ralphDir, ".circuit_breaker_state"), {
        state: "INVALID",
        consecutive_no_progress: 3,
        total_opens: 1,
      });

      const info = await readCircuitBreakerInfo(testDir);

      expect(info).toBeNull();
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

      const info = await readCircuitBreakerInfo(testDir);

      expect(info).not.toBeNull();
      expect(info!.totalOpens).toBe(4);
    });

    it("returns null when Ralph total_opens is malformed even if a camelCase mirror exists", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      await writeJson(join(ralphDir, ".circuit_breaker_state"), {
        state: "CLOSED",
        consecutive_no_progress: 1,
        total_opens: "oops",
        totalOpens: 2,
      });

      const info = await readCircuitBreakerInfo(testDir);

      expect(info).toBeNull();
    });
  });

  describe("readStoryProgress", () => {
    const fixPlanContent = `# Ralph Fix Plan

## Stories to Implement

### Epic 1
- [x] Story 1.1: Setup database schema
- [x] Story 1.2: Create migration scripts
- [ ] Story 2.1: Implement user service
- [ ] Story 2.2: Add authentication
`;

    it("reads fix plan progress", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      await writeFile(join(ralphDir, "@fix_plan.md"), fixPlanContent);

      const progress = await readStoryProgress(testDir);

      expect(progress).not.toBeNull();
      expect(progress!.completed).toBe(2);
      expect(progress!.total).toBe(4);
      expect(progress!.nextStory).toBe("Story 2.1: Implement user service");
    });

    it("reads fix plan with all stories completed", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      await writeFile(
        join(ralphDir, "@fix_plan.md"),
        `# Ralph Fix Plan

## Stories to Implement

- [x] Story 1.1: Setup database schema
- [x] Story 1.2: Create migration scripts
`
      );

      const progress = await readStoryProgress(testDir);

      expect(progress).not.toBeNull();
      expect(progress!.completed).toBe(2);
      expect(progress!.total).toBe(2);
      expect(progress!.nextStory).toBeNull();
    });

    it("reads fix plan with no stories", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      await writeFile(join(ralphDir, "@fix_plan.md"), "");

      const progress = await readStoryProgress(testDir);

      expect(progress).not.toBeNull();
      expect(progress!.completed).toBe(0);
      expect(progress!.total).toBe(0);
      expect(progress!.nextStory).toBeNull();
    });

    it("returns null when fix plan is missing", async () => {
      testDir = makeTmpDir();
      await mkdir(testDir, { recursive: true });

      const progress = await readStoryProgress(testDir);

      expect(progress).toBeNull();
    });
  });

  describe("readAnalysisInfo", () => {
    it("reads response analysis", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      await writeJson(join(ralphDir, ".response_analysis"), {
        analysis: {
          files_modified: 3,
          format_confidence: 70,
          confidence_score: 72,
          is_test_only: false,
          is_stuck: false,
          exit_signal: false,
          tasks_completed_this_loop: 1,
          fix_plan_completed_delta: 1,
          has_progress_tracking_mismatch: false,
          has_permission_denials: false,
          permission_denial_count: 0,
        },
      });

      const info = await readAnalysisInfo(testDir);

      expect(info).not.toBeNull();
      expect(info!.filesModified).toBe(3);
      expect(info!.formatConfidence).toBe(70);
      expect(info!.confidenceScore).toBe(72);
      expect(info!.isTestOnly).toBe(false);
      expect(info!.isStuck).toBe(false);
      expect(info!.exitSignal).toBe(false);
      expect(info!.tasksCompletedThisLoop).toBe(1);
      expect(info!.fixPlanCompletedDelta).toBe(1);
      expect(info!.hasProgressTrackingMismatch).toBe(false);
      expect(info!.hasPermissionDenials).toBe(false);
      expect(info!.permissionDenialCount).toBe(0);
    });

    it("defaults missing progress tracking fields to safe values", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      await writeJson(join(ralphDir, ".response_analysis"), {
        analysis: {
          files_modified: 2,
          confidence_score: 50,
          is_test_only: false,
          is_stuck: false,
          exit_signal: false,
        },
      });

      const info = await readAnalysisInfo(testDir);

      expect(info).not.toBeNull();
      expect(info!.formatConfidence).toBe(0);
      expect(info!.tasksCompletedThisLoop).toBe(0);
      expect(info!.fixPlanCompletedDelta).toBe(0);
      expect(info!.hasProgressTrackingMismatch).toBe(false);
    });

    it("returns null when response analysis is missing", async () => {
      testDir = makeTmpDir();
      await mkdir(testDir, { recursive: true });

      const info = await readAnalysisInfo(testDir);

      expect(info).toBeNull();
    });

    it("returns null when analysis field is not an object", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      await writeJson(join(ralphDir, ".response_analysis"), {
        analysis: "not-an-object",
      });

      const info = await readAnalysisInfo(testDir);

      expect(info).toBeNull();
    });
  });

  describe("readExecutionProgress", () => {
    it("reads execution progress with all fields", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      await writeJson(join(ralphDir, "progress.json"), {
        status: "executing",
        elapsed_seconds: 45,
        indicator: "⠙",
        last_output: "Reading file src/index.ts",
        timestamp: "2026-03-13 10:00:00",
      });

      const progress = await readExecutionProgress(testDir);

      expect(progress).not.toBeNull();
      expect(progress!.status).toBe("executing");
      expect(progress!.elapsedSeconds).toBe(45);
      expect(progress!.indicator).toBe("⠙");
      expect(progress!.lastOutput).toBe("Reading file src/index.ts");
    });

    it("defaults indicator and lastOutput when fields are missing", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      await writeJson(join(ralphDir, "progress.json"), {
        status: "executing",
        elapsed_seconds: 45,
      });

      const progress = await readExecutionProgress(testDir);

      expect(progress).not.toBeNull();
      expect(progress!.status).toBe("executing");
      expect(progress!.elapsedSeconds).toBe(45);
      expect(progress!.indicator).toBe("⠋");
      expect(progress!.lastOutput).toBe("");
    });

    it("returns null when status is idle", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      await writeJson(join(ralphDir, "progress.json"), {
        status: "idle",
        elapsed_seconds: 0,
      });

      const progress = await readExecutionProgress(testDir);

      expect(progress).toBeNull();
    });

    it("returns null when progress.json is missing", async () => {
      testDir = makeTmpDir();
      await mkdir(testDir, { recursive: true });

      const progress = await readExecutionProgress(testDir);

      expect(progress).toBeNull();
    });
  });

  describe("readSessionInfo", () => {
    it("reads session info", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      await writeJson(join(ralphDir, ".ralph_session"), {
        session_id: "abc-123",
        created_at: "2026-02-25T10:00:00Z",
        last_used: "2026-02-25T12:15:00Z",
      });

      const info = await readSessionInfo(testDir);

      expect(info).not.toBeNull();
      expect(info!.createdAt).toBe("2026-02-25T10:00:00Z");
      expect(info!.lastUsed).toBe("2026-02-25T12:15:00Z");
    });

    it("returns null when session file is missing", async () => {
      testDir = makeTmpDir();
      await mkdir(testDir, { recursive: true });

      const info = await readSessionInfo(testDir);

      expect(info).toBeNull();
    });

    it("returns null when session file contains a reset payload", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      await writeJson(join(ralphDir, ".ralph_session"), {
        session_id: "",
        created_at: "",
        last_used: "",
        reset_at: "2026-02-25T12:15:00Z",
        reset_reason: "manual_reset",
      });

      const info = await readSessionInfo(testDir);

      expect(info).toBeNull();
    });

    it("returns null when session file contains the new inactive payload", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      await writeJson(join(ralphDir, ".ralph_session"), {
        session_id: "",
        reset_at: "2026-02-25T12:15:00Z",
        reset_reason: "manual_reset",
      });

      const info = await readSessionInfo(testDir);

      expect(info).toBeNull();
    });

    it("returns null when session_id is empty even if created_at looks valid", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      await writeJson(join(ralphDir, ".ralph_session"), {
        session_id: "",
        created_at: "2026-02-25T10:00:00Z",
        last_used: "2026-02-25T12:15:00Z",
      });

      const info = await readSessionInfo(testDir);

      expect(info).toBeNull();
    });

    it("returns null when created_at is missing", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      await writeJson(join(ralphDir, ".ralph_session"), {
        session_id: "abc-123",
        last_used: "2026-02-25T12:15:00Z",
      });

      const info = await readSessionInfo(testDir);

      expect(info).toBeNull();
    });

    it("returns null when created_at cannot be parsed", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      await writeJson(join(ralphDir, ".ralph_session"), {
        session_id: "abc-123",
        created_at: "not-a-date",
        last_used: "2026-02-25T12:15:00Z",
      });

      const info = await readSessionInfo(testDir);

      expect(info).toBeNull();
    });
  });

  describe("readRecentLogs", () => {
    it("reads and parses recent log lines", async () => {
      testDir = makeTmpDir();
      const logsDir = join(testDir, ".ralph", "logs");
      await mkdir(logsDir, { recursive: true });

      const logLines = [
        "[2026-02-25 14:20:00] [INFO] Loop #10 started",
        "[2026-02-25 14:20:15] [DEBUG] Reading fix plan",
        "[2026-02-25 14:20:30] [INFO] Executing story 2.1",
        "[2026-02-25 14:21:00] [WARN] Slow response detected",
        "[2026-02-25 14:21:30] [INFO] Loop #11 started",
        "[2026-02-25 14:22:00] [INFO] Executing story 2.2",
        "[2026-02-25 14:22:30] [ERROR] Test failure in auth module",
        "[2026-02-25 14:23:00] [INFO] Loop #12 started",
        "[2026-02-25 14:23:01] [INFO] Retrying story 2.2",
        "[2026-02-25 14:23:30] [INFO] Tests passing",
      ];
      await writeFile(join(logsDir, "ralph.log"), logLines.join("\n"));

      const entries = await readRecentLogs(testDir);

      expect(entries).toHaveLength(8);
      expect(entries[0]!.timestamp).toBe("2026-02-25 14:20:30");
      expect(entries[0]!.level).toBe("INFO");
      expect(entries[0]!.message).toBe("Executing story 2.1");
      expect(entries[7]!.timestamp).toBe("2026-02-25 14:23:30");
      expect(entries[7]!.level).toBe("INFO");
      expect(entries[7]!.message).toBe("Tests passing");
    });

    it("returns empty array when log file is missing", async () => {
      testDir = makeTmpDir();
      await mkdir(testDir, { recursive: true });

      const entries = await readRecentLogs(testDir);

      expect(entries).toEqual([]);
    });

    it("skips unparseable lines", async () => {
      testDir = makeTmpDir();
      const logsDir = join(testDir, ".ralph", "logs");
      await mkdir(logsDir, { recursive: true });

      const logLines = [
        "[2026-02-25 14:20:00] [INFO] Valid line",
        "this is not a valid log line",
        "[2026-02-25 14:20:30] [INFO] Another valid line",
      ];
      await writeFile(join(logsDir, "ralph.log"), logLines.join("\n"));

      const entries = await readRecentLogs(testDir);

      expect(entries).toHaveLength(2);
      expect(entries[0]!.message).toBe("Valid line");
      expect(entries[1]!.message).toBe("Another valid line");
    });

    it("respects custom maxLines parameter", async () => {
      testDir = makeTmpDir();
      const logsDir = join(testDir, ".ralph", "logs");
      await mkdir(logsDir, { recursive: true });

      const logLines = [
        "[2026-02-25 14:20:00] [INFO] Line one",
        "[2026-02-25 14:20:01] [INFO] Line two",
        "[2026-02-25 14:20:02] [INFO] Line three",
        "[2026-02-25 14:20:03] [INFO] Line four",
        "[2026-02-25 14:20:04] [INFO] Line five",
      ];
      await writeFile(join(logsDir, "ralph.log"), logLines.join("\n"));

      const entries = await readRecentLogs(testDir, 3);

      expect(entries).toHaveLength(3);
      expect(entries[0]!.message).toBe("Line three");
      expect(entries[2]!.message).toBe("Line five");
    });

    it("returns empty array when log file is empty", async () => {
      testDir = makeTmpDir();
      const logsDir = join(testDir, ".ralph", "logs");
      await mkdir(logsDir, { recursive: true });
      await writeFile(join(logsDir, "ralph.log"), "");

      const entries = await readRecentLogs(testDir);

      expect(entries).toEqual([]);
    });

    it("handles CRLF line endings", async () => {
      testDir = makeTmpDir();
      const logsDir = join(testDir, ".ralph", "logs");
      await mkdir(logsDir, { recursive: true });

      const logLines = [
        "[2026-02-25 14:20:00] [INFO] First line",
        "[2026-02-25 14:20:01] [INFO] Second line",
      ];
      await writeFile(join(logsDir, "ralph.log"), logLines.join("\r\n"));

      const entries = await readRecentLogs(testDir);

      expect(entries).toHaveLength(2);
      expect(entries[0]!.message).toBe("First line");
      expect(entries[1]!.message).toBe("Second line");
    });
  });

  describe("readDashboardState (integration)", () => {
    it("handles partial state with only some files present", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });

      await writeJson(join(ralphDir, "status.json"), {
        loop_count: 5,
        status: "running",
        calls_made_this_hour: 10,
        max_calls_per_hour: 100,
        last_action: "analyzing",
      });

      await writeFile(
        join(ralphDir, "@fix_plan.md"),
        `- [x] Story 1.1: Setup database schema
- [ ] Story 1.2: Create migration scripts
`
      );

      const state = await readDashboardState(testDir);

      expect(state.loop).not.toBeNull();
      expect(state.loop!.loopCount).toBe(5);
      expect(state.loop!.status).toBe("running");

      expect(state.stories).not.toBeNull();
      expect(state.stories!.completed).toBe(1);
      expect(state.stories!.total).toBe(2);
      expect(state.stories!.nextStory).toBe("Story 1.2: Create migration scripts");

      expect(state.circuitBreaker).toBeNull();
      expect(state.analysis).toBeNull();
      expect(state.execution).toBeNull();
      expect(state.session).toBeNull();
      expect(state.recentLogs).toEqual([]);
      expect(state.liveLog).toEqual([]);
    });
  });

  describe("readLiveLog", () => {
    it("reads live log lines", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      const lines = [
        "=== Loop #5 - 2026-03-13 10:00:00 ===",
        "Analyzing codebase...",
        "Running tests",
        "Fixing issue in src/index.ts",
        "Tests passing",
        "Writing output",
      ];
      await writeFile(join(ralphDir, "live.log"), lines.join("\n"));

      const result = await readLiveLog(testDir);

      expect(result).toHaveLength(5);
      expect(result[0]).toBe("Analyzing codebase...");
      expect(result[4]).toBe("Writing output");
    });

    it("returns empty array when live.log is missing", async () => {
      testDir = makeTmpDir();
      await mkdir(testDir, { recursive: true });

      const result = await readLiveLog(testDir);

      expect(result).toEqual([]);
    });

    it("returns empty array when live.log is empty", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      await writeFile(join(ralphDir, "live.log"), "");

      const result = await readLiveLog(testDir);

      expect(result).toEqual([]);
    });

    it("handles CRLF line endings in live.log", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      const lines = ["First output line", "Second output line"];
      await writeFile(join(ralphDir, "live.log"), lines.join("\r\n"));

      const result = await readLiveLog(testDir);

      expect(result).toHaveLength(2);
      expect(result[0]).toBe("First output line");
      expect(result[1]).toBe("Second output line");
    });
  });

  describe("ralphCompleted", () => {
    it("is true when Ralph status is completed", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      await writeJson(join(ralphDir, "status.json"), {
        loop_count: 15,
        status: "completed",
        tasks_completed: 10,
        tasks_total: 10,
      });

      const state = await readDashboardState(testDir);

      expect(state.ralphCompleted).toBe(true);
    });

    it("is true when Ralph status is graceful_exit", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      await writeJson(join(ralphDir, "status.json"), {
        loop_count: 12,
        status: "graceful_exit",
        tasks_completed: 8,
        tasks_total: 8,
      });

      const state = await readDashboardState(testDir);

      expect(state.ralphCompleted).toBe(true);
    });

    it("is false when Ralph is still running", async () => {
      testDir = makeTmpDir();
      const ralphDir = join(testDir, ".ralph");
      await mkdir(ralphDir, { recursive: true });
      await writeJson(join(ralphDir, "status.json"), {
        loop_count: 5,
        status: "running",
        tasks_completed: 3,
        tasks_total: 10,
      });

      const state = await readDashboardState(testDir);

      expect(state.ralphCompleted).toBe(false);
    });

    it("is false when no Ralph status exists", async () => {
      testDir = makeTmpDir();
      await mkdir(testDir, { recursive: true });

      const state = await readDashboardState(testDir);

      expect(state.ralphCompleted).toBe(false);
    });
  });
});
