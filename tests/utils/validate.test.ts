import { describe, it, expect } from "vitest";
import {
  validateConfig,
  validateBmadConfig,
  validateState,
  validateCircuitBreakerState,
  validateRalphSession,
  validateRalphApiStatus,
  validateRalphLoopStatus,
  validateProjectName,
  normalizeRalphStatus,
  parseInterval,
} from "../../src/utils/validate.js";
import { DEFAULT_INTERVAL_MS } from "../../src/utils/constants.js";

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

describe("validateBmadConfig", () => {
  it("accepts a valid config with all optional fields", () => {
    const data = {
      platform: "claude-code",
      project_name: "my-project",
      output_folder: "_bmad-output",
      user_name: "alice",
      communication_language: "en",
      document_output_language: "en",
      user_skill_level: "advanced",
      planning_artifacts: "docs/planning",
      implementation_artifacts: "docs/impl",
      project_knowledge: "docs/knowledge",
      modules: ["core", "extras"],
    };
    const result = validateBmadConfig(data);
    expect(result).toEqual(data);
  });

  it("accepts modules as undefined", () => {
    const result = validateBmadConfig({});
    expect(result.modules).toBeUndefined();
  });

  it("throws when modules is not an array", () => {
    expect(() => validateBmadConfig({ modules: "core" })).toThrow(/modules must be an array/i);
  });

  it("throws when modules contains non-string elements", () => {
    expect(() => validateBmadConfig({ modules: [123, true] })).toThrow(
      /modules must be an array of strings/i
    );
  });

  it("throws when modules contains a mix of strings and non-strings", () => {
    expect(() => validateBmadConfig({ modules: ["core", 42] })).toThrow(
      /modules must be an array of strings/i
    );
  });

  it("accepts an empty modules array", () => {
    const result = validateBmadConfig({ modules: [] });
    expect(result.modules).toEqual([]);
  });

  it("throws when data is null", () => {
    expect(() => validateBmadConfig(null)).toThrow(/expected an object/i);
  });

  it("throws when data is undefined", () => {
    expect(() => validateBmadConfig(undefined)).toThrow(/expected an object/i);
  });

  it("throws when data is a string", () => {
    expect(() => validateBmadConfig("string")).toThrow(/expected an object/i);
  });

  it("throws when data is an array", () => {
    expect(() => validateBmadConfig([1, 2])).toThrow(/expected an object/i);
  });

  it("throws when platform is not a string", () => {
    expect(() => validateBmadConfig({ platform: 123 })).toThrow(/platform must be a string/i);
  });

  it("throws when project_name is not a string", () => {
    expect(() => validateBmadConfig({ project_name: true })).toThrow(
      /project_name must be a string/i
    );
  });

  it("throws when output_folder is not a string", () => {
    expect(() => validateBmadConfig({ output_folder: 42 })).toThrow(
      /output_folder must be a string/i
    );
  });

  it("throws when user_name is not a string", () => {
    expect(() => validateBmadConfig({ user_name: [] })).toThrow(/user_name must be a string/i);
  });

  it("throws when communication_language is not a string", () => {
    expect(() => validateBmadConfig({ communication_language: false })).toThrow(
      /communication_language must be a string/i
    );
  });

  it("throws when document_output_language is not a string", () => {
    expect(() => validateBmadConfig({ document_output_language: 0 })).toThrow(
      /document_output_language must be a string/i
    );
  });

  it("throws when user_skill_level is not a string", () => {
    expect(() => validateBmadConfig({ user_skill_level: {} })).toThrow(
      /user_skill_level must be a string/i
    );
  });

  it("throws when planning_artifacts is not a string", () => {
    expect(() => validateBmadConfig({ planning_artifacts: 99 })).toThrow(
      /planning_artifacts must be a string/i
    );
  });

  it("throws when implementation_artifacts is not a string", () => {
    expect(() => validateBmadConfig({ implementation_artifacts: null })).toThrow(
      /implementation_artifacts must be a string/i
    );
  });

  it("throws when project_knowledge is not a string", () => {
    expect(() => validateBmadConfig({ project_knowledge: true })).toThrow(
      /project_knowledge must be a string/i
    );
  });

  it("ignores extra unknown fields in output", () => {
    const result = validateBmadConfig({ platform: "claude-code", unknown_field: "ignored" });
    expect(result).toEqual({ platform: "claude-code" });
    expect(result).not.toHaveProperty("unknown_field");
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
    expect(result.kind).toBe("active");
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
    expect(result.kind).toBe("active");
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

  it("normalizes empty session_id with reset metadata to an inactive session", () => {
    const data = {
      session_id: "",
      reset_at: "2025-01-01T00:05:00.000Z",
      reset_reason: "permission_denied",
    };
    const result = validateRalphSession(data);
    expect(result.kind).toBe("inactive");
    expect(result.session_id).toBe("");
    expect(result.reset_reason).toBe("permission_denied");
  });

  it("normalizes legacy reset payloads with stray timestamps to inactive", () => {
    const data = {
      session_id: "",
      created_at: "",
      last_used: "",
      reset_at: "2025-01-01T00:05:00.000Z",
      reset_reason: "permission_denied",
    };
    const result = validateRalphSession(data);
    expect(result.kind).toBe("inactive");
    expect(result.session_id).toBe("");
  });

  it("treats empty session_id as inactive even when created_at looks valid", () => {
    const data = { session_id: "", created_at: "2025-01-01T00:00:00.000Z" };
    const result = validateRalphSession(data);
    expect(result.kind).toBe("inactive");
  });

  it("throws when active created_at cannot be parsed", () => {
    const data = { session_id: "abc", created_at: "not-a-date" };
    expect(() => validateRalphSession(data)).toThrow(/created_at/i);
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
    for (const status of ["running", "blocked", "completed", "not_started", "unknown"]) {
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

describe("normalizeRalphStatus", () => {
  it("maps bash snake_case format to camelCase RalphLoopStatus", () => {
    const bashData = {
      loop_count: 7,
      calls_made_this_hour: 42,
      max_calls_per_hour: 200,
      last_action: "implemented auth module",
      status: "running",
      tasks_completed: 5,
      tasks_total: 12,
    };
    const result = normalizeRalphStatus(bashData);
    expect(result).toEqual({
      loopCount: 7,
      status: "running",
      tasksCompleted: 5,
      tasksTotal: 12,
    });
  });

  it("maps bash status 'running' to 'running'", () => {
    const result = normalizeRalphStatus({ loop_count: 1, status: "running" });
    expect(result.status).toBe("running");
  });

  it("maps bash status 'halted' to 'blocked'", () => {
    const result = normalizeRalphStatus({ loop_count: 1, status: "halted" });
    expect(result.status).toBe("blocked");
  });

  it("maps bash status 'stopped' to 'blocked'", () => {
    const result = normalizeRalphStatus({ loop_count: 1, status: "stopped" });
    expect(result.status).toBe("blocked");
  });

  it("maps bash status 'completed' to 'completed'", () => {
    const result = normalizeRalphStatus({ loop_count: 1, status: "completed" });
    expect(result.status).toBe("completed");
  });

  it("maps bash status 'success' to 'completed'", () => {
    const result = normalizeRalphStatus({ loop_count: 1, status: "success" });
    expect(result.status).toBe("completed");
  });

  it("maps paused bash status to 'blocked'", () => {
    const result = normalizeRalphStatus({ loop_count: 1, status: "paused" });
    expect(result.status).toBe("blocked");
  });

  it("maps error bash status to 'blocked'", () => {
    const result = normalizeRalphStatus({ loop_count: 1, status: "error" });
    expect(result.status).toBe("blocked");
  });

  it("maps unknown bash status to 'unknown'", () => {
    const result = normalizeRalphStatus({ loop_count: 1, status: "banana" });
    expect(result.status).toBe("unknown");
  });

  it("defaults loopCount to 0 when loop_count is missing", () => {
    const result = normalizeRalphStatus({ status: "running" });
    expect(result.loopCount).toBe(0);
  });

  it("defaults loopCount to 0 when loop_count is not a number", () => {
    const result = normalizeRalphStatus({ loop_count: "five", status: "running" });
    expect(result.loopCount).toBe(0);
  });

  it("defaults status to 'unknown' when status is missing", () => {
    const result = normalizeRalphStatus({ loop_count: 3 });
    expect(result.status).toBe("unknown");
  });

  it("reads task counts when present in bash data", () => {
    const result = normalizeRalphStatus({
      loop_count: 5,
      status: "running",
      tasks_completed: 3,
      tasks_total: 10,
    });
    expect(result.tasksCompleted).toBe(3);
    expect(result.tasksTotal).toBe(10);
  });

  it("defaults tasksCompleted and tasksTotal to 0 when not present", () => {
    const result = normalizeRalphStatus({ loop_count: 5, status: "running" });
    expect(result.tasksCompleted).toBe(0);
    expect(result.tasksTotal).toBe(0);
  });

  it("defaults task counts to 0 when values are non-numeric", () => {
    const result = normalizeRalphStatus({
      loop_count: 5,
      status: "running",
      tasks_completed: "three",
      tasks_total: null,
    });
    expect(result.tasksCompleted).toBe(0);
    expect(result.tasksTotal).toBe(0);
  });

  it("throws when data is not an object", () => {
    expect(() => normalizeRalphStatus(null)).toThrow();
    expect(() => normalizeRalphStatus("string")).toThrow();
    expect(() => normalizeRalphStatus(42)).toThrow();
  });

  it("throws when data is an array", () => {
    expect(() => normalizeRalphStatus([])).toThrow();
  });

  it("handles bash data with exit_reason field", () => {
    const bashData = {
      loop_count: 12,
      status: "completed",
      exit_reason: "all tasks done",
    };
    const result = normalizeRalphStatus(bashData);
    expect(result.loopCount).toBe(12);
    expect(result.status).toBe("completed");
  });

  it("maps bash status 'graceful_exit' to 'completed'", () => {
    const result = normalizeRalphStatus({ loop_count: 15, status: "graceful_exit" });
    expect(result.status).toBe("completed");
  });
});

describe("parseInterval", () => {
  it("returns DEFAULT_INTERVAL_MS when value is undefined", () => {
    expect(parseInterval(undefined)).toBe(DEFAULT_INTERVAL_MS);
  });

  it("parses valid string to number", () => {
    expect(parseInterval("5000")).toBe(5000);
  });

  it("accepts boundary value of 500", () => {
    expect(parseInterval("500")).toBe(500);
  });

  it("throws for value below minimum", () => {
    expect(() => parseInterval("100")).toThrow("500");
  });

  it("throws for non-numeric value", () => {
    expect(() => parseInterval("abc")).toThrow("500");
  });

  it("throws for partially numeric string like '500abc'", () => {
    expect(() => parseInterval("500abc")).toThrow();
  });

  it("throws for string with leading numeric chars like '1000xyz'", () => {
    expect(() => parseInterval("1000xyz")).toThrow();
  });

  it("accepts valid integer string '3000'", () => {
    expect(parseInterval("3000")).toBe(3000);
  });
});
