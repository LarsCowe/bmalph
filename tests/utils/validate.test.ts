import { describe, it, expect } from "vitest";
import {
  validateConfig,
  validateState,
  validateCircuitBreakerState,
  validateRalphSession,
  validateRalphApiStatus,
  validateRalphLoopStatus,
  validateProjectName,
} from "../../src/utils/validate.js";

describe("validateConfig", () => {
  it("accepts a valid config", () => {
    const data = {
      name: "my-project",
      description: "A test project",
      createdAt: "2025-01-01T00:00:00.000Z",
    };

    const result = validateConfig(data);
    expect(result).toEqual(data);
  });

  it("throws when name is missing", () => {
    const data = { description: "test", createdAt: "2025-01-01T00:00:00.000Z" };
    expect(() => validateConfig(data)).toThrow(/name/i);
  });

  it("throws when name is not a string", () => {
    const data = { name: 123, description: "test", createdAt: "2025-01-01T00:00:00.000Z" };
    expect(() => validateConfig(data)).toThrow(/name/i);
  });

  it("throws when createdAt is missing", () => {
    const data = { name: "proj", description: "test" };
    expect(() => validateConfig(data)).toThrow(/createdAt/i);
  });

  it("throws when data is null", () => {
    expect(() => validateConfig(null)).toThrow();
  });

  it("throws when data is not an object", () => {
    expect(() => validateConfig("string")).toThrow();
  });

  it("allows empty description", () => {
    const data = { name: "proj", description: "", createdAt: "2025-01-01T00:00:00.000Z" };
    expect(validateConfig(data)).toEqual(data);
  });

  it("allows description to be missing (defaults to empty string)", () => {
    const data = { name: "proj", createdAt: "2025-01-01T00:00:00.000Z" };
    const result = validateConfig(data);
    expect(result.description).toBe("");
  });

  it("accepts upstreamVersions when present", () => {
    const data = {
      name: "proj",
      createdAt: "2025-01-01T00:00:00.000Z",
      upstreamVersions: {
        bmadCommit: "48881f86",
      },
    };
    const result = validateConfig(data);
    expect(result.upstreamVersions).toEqual({
      bmadCommit: "48881f86",
    });
  });

  it("allows upstreamVersions to be missing (defaults to undefined)", () => {
    const data = { name: "proj", createdAt: "2025-01-01T00:00:00.000Z" };
    const result = validateConfig(data);
    expect(result.upstreamVersions).toBeUndefined();
  });

  it("throws when upstreamVersions is not an object", () => {
    const data = {
      name: "proj",
      createdAt: "2025-01-01T00:00:00.000Z",
      upstreamVersions: "invalid",
    };
    expect(() => validateConfig(data)).toThrow(/upstreamVersions/i);
  });

  it("throws when upstreamVersions has invalid bmadCommit type", () => {
    const data = {
      name: "proj",
      createdAt: "2025-01-01T00:00:00.000Z",
      upstreamVersions: { bmadCommit: 123 },
    };
    expect(() => validateConfig(data)).toThrow(/bmadCommit/i);
  });

  it("ignores extra fields in upstreamVersions", () => {
    const data = {
      name: "proj",
      createdAt: "2025-01-01T00:00:00.000Z",
      upstreamVersions: { bmadCommit: "abc", extraField: "ignored" },
    };
    const result = validateConfig(data);
    expect(result.upstreamVersions).toEqual({ bmadCommit: "abc" });
  });
});

describe("validateState", () => {
  it("accepts a valid state", () => {
    const data = {
      currentPhase: 1,
      status: "planning",
      startedAt: "2025-01-01T00:00:00.000Z",
      lastUpdated: "2025-01-01T01:00:00.000Z",
    };

    const result = validateState(data);
    expect(result).toEqual(data);
  });

  it("throws when currentPhase is missing", () => {
    const data = { status: "planning", startedAt: "x", lastUpdated: "y" };
    expect(() => validateState(data)).toThrow(/currentPhase/i);
  });

  it("throws when currentPhase is not a number", () => {
    const data = { currentPhase: "one", status: "planning", startedAt: "x", lastUpdated: "y" };
    expect(() => validateState(data)).toThrow(/currentPhase/i);
  });

  it("throws when status is invalid", () => {
    const data = { currentPhase: 1, status: "invalid", startedAt: "x", lastUpdated: "y" };
    expect(() => validateState(data)).toThrow(/status/i);
  });

  it("throws when startedAt is missing", () => {
    const data = { currentPhase: 1, status: "planning", lastUpdated: "y" };
    expect(() => validateState(data)).toThrow(/startedAt/i);
  });

  it("throws when lastUpdated is missing", () => {
    const data = { currentPhase: 1, status: "planning", startedAt: "x" };
    expect(() => validateState(data)).toThrow(/lastUpdated/i);
  });

  it("throws when data is null", () => {
    expect(() => validateState(null)).toThrow();
  });

  it("accepts all valid statuses", () => {
    for (const status of ["planning", "implementing", "completed"]) {
      const data = { currentPhase: 1, status, startedAt: "x", lastUpdated: "y" };
      expect(validateState(data).status).toBe(status);
    }
  });
});

describe("validateCircuitBreakerState", () => {
  it("accepts valid CLOSED state", () => {
    const data = { state: "CLOSED", consecutive_no_progress: 0 };
    const result = validateCircuitBreakerState(data);
    expect(result.state).toBe("CLOSED");
    expect(result.consecutive_no_progress).toBe(0);
  });

  it("accepts valid HALF_OPEN state", () => {
    const data = { state: "HALF_OPEN", consecutive_no_progress: 3 };
    const result = validateCircuitBreakerState(data);
    expect(result.state).toBe("HALF_OPEN");
  });

  it("accepts valid OPEN state with reason", () => {
    const data = { state: "OPEN", consecutive_no_progress: 5, reason: "stagnation detected" };
    const result = validateCircuitBreakerState(data);
    expect(result.state).toBe("OPEN");
    expect(result.reason).toBe("stagnation detected");
  });

  it("throws when state is invalid", () => {
    const data = { state: "INVALID", consecutive_no_progress: 0 };
    expect(() => validateCircuitBreakerState(data)).toThrow(/state/i);
  });

  it("throws when consecutive_no_progress is not a number", () => {
    const data = { state: "CLOSED", consecutive_no_progress: "0" };
    expect(() => validateCircuitBreakerState(data)).toThrow(/consecutive_no_progress/i);
  });

  it("throws when data is not an object", () => {
    expect(() => validateCircuitBreakerState(null)).toThrow();
    expect(() => validateCircuitBreakerState("string")).toThrow();
  });
});

describe("validateRalphSession", () => {
  it("accepts valid session", () => {
    const data = {
      session_id: "abc123",
      created_at: "2025-01-01T00:00:00.000Z",
    };
    const result = validateRalphSession(data);
    expect(result.session_id).toBe("abc123");
    expect(result.created_at).toBe("2025-01-01T00:00:00.000Z");
  });

  it("accepts session with last_used", () => {
    const data = {
      session_id: "abc123",
      created_at: "2025-01-01T00:00:00.000Z",
      last_used: "2025-01-01T01:00:00.000Z",
    };
    const result = validateRalphSession(data);
    expect(result.last_used).toBe("2025-01-01T01:00:00.000Z");
  });

  it("throws when session_id is not a string", () => {
    const data = { session_id: 123, created_at: "2025-01-01T00:00:00.000Z" };
    expect(() => validateRalphSession(data)).toThrow(/session_id/i);
  });

  it("throws when created_at is not a string", () => {
    const data = { session_id: "abc", created_at: 12345 };
    expect(() => validateRalphSession(data)).toThrow(/created_at/i);
  });

  it("allows empty session_id", () => {
    const data = { session_id: "", created_at: "2025-01-01T00:00:00.000Z" };
    const result = validateRalphSession(data);
    expect(result.session_id).toBe("");
  });
});

describe("validateRalphApiStatus", () => {
  it("accepts valid API status", () => {
    const data = { calls_made_this_hour: 10, max_calls_per_hour: 100 };
    const result = validateRalphApiStatus(data);
    expect(result.calls_made_this_hour).toBe(10);
    expect(result.max_calls_per_hour).toBe(100);
  });

  it("accepts status field when present", () => {
    const data = { calls_made_this_hour: 10, max_calls_per_hour: 100, status: "running" };
    const result = validateRalphApiStatus(data);
    expect(result.status).toBe("running");
  });

  it("throws when calls_made_this_hour is not a number", () => {
    const data = { calls_made_this_hour: "10", max_calls_per_hour: 100 };
    expect(() => validateRalphApiStatus(data)).toThrow(/calls_made_this_hour/i);
  });

  it("throws when max_calls_per_hour is not a number", () => {
    const data = { calls_made_this_hour: 10, max_calls_per_hour: "100" };
    expect(() => validateRalphApiStatus(data)).toThrow(/max_calls_per_hour/i);
  });
});

describe("validateRalphLoopStatus", () => {
  it("accepts valid loop status", () => {
    const data = {
      loopCount: 5,
      status: "running",
      tasksCompleted: 3,
      tasksTotal: 10,
    };
    const result = validateRalphLoopStatus(data);
    expect(result).toEqual(data);
  });

  it("accepts all valid status values", () => {
    for (const status of ["running", "blocked", "completed", "not_started"]) {
      const data = { loopCount: 0, status, tasksCompleted: 0, tasksTotal: 0 };
      expect(validateRalphLoopStatus(data).status).toBe(status);
    }
  });

  it("throws when loopCount is not a number", () => {
    const data = { loopCount: "5", status: "running", tasksCompleted: 0, tasksTotal: 0 };
    expect(() => validateRalphLoopStatus(data)).toThrow(/loopCount/i);
  });

  it("throws when status is invalid", () => {
    const data = { loopCount: 0, status: "invalid", tasksCompleted: 0, tasksTotal: 0 };
    expect(() => validateRalphLoopStatus(data)).toThrow(/status/i);
  });

  it("throws when tasksCompleted is not a number", () => {
    const data = { loopCount: 0, status: "running", tasksCompleted: "0", tasksTotal: 0 };
    expect(() => validateRalphLoopStatus(data)).toThrow(/tasksCompleted/i);
  });

  it("throws when tasksTotal is not a number", () => {
    const data = { loopCount: 0, status: "running", tasksCompleted: 0, tasksTotal: "10" };
    expect(() => validateRalphLoopStatus(data)).toThrow(/tasksTotal/i);
  });
});

describe("validateProjectName", () => {
  it("accepts valid project names", () => {
    expect(validateProjectName("my-project")).toBe("my-project");
    expect(validateProjectName("MyProject")).toBe("MyProject");
    expect(validateProjectName("project_123")).toBe("project_123");
    expect(validateProjectName("a")).toBe("a");
  });

  it("throws when name is empty", () => {
    expect(() => validateProjectName("")).toThrow(/empty/i);
  });

  it("throws when name is only whitespace", () => {
    expect(() => validateProjectName("   ")).toThrow(/empty/i);
    expect(() => validateProjectName("\t")).toThrow(/empty/i);
  });

  it("throws when name exceeds max length", () => {
    const longName = "a".repeat(101);
    expect(() => validateProjectName(longName)).toThrow(/100 characters/i);
  });

  it("accepts name at max length boundary", () => {
    const maxName = "a".repeat(100);
    expect(validateProjectName(maxName)).toBe(maxName);
  });

  it("throws when name contains invalid filesystem characters", () => {
    const invalidChars = ["<", ">", ":", '"', "/", "\\", "|", "?", "*"];
    for (const char of invalidChars) {
      expect(() => validateProjectName(`project${char}name`)).toThrow(/invalid character/i);
    }
  });

  it("throws for Windows reserved names", () => {
    const reservedNames = [
      "CON",
      "PRN",
      "AUX",
      "NUL",
      "COM1",
      "COM2",
      "COM3",
      "COM4",
      "COM5",
      "COM6",
      "COM7",
      "COM8",
      "COM9",
      "LPT1",
      "LPT2",
      "LPT3",
      "LPT4",
      "LPT5",
      "LPT6",
      "LPT7",
      "LPT8",
      "LPT9",
    ];
    for (const name of reservedNames) {
      expect(() => validateProjectName(name)).toThrow(/reserved/i);
    }
  });

  it("throws for Windows reserved names case-insensitively", () => {
    expect(() => validateProjectName("con")).toThrow(/reserved/i);
    expect(() => validateProjectName("Con")).toThrow(/reserved/i);
    expect(() => validateProjectName("CON")).toThrow(/reserved/i);
    expect(() => validateProjectName("nul")).toThrow(/reserved/i);
    expect(() => validateProjectName("com1")).toThrow(/reserved/i);
    expect(() => validateProjectName("lpt9")).toThrow(/reserved/i);
  });

  it("accepts names that contain reserved names as substrings", () => {
    expect(validateProjectName("icon")).toBe("icon");
    expect(validateProjectName("conway")).toBe("conway");
    expect(validateProjectName("my-aux-project")).toBe("my-aux-project");
    expect(validateProjectName("com10")).toBe("com10");
  });

  it("throws when name starts or ends with space", () => {
    expect(() => validateProjectName(" project")).toThrow(/whitespace/i);
    expect(() => validateProjectName("project ")).toThrow(/whitespace/i);
  });

  it("throws when name starts or ends with dot", () => {
    expect(() => validateProjectName(".project")).toThrow(/dot/i);
    expect(() => validateProjectName("project.")).toThrow(/dot/i);
  });

  it("accepts names with dots in the middle", () => {
    expect(validateProjectName("my.project")).toBe("my.project");
    expect(validateProjectName("v1.0.0")).toBe("v1.0.0");
  });
});
