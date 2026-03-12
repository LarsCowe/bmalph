import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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

import {
  renderDashboard,
  renderHeader,
  renderLoopPanel,
  renderCircuitBreakerPanel,
  renderStoriesPanel,
  renderAnalysisPanel,
  renderLogsPanel,
  renderLiveLogPanel,
  renderFooter,
  renderSideBySide,
  progressBar,
  formatSessionAge,
  formatCBState,
  formatElapsed,
} from "../../src/watch/renderer.js";
import type {
  DashboardState,
  LoopInfo,
  CircuitBreakerInfo,
  StoryProgress,
  AnalysisInfo,
  LogEntry,
  ExecutionProgress,
  SessionInfo,
} from "../../src/watch/types.js";

const COLS = 62;

function makeState(overrides: Partial<DashboardState> = {}): DashboardState {
  return {
    loop: null,
    circuitBreaker: null,
    stories: null,
    analysis: null,
    execution: null,
    session: null,
    recentLogs: [],
    liveLog: [],
    ralphCompleted: false,
    lastUpdated: new Date("2026-02-25T14:25:15Z"),
    ...overrides,
  };
}

describe("renderer", () => {
  let realNow: typeof Date.now;

  beforeEach(() => {
    realNow = Date.now;
    vi.spyOn(Date, "now").mockReturnValue(new Date("2026-02-25T14:25:15Z").getTime());
  });

  afterEach(() => {
    Date.now = realNow;
    vi.restoreAllMocks();
  });

  describe("renderDashboard", () => {
    it("renders waiting message when all state fields are null", () => {
      const state = makeState();
      const output = renderDashboard(state, COLS);

      expect(output).toContain("Waiting for Ralph");
    });

    it("renders loop panel when loop info is present", () => {
      const loop: LoopInfo = {
        loopCount: 12,
        status: "running",
        lastAction: "testing",
        callsMadeThisHour: 23,
        maxCallsPerHour: 100,
      };
      const state = makeState({ loop });
      const output = renderDashboard(state, COLS);

      expect(output).toContain("Loop Status");
      expect(output).toContain("#12");
      expect(output).toContain("running");
    });

    it("renders footer with quit hint and update time", () => {
      const loop: LoopInfo = {
        loopCount: 1,
        status: "running",
        lastAction: "building",
        callsMadeThisHour: 5,
        maxCallsPerHour: 100,
      };
      const state = makeState({ loop });
      const output = renderDashboard(state, COLS);

      expect(output).toContain("q quit");
      expect(output).toContain("14:25:15");
    });

    it("handles partial state with only loop info present", () => {
      const loop: LoopInfo = {
        loopCount: 3,
        status: "running",
        lastAction: "analyzing",
        callsMadeThisHour: 10,
        maxCallsPerHour: 100,
      };
      const state = makeState({ loop });
      const output = renderDashboard(state, COLS);

      expect(output).toContain("Loop Status");
      expect(output).toContain("#3");
      expect(output).toContain("N/A");
    });
  });

  describe("renderHeader", () => {
    it("renders RALPH MONITOR centered in a double-line box", () => {
      const output = renderHeader(COLS);

      expect(output).toContain("RALPH MONITOR");
      expect(output).toContain("\u2554");
      expect(output).toContain("\u2557");
      expect(output).toContain("\u255A");
      expect(output).toContain("\u255D");
    });
  });

  describe("renderLoopPanel", () => {
    it("renders loop count, status, and API usage", () => {
      const loop: LoopInfo = {
        loopCount: 12,
        status: "running",
        lastAction: "testing",
        callsMadeThisHour: 23,
        maxCallsPerHour: 100,
      };
      const output = renderLoopPanel(loop, null, null, COLS);

      expect(output).toContain("Loop: #12");
      expect(output).toContain("Status: running");
      expect(output).toContain("API: 23/100 (23%)");
    });

    it("renders waiting message when loop is null", () => {
      const output = renderLoopPanel(null, null, null, COLS);

      expect(output).toContain("Status: waiting for data");
    });

    it("renders session age from createdAt", () => {
      const loop: LoopInfo = {
        loopCount: 5,
        status: "running",
        lastAction: "building",
        callsMadeThisHour: 10,
        maxCallsPerHour: 100,
      };
      const session: SessionInfo = {
        createdAt: "2026-02-25T12:10:15Z",
      };
      const output = renderLoopPanel(loop, null, session, COLS);

      expect(output).toContain("Session: 2h 15m");
    });

    it("renders execution status with elapsed time and spinner when execution is present", () => {
      const loop: LoopInfo = {
        loopCount: 7,
        status: "running",
        lastAction: "analyzing",
        callsMadeThisHour: 15,
        maxCallsPerHour: 100,
      };
      const execution: ExecutionProgress = {
        status: "executing",
        elapsedSeconds: 45,
        indicator: "⠙",
        lastOutput: "",
      };
      const output = renderLoopPanel(loop, execution, null, COLS);

      expect(output).toContain("executing");
      expect(output).toContain("45s");
      expect(output).toContain("⠙");
    });

    it("renders last output snippet when execution has lastOutput", () => {
      const loop: LoopInfo = {
        loopCount: 7,
        status: "running",
        lastAction: "analyzing",
        callsMadeThisHour: 15,
        maxCallsPerHour: 100,
      };
      const execution: ExecutionProgress = {
        status: "executing",
        elapsedSeconds: 120,
        indicator: "⠋",
        lastOutput: "Reading file src/index.ts",
      };
      const output = renderLoopPanel(loop, execution, null, COLS);

      expect(output).toContain("Reading file src/index.ts");
    });

    it("renders elapsed time in minutes when over 60 seconds", () => {
      const loop: LoopInfo = {
        loopCount: 7,
        status: "running",
        lastAction: "analyzing",
        callsMadeThisHour: 15,
        maxCallsPerHour: 100,
      };
      const execution: ExecutionProgress = {
        status: "executing",
        elapsedSeconds: 125,
        indicator: "⠋",
        lastOutput: "",
      };
      const output = renderLoopPanel(loop, execution, null, COLS);

      expect(output).toContain("2m 5s");
    });

    it("renders 0% API usage when maxCallsPerHour is zero", () => {
      const loop: LoopInfo = {
        loopCount: 1,
        status: "running",
        lastAction: "testing",
        callsMadeThisHour: 0,
        maxCallsPerHour: 0,
      };
      const output = renderLoopPanel(loop, null, null, COLS);

      expect(output).not.toContain("NaN");
      expect(output).toContain("0/0 (0%)");
    });
  });

  describe("renderCircuitBreakerPanel", () => {
    it("renders CLOSED state with counters", () => {
      const cb: CircuitBreakerInfo = {
        state: "CLOSED",
        consecutiveNoProgress: 0,
        totalOpens: 1,
      };
      const output = renderCircuitBreakerPanel(cb, COLS);

      expect(output).toContain("State: CLOSED");
      expect(output).toContain("No-progress: 0");
      expect(output).toContain("Opens: 1");
    });

    it("renders OPEN state with reason", () => {
      const cb: CircuitBreakerInfo = {
        state: "OPEN",
        consecutiveNoProgress: 5,
        totalOpens: 3,
        reason: "Too many failures",
      };
      const output = renderCircuitBreakerPanel(cb, COLS);

      expect(output).toContain("State: OPEN");
      expect(output).toContain("Too many failures");
    });

    it("renders HALF_OPEN state", () => {
      const cb: CircuitBreakerInfo = {
        state: "HALF_OPEN",
        consecutiveNoProgress: 2,
        totalOpens: 1,
      };
      const output = renderCircuitBreakerPanel(cb, COLS);

      expect(output).toContain("State: HALF_OPEN");
    });

    it("renders N/A when circuit breaker is null", () => {
      const output = renderCircuitBreakerPanel(null, COLS);

      expect(output).toContain("N/A");
    });
  });

  describe("renderStoriesPanel", () => {
    it("renders progress fraction and percentage", () => {
      const stories: StoryProgress = {
        completed: 4,
        total: 10,
        nextStory: "Story 2.1",
      };
      const output = renderStoriesPanel(stories, COLS);

      expect(output).toContain("4/10 (40%)");
    });

    it("renders progress bar with filled and empty characters", () => {
      const stories: StoryProgress = {
        completed: 4,
        total: 10,
        nextStory: "Story 2.1",
      };
      const output = renderStoriesPanel(stories, COLS);

      expect(output).toContain("\u2588");
      expect(output).toContain("\u2591");
    });

    it("renders next story label", () => {
      const stories: StoryProgress = {
        completed: 4,
        total: 10,
        nextStory: "Story 2.1",
      };
      const output = renderStoriesPanel(stories, COLS);

      expect(output).toContain("Next: Story 2.1");
    });

    it("renders N/A when stories is null", () => {
      const output = renderStoriesPanel(null, COLS);

      expect(output).toContain("N/A");
    });

    it("renders 0/0 with empty bar when total is zero", () => {
      const stories: StoryProgress = {
        completed: 0,
        total: 0,
        nextStory: null,
      };
      const output = renderStoriesPanel(stories, COLS);

      expect(output).toContain("0/0");
      expect(output).not.toContain("\u2588");
    });
  });

  describe("renderAnalysisPanel", () => {
    it("renders file count, confidence, and flags", () => {
      const analysis: AnalysisInfo = {
        filesModified: 3,
        confidenceScore: 72,
        isTestOnly: false,
        isStuck: false,
        exitSignal: false,
        hasPermissionDenials: false,
        permissionDenialCount: 0,
      };
      const output = renderAnalysisPanel(analysis, COLS);

      expect(output).toContain("Files: 3");
      expect(output).toContain("Confidence: 72%");
      expect(output).toContain("Test-only: no");
    });

    it("renders exit signal and permission denials", () => {
      const analysis: AnalysisInfo = {
        filesModified: 5,
        confidenceScore: 90,
        isTestOnly: true,
        isStuck: true,
        exitSignal: true,
        hasPermissionDenials: true,
        permissionDenialCount: 2,
      };
      const output = renderAnalysisPanel(analysis, COLS);

      expect(output).toContain("Exit signal: yes");
      expect(output).toContain("Permission denials: 2");
      expect(output).toContain("Test-only: yes");
      expect(output).toContain("Stuck: yes");
    });

    it("renders N/A when analysis is null", () => {
      const output = renderAnalysisPanel(null, COLS);

      expect(output).toContain("N/A");
    });
  });

  describe("renderLogsPanel", () => {
    it("renders log entries with timestamps and messages", () => {
      const logs: LogEntry[] = [
        {
          timestamp: "2026-02-25T14:23:01Z",
          level: "INFO",
          message: "Loop #12 started",
        },
        {
          timestamp: "2026-02-25T14:23:15Z",
          level: "WARN",
          message: "Test flake detected",
        },
      ];
      const output = renderLogsPanel(logs, COLS);

      expect(output).toContain("14:23:01");
      expect(output).toContain("INFO");
      expect(output).toContain("Loop #12 started");
      expect(output).toContain("14:23:15");
      expect(output).toContain("WARN");
      expect(output).toContain("Test flake detected");
    });

    it("renders empty state when no logs present", () => {
      const output = renderLogsPanel([], COLS);

      expect(output).toContain("Recent Activity");
      expect(output).toContain("No activity yet");
    });

    it("renders correct time from space-separated timestamp", () => {
      const logs: LogEntry[] = [
        {
          timestamp: "2026-02-25 14:23:01",
          level: "INFO",
          message: "Loop started",
        },
      ];
      const output = renderLogsPanel(logs, COLS);

      expect(output).toContain("14:23:01");
    });
  });

  describe("renderFooter", () => {
    it("renders quit hint and last updated time", () => {
      const lastUpdated = new Date("2026-02-25T14:25:15Z");
      const output = renderFooter(lastUpdated, COLS);

      expect(output).toContain("q quit");
      expect(output).toContain("14:25:15");
    });
  });

  describe("renderSideBySide", () => {
    it("combines two panels horizontally with gap", () => {
      const left = "AAA\nBBB";
      const right = "CCC\nDDD";
      const output = renderSideBySide(left, right, 20);

      const lines = output.split("\n");
      const firstLine = lines[0] ?? "";
      expect(firstLine).toContain("AAA");
      expect(firstLine).toContain("CCC");
    });

    it("pads shorter panel to match taller panel", () => {
      const left = "A\nB\nC";
      const right = "X";
      const output = renderSideBySide(left, right, 20);

      const lines = output.split("\n");
      expect(lines).toHaveLength(3);
    });
  });

  describe("progressBar", () => {
    it("renders partially filled bar", () => {
      const bar = progressBar(4, 10, 20);

      const filledCount = (bar.match(/\u2588/g) ?? []).length;
      const emptyCount = (bar.match(/\u2591/g) ?? []).length;
      expect(filledCount).toBe(8);
      expect(emptyCount).toBe(12);
      expect(filledCount + emptyCount).toBe(20);
    });

    it("renders empty bar when total is zero", () => {
      const bar = progressBar(0, 0, 20);

      const filledCount = (bar.match(/\u2588/g) ?? []).length;
      const emptyCount = (bar.match(/\u2591/g) ?? []).length;
      expect(filledCount).toBe(0);
      expect(emptyCount).toBe(20);
    });

    it("renders full bar when completed equals total", () => {
      const bar = progressBar(10, 10, 20);

      const filledCount = (bar.match(/\u2588/g) ?? []).length;
      expect(filledCount).toBe(20);
    });
  });

  describe("formatSessionAge", () => {
    it("formats duration as hours and minutes", () => {
      const result = formatSessionAge("2026-02-25T12:10:15Z");

      expect(result).toBe("2h 15m");
    });

    it("formats short duration as minutes and seconds", () => {
      const result = formatSessionAge("2026-02-25T14:22:15Z");

      expect(result).toBe("3m 0s");
    });

    it("formats duration under one minute", () => {
      const result = formatSessionAge("2026-02-25T14:24:45Z");

      expect(result).toBe("0m 30s");
    });

    it("returns zero duration when createdAt is in the future", () => {
      const result = formatSessionAge("2026-02-25T16:00:00Z");

      expect(result).toBe("0m 0s");
    });

    it("returns zero duration when createdAt is invalid", () => {
      const result = formatSessionAge("not-a-date");

      expect(result).toBe("0m 0s");
    });

    it("formats multi-day duration as hours and minutes", () => {
      const result = formatSessionAge("2026-02-23T14:25:15Z");

      expect(result).toBe("48h 0m");
    });
  });

  describe("renderLiveLogPanel", () => {
    it("renders live log lines", () => {
      const lines = ["Analyzing codebase...", "Running tests", "Fixing issue"];
      const output = renderLiveLogPanel(lines, COLS);

      expect(output).toContain("Live Output");
      expect(output).toContain("Analyzing codebase...");
      expect(output).toContain("Fixing issue");
    });

    it("renders empty state when no live log lines", () => {
      const output = renderLiveLogPanel([], COLS);

      expect(output).toContain("Live Output");
      expect(output).toContain("No live output yet");
    });
  });

  describe("formatElapsed", () => {
    it("formats seconds under one minute", () => {
      expect(formatElapsed(45)).toBe("45s");
    });

    it("formats exactly zero seconds", () => {
      expect(formatElapsed(0)).toBe("0s");
    });

    it("formats exactly 60 seconds as 1m 0s", () => {
      expect(formatElapsed(60)).toBe("1m 0s");
    });

    it("formats seconds over one minute", () => {
      expect(formatElapsed(125)).toBe("2m 5s");
    });
  });

  describe("renderDashboard with execution", () => {
    it("renders live log panel when execution is active", () => {
      const loop: LoopInfo = {
        loopCount: 5,
        status: "running",
        lastAction: "analyzing",
        callsMadeThisHour: 10,
        maxCallsPerHour: 100,
      };
      const execution: ExecutionProgress = {
        status: "executing",
        elapsedSeconds: 60,
        indicator: "⠋",
        lastOutput: "",
      };
      const state = makeState({
        loop,
        execution,
        liveLog: ["Running tests", "Test passed"],
      });
      const output = renderDashboard(state, COLS);

      expect(output).toContain("Live Output");
      expect(output).toContain("Running tests");
    });

    it("does not render live log panel when not executing", () => {
      const loop: LoopInfo = {
        loopCount: 5,
        status: "running",
        lastAction: "analyzing",
        callsMadeThisHour: 10,
        maxCallsPerHour: 100,
      };
      const state = makeState({
        loop,
        liveLog: ["some content"],
      });
      const output = renderDashboard(state, COLS);

      expect(output).not.toContain("Live Output");
    });
  });

  describe("formatCBState", () => {
    it("returns state string for CLOSED", () => {
      const result = formatCBState("CLOSED");

      expect(result).toContain("CLOSED");
    });

    it("returns state string for OPEN", () => {
      const result = formatCBState("OPEN");

      expect(result).toContain("OPEN");
    });

    it("returns state string for HALF_OPEN", () => {
      const result = formatCBState("HALF_OPEN");

      expect(result).toContain("HALF_OPEN");
    });
  });
});
