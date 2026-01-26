import type { BmalphConfig, UpstreamVersions } from "./config.js";
import type { BmalphState } from "./state.js";

const VALID_STATUSES = ["planning", "implementing", "completed"] as const;

// Invalid filesystem characters (Windows + POSIX)
const INVALID_FS_CHARS = /[<>:"/\\|?*]/;

// Windows reserved names (case-insensitive, exact match only)
const WINDOWS_RESERVED_NAMES = new Set([
  "con", "prn", "aux", "nul",
  "com1", "com2", "com3", "com4", "com5", "com6", "com7", "com8", "com9",
  "lpt1", "lpt2", "lpt3", "lpt4", "lpt5", "lpt6", "lpt7", "lpt8", "lpt9",
]);

const MAX_PROJECT_NAME_LENGTH = 100;

function assertObject(data: unknown, label: string): asserts data is Record<string, unknown> {
  if (data === null || data === undefined || typeof data !== "object" || Array.isArray(data)) {
    throw new Error(`${label}: expected an object`);
  }
}

function validateUpstreamVersions(data: unknown): UpstreamVersions {
  assertObject(data, "upstreamVersions");

  if (typeof data.bmadCommit !== "string") {
    throw new Error("upstreamVersions.bmadCommit must be a string");
  }

  if (typeof data.ralphCommit !== "string") {
    throw new Error("upstreamVersions.ralphCommit must be a string");
  }

  return {
    bmadCommit: data.bmadCommit,
    ralphCommit: data.ralphCommit,
  };
}

export function validateConfig(data: unknown): BmalphConfig {
  assertObject(data, "config");

  if (typeof data.name !== "string") {
    throw new Error("config.name must be a string");
  }

  if (typeof data.createdAt !== "string") {
    throw new Error("config.createdAt must be a string");
  }

  const description = typeof data.description === "string" ? data.description : "";

  const upstreamVersions =
    data.upstreamVersions !== undefined ? validateUpstreamVersions(data.upstreamVersions) : undefined;

  return {
    name: data.name,
    description,
    createdAt: data.createdAt,
    upstreamVersions,
  };
}

export function validateState(data: unknown): BmalphState {
  assertObject(data, "state");

  if (typeof data.currentPhase !== "number") {
    throw new Error("state.currentPhase must be a number");
  }

  if (typeof data.status !== "string" || !VALID_STATUSES.includes(data.status as typeof VALID_STATUSES[number])) {
    throw new Error(`state.status must be one of: ${VALID_STATUSES.join(", ")}`);
  }

  if (typeof data.startedAt !== "string") {
    throw new Error("state.startedAt must be a string");
  }

  if (typeof data.lastUpdated !== "string") {
    throw new Error("state.lastUpdated must be a string");
  }

  return {
    currentPhase: data.currentPhase,
    status: data.status as BmalphState["status"],
    startedAt: data.startedAt,
    lastUpdated: data.lastUpdated,
  };
}

// Circuit breaker state (from .ralph/.circuit_breaker_state)
const CIRCUIT_BREAKER_STATES = ["CLOSED", "HALF_OPEN", "OPEN"] as const;

export interface CircuitBreakerState {
  state: "CLOSED" | "HALF_OPEN" | "OPEN";
  consecutive_no_progress: number;
  reason?: string;
}

export function validateCircuitBreakerState(data: unknown): CircuitBreakerState {
  assertObject(data, "circuitBreakerState");

  if (typeof data.state !== "string" || !CIRCUIT_BREAKER_STATES.includes(data.state as typeof CIRCUIT_BREAKER_STATES[number])) {
    throw new Error(`circuitBreakerState.state must be one of: ${CIRCUIT_BREAKER_STATES.join(", ")}`);
  }

  if (typeof data.consecutive_no_progress !== "number") {
    throw new Error("circuitBreakerState.consecutive_no_progress must be a number");
  }

  const reason = typeof data.reason === "string" ? data.reason : undefined;

  return {
    state: data.state as CircuitBreakerState["state"],
    consecutive_no_progress: data.consecutive_no_progress,
    reason,
  };
}

// Ralph session (from .ralph/.ralph_session)
export interface RalphSession {
  session_id: string;
  created_at: string;
  last_used?: string;
}

export function validateRalphSession(data: unknown): RalphSession {
  assertObject(data, "ralphSession");

  if (typeof data.session_id !== "string") {
    throw new Error("ralphSession.session_id must be a string");
  }

  if (typeof data.created_at !== "string") {
    throw new Error("ralphSession.created_at must be a string");
  }

  const last_used = typeof data.last_used === "string" ? data.last_used : undefined;

  return {
    session_id: data.session_id,
    created_at: data.created_at,
    last_used,
  };
}

// Ralph API status (from .ralph/status.json - API call tracking)
export interface RalphApiStatus {
  calls_made_this_hour: number;
  max_calls_per_hour: number;
  status?: string;
}

export function validateRalphApiStatus(data: unknown): RalphApiStatus {
  assertObject(data, "ralphApiStatus");

  if (typeof data.calls_made_this_hour !== "number") {
    throw new Error("ralphApiStatus.calls_made_this_hour must be a number");
  }

  if (typeof data.max_calls_per_hour !== "number") {
    throw new Error("ralphApiStatus.max_calls_per_hour must be a number");
  }

  const status = typeof data.status === "string" ? data.status : undefined;

  return {
    calls_made_this_hour: data.calls_made_this_hour,
    max_calls_per_hour: data.max_calls_per_hour,
    status,
  };
}

// Ralph loop status (from state.ts - loop progress tracking)
const RALPH_LOOP_STATUSES = ["running", "blocked", "completed", "not_started"] as const;

export interface RalphLoopStatus {
  loopCount: number;
  status: "running" | "blocked" | "completed" | "not_started";
  tasksCompleted: number;
  tasksTotal: number;
}

export function validateRalphLoopStatus(data: unknown): RalphLoopStatus {
  assertObject(data, "ralphLoopStatus");

  if (typeof data.loopCount !== "number") {
    throw new Error("ralphLoopStatus.loopCount must be a number");
  }

  if (typeof data.status !== "string" || !RALPH_LOOP_STATUSES.includes(data.status as typeof RALPH_LOOP_STATUSES[number])) {
    throw new Error(`ralphLoopStatus.status must be one of: ${RALPH_LOOP_STATUSES.join(", ")}`);
  }

  if (typeof data.tasksCompleted !== "number") {
    throw new Error("ralphLoopStatus.tasksCompleted must be a number");
  }

  if (typeof data.tasksTotal !== "number") {
    throw new Error("ralphLoopStatus.tasksTotal must be a number");
  }

  return {
    loopCount: data.loopCount,
    status: data.status as RalphLoopStatus["status"],
    tasksCompleted: data.tasksCompleted,
    tasksTotal: data.tasksTotal,
  };
}

/**
 * Validates a project name for filesystem safety.
 * Checks for:
 * - Empty names
 * - Max length (100 characters)
 * - Invalid filesystem characters (< > : " / \ | ? *)
 * - Windows reserved names (CON, PRN, AUX, NUL, COM1-9, LPT1-9)
 * - Leading/trailing whitespace or dots
 *
 * @param name - The project name to validate
 * @returns The validated name (unchanged if valid)
 * @throws Error if the name is invalid
 */
export function validateProjectName(name: string): string {
  const trimmed = name.trim();

  // Check for empty name
  if (trimmed.length === 0) {
    throw new Error("Project name cannot be empty");
  }

  // Check for leading/trailing whitespace (original had whitespace that was trimmed)
  if (name !== trimmed) {
    throw new Error("Project name cannot start or end with whitespace");
  }

  // Check max length
  if (name.length > MAX_PROJECT_NAME_LENGTH) {
    throw new Error(`Project name cannot exceed ${MAX_PROJECT_NAME_LENGTH} characters`);
  }

  // Check for invalid filesystem characters
  if (INVALID_FS_CHARS.test(name)) {
    throw new Error("Project name contains invalid character (< > : \" / \\ | ? * are not allowed)");
  }

  // Check for Windows reserved names (case-insensitive, exact match)
  if (WINDOWS_RESERVED_NAMES.has(name.toLowerCase())) {
    throw new Error(`Project name "${name}" is a reserved Windows filename`);
  }

  // Check for leading/trailing dots
  if (name.startsWith(".") || name.endsWith(".")) {
    throw new Error("Project name cannot start or end with a dot");
  }

  return name;
}
