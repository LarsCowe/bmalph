import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
}));

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

vi.mock("../../src/utils/validate.js", () => ({
  validateCircuitBreakerState: vi.fn(),
  validateRalphSession: vi.fn(),
  validateRalphApiStatus: vi.fn(),
}));

vi.mock("../../src/utils/constants.js", () => ({
  SESSION_AGE_WARNING_MS: 24 * 60 * 60 * 1000,
  API_USAGE_WARNING_PERCENT: 90,
  RALPH_STATUS_FILE: ".ralph/status.json",
}));

vi.mock("../../src/utils/errors.js", () => ({
  isEnoent: vi.fn(
    (err: unknown) =>
      err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT"
  ),
  formatError: vi.fn((err: unknown) => (err instanceof Error ? err.message : String(err))),
}));

import { readFile } from "node:fs/promises";
import { getBundledVersions } from "../../src/installer.js";
import { checkUpstream, getSkipReason } from "../../src/utils/github.js";
import {
  validateCircuitBreakerState,
  validateRalphSession,
  validateRalphApiStatus,
} from "../../src/utils/validate.js";
import {
  checkCircuitBreaker,
  checkRalphSession,
  checkApiCalls,
  checkUpstreamGitHubStatus,
} from "../../src/commands/doctor-runtime-checks.js";

const mockReadFile = vi.mocked(readFile);
const mockGetBundledVersions = vi.mocked(getBundledVersions);
const mockCheckUpstream = vi.mocked(checkUpstream);
const mockGetSkipReason = vi.mocked(getSkipReason);
const mockValidateCircuitBreakerState = vi.mocked(validateCircuitBreakerState);
const mockValidateRalphSession = vi.mocked(validateRalphSession);
const mockValidateRalphApiStatus = vi.mocked(validateRalphApiStatus);

function enoentError(): NodeJS.ErrnoException {
  const err = new Error("ENOENT: no such file or directory") as NodeJS.ErrnoException;
  err.code = "ENOENT";
  return err;
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
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        state: "CLOSED",
        consecutive_no_progress: 0,
      })
    );
    mockValidateCircuitBreakerState.mockReturnValue({
      state: "CLOSED",
      consecutive_no_progress: 0,
    });

    const result = await checkCircuitBreaker("/projects/webapp");

    expect(result.passed).toBe(true);
  });

  it("includes loop count in detail when CLOSED", async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        state: "CLOSED",
        consecutive_no_progress: 3,
      })
    );
    mockValidateCircuitBreakerState.mockReturnValue({
      state: "CLOSED",
      consecutive_no_progress: 3,
    });

    const result = await checkCircuitBreaker("/projects/webapp");

    expect(result.detail).toContain("3 loops without progress");
  });

  it("passes when circuit breaker is HALF_OPEN", async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        state: "HALF_OPEN",
        consecutive_no_progress: 5,
      })
    );
    mockValidateCircuitBreakerState.mockReturnValue({
      state: "HALF_OPEN",
      consecutive_no_progress: 5,
    });

    const result = await checkCircuitBreaker("/projects/webapp");

    expect(result.passed).toBe(true);
  });

  it("shows monitoring status in detail when HALF_OPEN", async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        state: "HALF_OPEN",
        consecutive_no_progress: 5,
      })
    );
    mockValidateCircuitBreakerState.mockReturnValue({
      state: "HALF_OPEN",
      consecutive_no_progress: 5,
    });

    const result = await checkCircuitBreaker("/projects/webapp");

    expect(result.detail).toContain("HALF_OPEN");
  });

  it("fails when circuit breaker is OPEN", async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        state: "OPEN",
        consecutive_no_progress: 10,
        reason: "repeated test failures",
      })
    );
    mockValidateCircuitBreakerState.mockReturnValue({
      state: "OPEN",
      consecutive_no_progress: 10,
      reason: "repeated test failures",
    });

    const result = await checkCircuitBreaker("/projects/webapp");

    expect(result.passed).toBe(false);
  });

  it("includes the reason in detail when OPEN", async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        state: "OPEN",
        consecutive_no_progress: 10,
        reason: "repeated test failures",
      })
    );
    mockValidateCircuitBreakerState.mockReturnValue({
      state: "OPEN",
      consecutive_no_progress: 10,
      reason: "repeated test failures",
    });

    const result = await checkCircuitBreaker("/projects/webapp");

    expect(result.detail).toContain("repeated test failures");
  });

  it("uses default reason when OPEN without explicit reason", async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        state: "OPEN",
        consecutive_no_progress: 8,
      })
    );
    mockValidateCircuitBreakerState.mockReturnValue({
      state: "OPEN",
      consecutive_no_progress: 8,
    });

    const result = await checkCircuitBreaker("/projects/webapp");

    expect(result.detail).toContain("stagnation detected");
  });

  it("provides a hint to review logs when OPEN", async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        state: "OPEN",
        consecutive_no_progress: 10,
        reason: "build keeps failing",
      })
    );
    mockValidateCircuitBreakerState.mockReturnValue({
      state: "OPEN",
      consecutive_no_progress: 10,
      reason: "build keeps failing",
    });

    const result = await checkCircuitBreaker("/projects/webapp");

    expect(result.hint).toContain("bmalph status");
  });

  it("passes with 'not running' when state file does not exist", async () => {
    mockReadFile.mockRejectedValue(enoentError());

    const result = await checkCircuitBreaker("/projects/webapp");

    expect(result.passed).toBe(true);
  });

  it("shows 'not running' detail when state file is missing", async () => {
    mockReadFile.mockRejectedValue(enoentError());

    const result = await checkCircuitBreaker("/projects/webapp");

    expect(result.detail).toBe("not running");
  });

  it("reports corrupt state file when JSON is invalid", async () => {
    mockReadFile.mockResolvedValue("not valid json {{{");

    const result = await checkCircuitBreaker("/projects/webapp");

    expect(result.detail).toBe("corrupt state file");
  });

  it("suggests deleting the state file on corruption", async () => {
    mockReadFile.mockResolvedValue("not valid json {{{");

    const result = await checkCircuitBreaker("/projects/webapp");

    expect(result.hint).toContain("Delete .ralph/.circuit_breaker_state");
  });
});

describe("checkRalphSession", () => {
  it("passes for a fresh session created recently", async () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        session_id: "sess-2025-abc123",
        created_at: tenMinutesAgo,
      })
    );
    mockValidateRalphSession.mockReturnValue({
      session_id: "sess-2025-abc123",
      created_at: tenMinutesAgo,
    });

    const result = await checkRalphSession("/projects/webapp");

    expect(result.passed).toBe(true);
  });

  it("shows age in minutes for recent sessions", async () => {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        session_id: "sess-2025-def456",
        created_at: thirtyMinutesAgo,
      })
    );
    mockValidateRalphSession.mockReturnValue({
      session_id: "sess-2025-def456",
      created_at: thirtyMinutesAgo,
    });

    const result = await checkRalphSession("/projects/webapp");

    expect(result.detail).toContain("m");
  });

  it("shows age in hours and minutes for older sessions", async () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        session_id: "sess-2025-ghi789",
        created_at: threeHoursAgo,
      })
    );
    mockValidateRalphSession.mockReturnValue({
      session_id: "sess-2025-ghi789",
      created_at: threeHoursAgo,
    });

    const result = await checkRalphSession("/projects/webapp");

    expect(result.detail).toContain("3h");
  });

  it("fails when session is older than 24 hours", async () => {
    const thirtyHoursAgo = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString();
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        session_id: "sess-2025-stale-session",
        created_at: thirtyHoursAgo,
      })
    );
    mockValidateRalphSession.mockReturnValue({
      session_id: "sess-2025-stale-session",
      created_at: thirtyHoursAgo,
    });

    const result = await checkRalphSession("/projects/webapp");

    expect(result.passed).toBe(false);
  });

  it("mentions max age in detail for stale sessions", async () => {
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        session_id: "sess-2025-very-old",
        created_at: twoDaysAgo,
      })
    );
    mockValidateRalphSession.mockReturnValue({
      session_id: "sess-2025-very-old",
      created_at: twoDaysAgo,
    });

    const result = await checkRalphSession("/projects/webapp");

    expect(result.detail).toContain("max 24h");
  });

  it("suggests starting a fresh session when stale", async () => {
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        session_id: "sess-2025-expired",
        created_at: twoDaysAgo,
      })
    );
    mockValidateRalphSession.mockReturnValue({
      session_id: "sess-2025-expired",
      created_at: twoDaysAgo,
    });

    const result = await checkRalphSession("/projects/webapp");

    expect(result.hint).toContain("fresh Ralph session");
  });

  it("fails when session timestamp is in the future", async () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        session_id: "sess-2025-time-traveler",
        created_at: tomorrow,
      })
    );
    mockValidateRalphSession.mockReturnValue({
      session_id: "sess-2025-time-traveler",
      created_at: tomorrow,
    });

    const result = await checkRalphSession("/projects/webapp");

    expect(result.passed).toBe(false);
  });

  it("reports 'invalid timestamp (future)' for future sessions", async () => {
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        session_id: "sess-2025-future",
        created_at: nextWeek,
      })
    );
    mockValidateRalphSession.mockReturnValue({
      session_id: "sess-2025-future",
      created_at: nextWeek,
    });

    const result = await checkRalphSession("/projects/webapp");

    expect(result.detail).toBe("invalid timestamp (future)");
  });

  it("passes with 'no active session' when session_id is empty", async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        session_id: "",
        created_at: "2025-06-15T10:30:00.000Z",
      })
    );
    mockValidateRalphSession.mockReturnValue({
      session_id: "",
      created_at: "2025-06-15T10:30:00.000Z",
    });

    const result = await checkRalphSession("/projects/webapp");

    expect(result.passed).toBe(true);
  });

  it("shows 'no active session' detail when session_id is empty", async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        session_id: "",
        created_at: "2025-06-15T10:30:00.000Z",
      })
    );
    mockValidateRalphSession.mockReturnValue({
      session_id: "",
      created_at: "2025-06-15T10:30:00.000Z",
    });

    const result = await checkRalphSession("/projects/webapp");

    expect(result.detail).toBe("no active session");
  });

  it("passes with 'no active session' when session file is missing", async () => {
    mockReadFile.mockRejectedValue(enoentError());

    const result = await checkRalphSession("/projects/webapp");

    expect(result.passed).toBe(true);
  });

  it("reports corrupt session file for invalid JSON", async () => {
    mockReadFile.mockResolvedValue("{invalid json content");

    const result = await checkRalphSession("/projects/webapp");

    expect(result.detail).toBe("corrupt session file");
  });

  it("suggests deleting session file on corruption", async () => {
    mockReadFile.mockResolvedValue("{broken");

    const result = await checkRalphSession("/projects/webapp");

    expect(result.hint).toContain("Delete .ralph/.ralph_session");
  });
});

describe("checkApiCalls", () => {
  it("passes when API usage is well within limits", async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        calls_made_this_hour: 15,
        max_calls_per_hour: 100,
      })
    );
    mockValidateRalphApiStatus.mockReturnValue({
      calls_made_this_hour: 15,
      max_calls_per_hour: 100,
    });

    const result = await checkApiCalls("/projects/webapp");

    expect(result.passed).toBe(true);
  });

  it("shows usage fraction in detail", async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        calls_made_this_hour: 42,
        max_calls_per_hour: 200,
      })
    );
    mockValidateRalphApiStatus.mockReturnValue({
      calls_made_this_hour: 42,
      max_calls_per_hour: 200,
    });

    const result = await checkApiCalls("/projects/webapp");

    expect(result.detail).toBe("42/200");
  });

  it("fails when API usage reaches 90% of the limit", async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        calls_made_this_hour: 90,
        max_calls_per_hour: 100,
      })
    );
    mockValidateRalphApiStatus.mockReturnValue({
      calls_made_this_hour: 90,
      max_calls_per_hour: 100,
    });

    const result = await checkApiCalls("/projects/webapp");

    expect(result.passed).toBe(false);
  });

  it("fails when API usage exceeds the limit", async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        calls_made_this_hour: 105,
        max_calls_per_hour: 100,
      })
    );
    mockValidateRalphApiStatus.mockReturnValue({
      calls_made_this_hour: 105,
      max_calls_per_hour: 100,
    });

    const result = await checkApiCalls("/projects/webapp");

    expect(result.passed).toBe(false);
  });

  it("mentions approaching limit in detail when at threshold", async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        calls_made_this_hour: 95,
        max_calls_per_hour: 100,
      })
    );
    mockValidateRalphApiStatus.mockReturnValue({
      calls_made_this_hour: 95,
      max_calls_per_hour: 100,
    });

    const result = await checkApiCalls("/projects/webapp");

    expect(result.detail).toContain("approaching limit");
  });

  it("suggests waiting for rate limit reset when approaching limit", async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        calls_made_this_hour: 92,
        max_calls_per_hour: 100,
      })
    );
    mockValidateRalphApiStatus.mockReturnValue({
      calls_made_this_hour: 92,
      max_calls_per_hour: 100,
    });

    const result = await checkApiCalls("/projects/webapp");

    expect(result.hint).toContain("rate limit");
  });

  it("passes with unlimited detail when max is zero", async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        calls_made_this_hour: 500,
        max_calls_per_hour: 0,
      })
    );
    mockValidateRalphApiStatus.mockReturnValue({
      calls_made_this_hour: 500,
      max_calls_per_hour: 0,
    });

    const result = await checkApiCalls("/projects/webapp");

    expect(result.passed).toBe(true);
  });

  it("shows unlimited format when max_calls_per_hour is zero", async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        calls_made_this_hour: 500,
        max_calls_per_hour: 0,
      })
    );
    mockValidateRalphApiStatus.mockReturnValue({
      calls_made_this_hour: 500,
      max_calls_per_hour: 0,
    });

    const result = await checkApiCalls("/projects/webapp");

    expect(result.detail).toBe("500/unlimited");
  });

  it("passes with negative max (treated as unlimited)", async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        calls_made_this_hour: 10,
        max_calls_per_hour: -1,
      })
    );
    mockValidateRalphApiStatus.mockReturnValue({
      calls_made_this_hour: 10,
      max_calls_per_hour: -1,
    });

    const result = await checkApiCalls("/projects/webapp");

    expect(result.passed).toBe(true);
  });

  it("passes with 'not running' when status file is missing", async () => {
    mockReadFile.mockRejectedValue(enoentError());

    const result = await checkApiCalls("/projects/webapp");

    expect(result.passed).toBe(true);
  });

  it("shows 'not running' detail when status file is missing", async () => {
    mockReadFile.mockRejectedValue(enoentError());

    const result = await checkApiCalls("/projects/webapp");

    expect(result.detail).toBe("not running");
  });

  it("reports corrupt status file for invalid JSON", async () => {
    mockReadFile.mockResolvedValue("not json at all");

    const result = await checkApiCalls("/projects/webapp");

    expect(result.detail).toBe("corrupt status file");
  });

  it("suggests deleting status.json on corruption", async () => {
    mockReadFile.mockResolvedValue("{broken json");

    const result = await checkApiCalls("/projects/webapp");

    expect(result.hint).toContain("Delete .ralph/status.json");
  });

  it("passes when API usage is at 89% (just below threshold)", async () => {
    mockReadFile.mockResolvedValue(
      JSON.stringify({
        calls_made_this_hour: 89,
        max_calls_per_hour: 100,
      })
    );
    mockValidateRalphApiStatus.mockReturnValue({
      calls_made_this_hour: 89,
      max_calls_per_hour: 100,
    });

    const result = await checkApiCalls("/projects/webapp");

    expect(result.passed).toBe(true);
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
