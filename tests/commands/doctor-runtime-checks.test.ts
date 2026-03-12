import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../src/installer.js", () => ({
  getBundledVersions: vi.fn(() =>
    Promise.resolve({
      bmadCommit: "abc12345def67890abc12345def67890abc12345",
    })
  ),
}));

vi.mock("../../src/utils/github.js", () => ({
  checkUpstream: vi.fn(),
  getSkipReason: vi.fn(),
}));

vi.mock("../../src/utils/constants.js", () => ({
  SESSION_AGE_WARNING_MS: 24 * 60 * 60 * 1000,
  API_USAGE_WARNING_PERCENT: 90,
}));

vi.mock("../../src/utils/ralph-runtime-state.js", () => ({
  readRalphCircuitBreaker: vi.fn(),
  readRalphRuntimeSession: vi.fn(),
  readRalphRuntimeStatus: vi.fn(),
}));

import { getBundledVersions } from "../../src/installer.js";
import { checkUpstream, getSkipReason } from "../../src/utils/github.js";
import {
  readRalphCircuitBreaker,
  readRalphRuntimeSession,
  readRalphRuntimeStatus,
} from "../../src/utils/ralph-runtime-state.js";
import {
  checkCircuitBreaker,
  checkRalphSession,
  checkApiCalls,
  checkUpstreamGitHubStatus,
} from "../../src/commands/doctor-runtime-checks.js";

const mockGetBundledVersions = vi.mocked(getBundledVersions);
const mockCheckUpstream = vi.mocked(checkUpstream);
const mockGetSkipReason = vi.mocked(getSkipReason);
const mockReadRalphCircuitBreaker = vi.mocked(readRalphCircuitBreaker);
const mockReadRalphRuntimeSession = vi.mocked(readRalphRuntimeSession);
const mockReadRalphRuntimeStatus = vi.mocked(readRalphRuntimeStatus);

function circuitBreakerResult(
  overrides: Partial<{
    state: "CLOSED" | "HALF_OPEN" | "OPEN";
    consecutiveNoProgress: number;
    totalOpens: number;
    reason?: string;
  }> = {}
) {
  return {
    kind: "ok" as const,
    path: "/projects/webapp/.ralph/.circuit_breaker_state",
    value: {
      state: "CLOSED" as const,
      consecutiveNoProgress: 0,
      totalOpens: 0,
      ...overrides,
    },
  };
}

function sessionResult(
  overrides: Partial<{
    session_id: string;
    created_at: string;
    last_used?: string;
  }> = {}
) {
  return {
    kind: "ok" as const,
    path: "/projects/webapp/.ralph/.ralph_session",
    value: {
      session_id: "sess-2025-abc123",
      created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      ...overrides,
    },
  };
}

function statusResult(
  overrides: Partial<{
    loopCount: number;
    status: "running" | "blocked" | "completed" | "not_started" | "unknown";
    tasksCompleted: number;
    tasksTotal: number;
    callsMadeThisHour: number;
    maxCallsPerHour: number;
    lastAction: string;
  }> = {}
) {
  return {
    kind: "ok" as const,
    path: "/projects/webapp/.ralph/status.json",
    value: {
      loopCount: 1,
      status: "running" as const,
      tasksCompleted: 0,
      tasksTotal: 0,
      callsMadeThisHour: 0,
      maxCallsPerHour: 0,
      lastAction: "",
      ...overrides,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetBundledVersions.mockReturnValue(
    Promise.resolve({
      bmadCommit: "abc12345def67890abc12345def67890abc12345",
    }) as unknown as ReturnType<typeof getBundledVersions>
  );
});

describe("checkCircuitBreaker", () => {
  it("passes when circuit breaker state is CLOSED", async () => {
    mockReadRalphCircuitBreaker.mockResolvedValue(circuitBreakerResult());

    const result = await checkCircuitBreaker("/projects/webapp");

    expect(result.passed).toBe(true);
  });

  it("includes loop count in detail when CLOSED", async () => {
    mockReadRalphCircuitBreaker.mockResolvedValue(
      circuitBreakerResult({ consecutiveNoProgress: 3 })
    );

    const result = await checkCircuitBreaker("/projects/webapp");

    expect(result.detail).toContain("3 loops without progress");
  });

  it("passes when circuit breaker is HALF_OPEN", async () => {
    mockReadRalphCircuitBreaker.mockResolvedValue(
      circuitBreakerResult({ state: "HALF_OPEN", consecutiveNoProgress: 5 })
    );

    const result = await checkCircuitBreaker("/projects/webapp");

    expect(result.passed).toBe(true);
  });

  it("shows monitoring status in detail when HALF_OPEN", async () => {
    mockReadRalphCircuitBreaker.mockResolvedValue(
      circuitBreakerResult({ state: "HALF_OPEN", consecutiveNoProgress: 5 })
    );

    const result = await checkCircuitBreaker("/projects/webapp");

    expect(result.detail).toContain("HALF_OPEN");
  });

  it("fails when circuit breaker is OPEN", async () => {
    mockReadRalphCircuitBreaker.mockResolvedValue(
      circuitBreakerResult({
        state: "OPEN",
        consecutiveNoProgress: 10,
        totalOpens: 2,
        reason: "repeated test failures",
      })
    );

    const result = await checkCircuitBreaker("/projects/webapp");

    expect(result.passed).toBe(false);
  });

  it("includes the reason in detail when OPEN", async () => {
    mockReadRalphCircuitBreaker.mockResolvedValue(
      circuitBreakerResult({
        state: "OPEN",
        consecutiveNoProgress: 10,
        totalOpens: 2,
        reason: "repeated test failures",
      })
    );

    const result = await checkCircuitBreaker("/projects/webapp");

    expect(result.detail).toContain("repeated test failures");
  });

  it("uses default reason when OPEN without explicit reason", async () => {
    mockReadRalphCircuitBreaker.mockResolvedValue(
      circuitBreakerResult({ state: "OPEN", consecutiveNoProgress: 8, totalOpens: 1 })
    );

    const result = await checkCircuitBreaker("/projects/webapp");

    expect(result.detail).toContain("stagnation detected");
  });

  it("provides a hint to review logs when OPEN", async () => {
    mockReadRalphCircuitBreaker.mockResolvedValue(
      circuitBreakerResult({
        state: "OPEN",
        consecutiveNoProgress: 10,
        totalOpens: 2,
        reason: "build keeps failing",
      })
    );

    const result = await checkCircuitBreaker("/projects/webapp");

    expect(result.hint).toContain("bmalph status");
  });

  it("passes with 'not running' when state file does not exist", async () => {
    mockReadRalphCircuitBreaker.mockResolvedValue({
      kind: "missing",
      path: "/projects/webapp/.ralph/.circuit_breaker_state",
    });

    const result = await checkCircuitBreaker("/projects/webapp");

    expect(result.passed).toBe(true);
  });

  it("shows 'not running' detail when state file is missing", async () => {
    mockReadRalphCircuitBreaker.mockResolvedValue({
      kind: "missing",
      path: "/projects/webapp/.ralph/.circuit_breaker_state",
    });

    const result = await checkCircuitBreaker("/projects/webapp");

    expect(result.detail).toBe("not running");
  });

  it("reports corrupt state file when parsing is invalid", async () => {
    mockReadRalphCircuitBreaker.mockResolvedValue({
      kind: "invalid",
      path: "/projects/webapp/.ralph/.circuit_breaker_state",
      error: new Error("Invalid JSON"),
    });

    const result = await checkCircuitBreaker("/projects/webapp");

    expect(result.detail).toBe("corrupt state file");
  });

  it("suggests deleting the state file on corruption", async () => {
    mockReadRalphCircuitBreaker.mockResolvedValue({
      kind: "invalid",
      path: "/projects/webapp/.ralph/.circuit_breaker_state",
      error: new Error("Invalid JSON"),
    });

    const result = await checkCircuitBreaker("/projects/webapp");

    expect(result.hint).toContain("Delete .ralph/.circuit_breaker_state");
  });

  it("reports unreadable state files separately", async () => {
    mockReadRalphCircuitBreaker.mockResolvedValue({
      kind: "unreadable",
      path: "/projects/webapp/.ralph/.circuit_breaker_state",
      error: new Error("EISDIR"),
    });

    const result = await checkCircuitBreaker("/projects/webapp");

    expect(result.detail).toBe("unreadable state file");
  });
});

describe("checkRalphSession", () => {
  it("passes for a fresh session created recently", async () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    mockReadRalphRuntimeSession.mockResolvedValue(sessionResult({ created_at: tenMinutesAgo }));

    const result = await checkRalphSession("/projects/webapp");

    expect(result.passed).toBe(true);
  });

  it("shows age in minutes for recent sessions", async () => {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    mockReadRalphRuntimeSession.mockResolvedValue(sessionResult({ created_at: thirtyMinutesAgo }));

    const result = await checkRalphSession("/projects/webapp");

    expect(result.detail).toContain("m");
  });

  it("shows age in hours and minutes for older sessions", async () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    mockReadRalphRuntimeSession.mockResolvedValue(sessionResult({ created_at: threeHoursAgo }));

    const result = await checkRalphSession("/projects/webapp");

    expect(result.detail).toContain("3h");
  });

  it("fails when session is older than 24 hours", async () => {
    const thirtyHoursAgo = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString();
    mockReadRalphRuntimeSession.mockResolvedValue(sessionResult({ created_at: thirtyHoursAgo }));

    const result = await checkRalphSession("/projects/webapp");

    expect(result.passed).toBe(false);
  });

  it("mentions max age in detail for stale sessions", async () => {
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    mockReadRalphRuntimeSession.mockResolvedValue(sessionResult({ created_at: twoDaysAgo }));

    const result = await checkRalphSession("/projects/webapp");

    expect(result.detail).toContain("max 24h");
  });

  it("suggests starting a fresh session when stale", async () => {
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    mockReadRalphRuntimeSession.mockResolvedValue(sessionResult({ created_at: twoDaysAgo }));

    const result = await checkRalphSession("/projects/webapp");

    expect(result.hint).toContain("fresh Ralph session");
  });

  it("fails when session timestamp is in the future", async () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    mockReadRalphRuntimeSession.mockResolvedValue(sessionResult({ created_at: tomorrow }));

    const result = await checkRalphSession("/projects/webapp");

    expect(result.passed).toBe(false);
  });

  it("reports 'invalid timestamp (future)' for future sessions", async () => {
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    mockReadRalphRuntimeSession.mockResolvedValue(sessionResult({ created_at: nextWeek }));

    const result = await checkRalphSession("/projects/webapp");

    expect(result.detail).toBe("invalid timestamp (future)");
  });

  it("fails when session timestamp cannot be parsed", async () => {
    mockReadRalphRuntimeSession.mockResolvedValue(sessionResult({ created_at: "not-a-date" }));

    const result = await checkRalphSession("/projects/webapp");

    expect(result.passed).toBe(false);
  });

  it("reports 'invalid timestamp' for unparsable session timestamps", async () => {
    mockReadRalphRuntimeSession.mockResolvedValue(sessionResult({ created_at: "not-a-date" }));

    const result = await checkRalphSession("/projects/webapp");

    expect(result.detail).toBe("invalid timestamp");
  });

  it("passes with 'no active session' when session_id is empty", async () => {
    mockReadRalphRuntimeSession.mockResolvedValue(
      sessionResult({ session_id: "", created_at: "2025-06-15T10:30:00.000Z" })
    );

    const result = await checkRalphSession("/projects/webapp");

    expect(result.passed).toBe(true);
  });

  it("shows 'no active session' detail when session_id is empty", async () => {
    mockReadRalphRuntimeSession.mockResolvedValue(
      sessionResult({ session_id: "", created_at: "2025-06-15T10:30:00.000Z" })
    );

    const result = await checkRalphSession("/projects/webapp");

    expect(result.detail).toBe("no active session");
  });

  it("passes with 'no active session' when session file is missing", async () => {
    mockReadRalphRuntimeSession.mockResolvedValue({
      kind: "missing",
      path: "/projects/webapp/.ralph/.ralph_session",
    });

    const result = await checkRalphSession("/projects/webapp");

    expect(result.passed).toBe(true);
  });

  it("reports corrupt session file for invalid content", async () => {
    mockReadRalphRuntimeSession.mockResolvedValue({
      kind: "invalid",
      path: "/projects/webapp/.ralph/.ralph_session",
      error: new Error("Invalid JSON"),
    });

    const result = await checkRalphSession("/projects/webapp");

    expect(result.detail).toBe("corrupt session file");
  });

  it("suggests deleting session file on corruption", async () => {
    mockReadRalphRuntimeSession.mockResolvedValue({
      kind: "invalid",
      path: "/projects/webapp/.ralph/.ralph_session",
      error: new Error("Invalid JSON"),
    });

    const result = await checkRalphSession("/projects/webapp");

    expect(result.hint).toContain("Delete .ralph/.ralph_session");
  });

  it("reports unreadable session files separately", async () => {
    mockReadRalphRuntimeSession.mockResolvedValue({
      kind: "unreadable",
      path: "/projects/webapp/.ralph/.ralph_session",
      error: new Error("EISDIR"),
    });

    const result = await checkRalphSession("/projects/webapp");

    expect(result.detail).toBe("unreadable session file");
  });
});

describe("checkApiCalls", () => {
  it("passes when API usage is well within limits", async () => {
    mockReadRalphRuntimeStatus.mockResolvedValue(
      statusResult({ callsMadeThisHour: 15, maxCallsPerHour: 100 })
    );

    const result = await checkApiCalls("/projects/webapp");

    expect(result.passed).toBe(true);
  });

  it("shows usage fraction in detail", async () => {
    mockReadRalphRuntimeStatus.mockResolvedValue(
      statusResult({ callsMadeThisHour: 42, maxCallsPerHour: 200 })
    );

    const result = await checkApiCalls("/projects/webapp");

    expect(result.detail).toBe("42/200");
  });

  it("fails when API usage reaches 90% of the limit", async () => {
    mockReadRalphRuntimeStatus.mockResolvedValue(
      statusResult({ callsMadeThisHour: 90, maxCallsPerHour: 100 })
    );

    const result = await checkApiCalls("/projects/webapp");

    expect(result.passed).toBe(false);
  });

  it("fails when API usage exceeds the limit", async () => {
    mockReadRalphRuntimeStatus.mockResolvedValue(
      statusResult({ callsMadeThisHour: 105, maxCallsPerHour: 100 })
    );

    const result = await checkApiCalls("/projects/webapp");

    expect(result.passed).toBe(false);
  });

  it("mentions approaching limit in detail when at threshold", async () => {
    mockReadRalphRuntimeStatus.mockResolvedValue(
      statusResult({ callsMadeThisHour: 95, maxCallsPerHour: 100 })
    );

    const result = await checkApiCalls("/projects/webapp");

    expect(result.detail).toContain("approaching limit");
  });

  it("suggests waiting for rate limit reset when approaching limit", async () => {
    mockReadRalphRuntimeStatus.mockResolvedValue(
      statusResult({ callsMadeThisHour: 92, maxCallsPerHour: 100 })
    );

    const result = await checkApiCalls("/projects/webapp");

    expect(result.hint).toContain("rate limit");
  });

  it("passes with unlimited detail when max is zero", async () => {
    mockReadRalphRuntimeStatus.mockResolvedValue(
      statusResult({ callsMadeThisHour: 500, maxCallsPerHour: 0 })
    );

    const result = await checkApiCalls("/projects/webapp");

    expect(result.passed).toBe(true);
  });

  it("shows unlimited format when max_calls_per_hour is zero", async () => {
    mockReadRalphRuntimeStatus.mockResolvedValue(
      statusResult({ callsMadeThisHour: 500, maxCallsPerHour: 0 })
    );

    const result = await checkApiCalls("/projects/webapp");

    expect(result.detail).toBe("500/unlimited");
  });

  it("passes with negative max (treated as unlimited)", async () => {
    mockReadRalphRuntimeStatus.mockResolvedValue(
      statusResult({ callsMadeThisHour: 10, maxCallsPerHour: -1 })
    );

    const result = await checkApiCalls("/projects/webapp");

    expect(result.passed).toBe(true);
  });

  it("passes with 'not running' when status file is missing", async () => {
    mockReadRalphRuntimeStatus.mockResolvedValue({
      kind: "missing",
      path: "/projects/webapp/.ralph/status.json",
    });

    const result = await checkApiCalls("/projects/webapp");

    expect(result.passed).toBe(true);
  });

  it("shows 'not running' detail when status file is missing", async () => {
    mockReadRalphRuntimeStatus.mockResolvedValue({
      kind: "missing",
      path: "/projects/webapp/.ralph/status.json",
    });

    const result = await checkApiCalls("/projects/webapp");

    expect(result.detail).toBe("not running");
  });

  it("reports corrupt status file for invalid content", async () => {
    mockReadRalphRuntimeStatus.mockResolvedValue({
      kind: "invalid",
      path: "/projects/webapp/.ralph/status.json",
      error: new Error("Invalid JSON"),
    });

    const result = await checkApiCalls("/projects/webapp");

    expect(result.detail).toBe("corrupt status file");
  });

  it("suggests deleting status.json on corruption", async () => {
    mockReadRalphRuntimeStatus.mockResolvedValue({
      kind: "invalid",
      path: "/projects/webapp/.ralph/status.json",
      error: new Error("Invalid JSON"),
    });

    const result = await checkApiCalls("/projects/webapp");

    expect(result.hint).toContain("Delete .ralph/status.json");
  });

  it("passes when API usage is at 89% (just below threshold)", async () => {
    mockReadRalphRuntimeStatus.mockResolvedValue(
      statusResult({ callsMadeThisHour: 89, maxCallsPerHour: 100 })
    );

    const result = await checkApiCalls("/projects/webapp");

    expect(result.passed).toBe(true);
  });

  it("reports unreadable status files separately", async () => {
    mockReadRalphRuntimeStatus.mockResolvedValue({
      kind: "unreadable",
      path: "/projects/webapp/.ralph/status.json",
      error: new Error("EISDIR"),
    });

    const result = await checkApiCalls("/projects/webapp");

    expect(result.detail).toBe("unreadable status file");
  });
});

describe("checkUpstreamGitHubStatus", () => {
  it("passes when upstream BMAD is up to date", async () => {
    mockCheckUpstream.mockResolvedValue({
      bmad: {
        bundledSha: "abc12345",
        latestSha: "abc12345",
        isUpToDate: true,
        compareUrl: "https://github.com/bmad-code-org/BMAD-METHOD/compare/abc12345...abc12345",
      },
      errors: [],
    });

    const result = await checkUpstreamGitHubStatus("/projects/webapp");

    expect(result.passed).toBe(true);
  });

  it("shows BMAD up to date in detail", async () => {
    mockCheckUpstream.mockResolvedValue({
      bmad: {
        bundledSha: "abc12345",
        latestSha: "abc12345",
        isUpToDate: true,
        compareUrl: "https://github.com/bmad-code-org/BMAD-METHOD/compare/abc12345...abc12345",
      },
      errors: [],
    });

    const result = await checkUpstreamGitHubStatus("/projects/webapp");

    expect(result.detail).toContain("up to date");
  });

  it("reports when BMAD is behind upstream", async () => {
    mockCheckUpstream.mockResolvedValue({
      bmad: {
        bundledSha: "abc12345",
        latestSha: "def67890",
        isUpToDate: false,
        compareUrl: "https://github.com/bmad-code-org/BMAD-METHOD/compare/abc12345...def67890",
      },
      errors: [],
    });

    const result = await checkUpstreamGitHubStatus("/projects/webapp");

    expect(result.detail).toContain("behind");
  });

  it("still passes even when behind (informational check)", async () => {
    mockCheckUpstream.mockResolvedValue({
      bmad: {
        bundledSha: "abc12345",
        latestSha: "def67890",
        isUpToDate: false,
        compareUrl: "https://github.com/bmad-code-org/BMAD-METHOD/compare/abc12345...def67890",
      },
      errors: [],
    });

    const result = await checkUpstreamGitHubStatus("/projects/webapp");

    expect(result.passed).toBe(true);
  });

  it("passes with skip reason when GitHub API fails", async () => {
    mockCheckUpstream.mockResolvedValue({
      bmad: null,
      errors: [{ type: "network", message: "Network error: fetch failed" }],
    });
    mockGetSkipReason.mockReturnValue("network error");

    const result = await checkUpstreamGitHubStatus("/projects/webapp");

    expect(result.passed).toBe(true);
  });

  it("shows skip reason in detail for API failures", async () => {
    mockCheckUpstream.mockResolvedValue({
      bmad: null,
      errors: [{ type: "rate-limit", message: "rate limited", status: 403 }],
    });
    mockGetSkipReason.mockReturnValue("rate limited");

    const result = await checkUpstreamGitHubStatus("/projects/webapp");

    expect(result.detail).toContain("rate limited");
  });

  it("passes with skipped detail when an unexpected error occurs", async () => {
    mockCheckUpstream.mockRejectedValue(new Error("Unexpected failure in GitHub client"));

    const result = await checkUpstreamGitHubStatus("/projects/webapp");

    expect(result.passed).toBe(true);
  });

  it("includes the error message in detail for unexpected errors", async () => {
    mockCheckUpstream.mockRejectedValue(new Error("DNS resolution failed"));

    const result = await checkUpstreamGitHubStatus("/projects/webapp");

    expect(result.detail).toContain("DNS resolution failed");
  });
});
