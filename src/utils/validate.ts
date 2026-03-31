import type { BmalphConfig, BmadConfig, UpstreamVersions } from "./config.js";
import type { BmalphState } from "./state.js";
import { PLATFORM_IDS, type PlatformId } from "../platform/types.js";
import {
  DEFAULT_INTERVAL_MS,
  MAX_PROJECT_NAME_LENGTH,
  MIN_INTERVAL_MS,
  RALPH_STATUS_MAP,
} from "./constants.js";

const VALID_STATUSES = ["planning", "implementing", "completed"] as const;

// Invalid filesystem characters (Windows + POSIX)
const INVALID_FS_CHARS = /[<>:"/\\|?*]/;

// Windows reserved names (case-insensitive, exact match only)
const WINDOWS_RESERVED_NAMES = new Set([
  "con",
  "prn",
  "aux",
  "nul",
  "com1",
  "com2",
  "com3",
  "com4",
  "com5",
  "com6",
  "com7",
  "com8",
  "com9",
  "lpt1",
  "lpt2",
  "lpt3",
  "lpt4",
  "lpt5",
  "lpt6",
  "lpt7",
  "lpt8",
  "lpt9",
]);

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

  return {
    bmadCommit: data.bmadCommit,
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

  let platform: PlatformId | undefined;
  if (data.platform !== undefined) {
    if (
      typeof data.platform !== "string" ||
      !(PLATFORM_IDS as readonly string[]).includes(data.platform)
    ) {
      throw new Error(`config.platform must be one of: ${PLATFORM_IDS.join(", ")}`);
    }
    platform = data.platform as PlatformId;
  }

  const upstreamVersions =
    data.upstreamVersions !== undefined
      ? validateUpstreamVersions(data.upstreamVersions)
      : undefined;

  return {
    name: data.name,
    description,
    createdAt: data.createdAt,
    ...(platform !== undefined && { platform }),
    upstreamVersions,
  };
}

export function validateBmadConfig(data: unknown): BmadConfig {
  assertObject(data, "bmadConfig");

  let platform: string | undefined;
  if (data.platform !== undefined) {
    if (typeof data.platform !== "string") {
      throw new Error("bmadConfig.platform must be a string");
    }
    platform = data.platform;
  }

  let project_name: string | undefined;
  if (data.project_name !== undefined) {
    if (typeof data.project_name !== "string") {
      throw new Error("bmadConfig.project_name must be a string");
    }
    project_name = data.project_name;
  }

  let output_folder: string | undefined;
  if (data.output_folder !== undefined) {
    if (typeof data.output_folder !== "string") {
      throw new Error("bmadConfig.output_folder must be a string");
    }
    output_folder = data.output_folder;
  }

  let user_name: string | undefined;
  if (data.user_name !== undefined) {
    if (typeof data.user_name !== "string") {
      throw new Error("bmadConfig.user_name must be a string");
    }
    user_name = data.user_name;
  }

  let communication_language: string | undefined;
  if (data.communication_language !== undefined) {
    if (typeof data.communication_language !== "string") {
      throw new Error("bmadConfig.communication_language must be a string");
    }
    communication_language = data.communication_language;
  }

  let document_output_language: string | undefined;
  if (data.document_output_language !== undefined) {
    if (typeof data.document_output_language !== "string") {
      throw new Error("bmadConfig.document_output_language must be a string");
    }
    document_output_language = data.document_output_language;
  }

  let user_skill_level: string | undefined;
  if (data.user_skill_level !== undefined) {
    if (typeof data.user_skill_level !== "string") {
      throw new Error("bmadConfig.user_skill_level must be a string");
    }
    user_skill_level = data.user_skill_level;
  }

  let planning_artifacts: string | undefined;
  if (data.planning_artifacts !== undefined) {
    if (typeof data.planning_artifacts !== "string") {
      throw new Error("bmadConfig.planning_artifacts must be a string");
    }
    planning_artifacts = data.planning_artifacts;
  }

  let implementation_artifacts: string | undefined;
  if (data.implementation_artifacts !== undefined) {
    if (typeof data.implementation_artifacts !== "string") {
      throw new Error("bmadConfig.implementation_artifacts must be a string");
    }
    implementation_artifacts = data.implementation_artifacts;
  }

  let project_knowledge: string | undefined;
  if (data.project_knowledge !== undefined) {
    if (typeof data.project_knowledge !== "string") {
      throw new Error("bmadConfig.project_knowledge must be a string");
    }
    project_knowledge = data.project_knowledge;
  }

  let modules: string[] | undefined;
  if (data.modules !== undefined) {
    if (
      !Array.isArray(data.modules) ||
      !data.modules.every((m: unknown) => typeof m === "string")
    ) {
      throw new Error("bmadConfig.modules must be an array of strings");
    }
    modules = data.modules;
  }

  return {
    platform,
    project_name,
    output_folder,
    user_name,
    communication_language,
    document_output_language,
    user_skill_level,
    planning_artifacts,
    implementation_artifacts,
    project_knowledge,
    modules,
  };
}

export function validateState(data: unknown): BmalphState {
  assertObject(data, "state");

  if (typeof data.currentPhase !== "number") {
    throw new Error("state.currentPhase must be a number");
  }

  if (
    typeof data.status !== "string" ||
    !VALID_STATUSES.includes(data.status as (typeof VALID_STATUSES)[number])
  ) {
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

  if (
    typeof data.state !== "string" ||
    !CIRCUIT_BREAKER_STATES.includes(data.state as (typeof CIRCUIT_BREAKER_STATES)[number])
  ) {
    throw new Error(
      `circuitBreakerState.state must be one of: ${CIRCUIT_BREAKER_STATES.join(", ")}`
    );
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
export interface ActiveRalphSession {
  kind: "active";
  session_id: string;
  created_at: string;
  last_used?: string;
}

export interface InactiveRalphSession {
  kind: "inactive";
  session_id: "";
  reset_at?: string;
  reset_reason?: string;
}

export type RalphSession = ActiveRalphSession | InactiveRalphSession;

export function validateRalphSession(data: unknown): RalphSession {
  assertObject(data, "ralphSession");

  if (typeof data.session_id !== "string") {
    throw new Error("ralphSession.session_id must be a string");
  }

  if (data.session_id === "") {
    const reset_at = typeof data.reset_at === "string" ? data.reset_at : undefined;
    const reset_reason = typeof data.reset_reason === "string" ? data.reset_reason : undefined;

    return {
      kind: "inactive",
      session_id: "",
      reset_at,
      reset_reason,
    };
  }

  if (typeof data.created_at !== "string") {
    throw new Error("ralphSession.created_at must be a string");
  }

  if (Number.isNaN(new Date(data.created_at).getTime())) {
    throw new Error("ralphSession.created_at must be a valid timestamp");
  }

  const last_used = typeof data.last_used === "string" ? data.last_used : undefined;

  return {
    kind: "active",
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
const RALPH_LOOP_STATUSES = ["running", "blocked", "completed", "not_started", "unknown"] as const;

export interface RalphLoopStatus {
  loopCount: number;
  status: "running" | "blocked" | "completed" | "not_started" | "unknown";
  tasksCompleted: number;
  tasksTotal: number;
}

export function validateRalphLoopStatus(data: unknown): RalphLoopStatus {
  assertObject(data, "ralphLoopStatus");

  if (typeof data.loopCount !== "number") {
    throw new Error("ralphLoopStatus.loopCount must be a number");
  }

  if (
    typeof data.status !== "string" ||
    !RALPH_LOOP_STATUSES.includes(data.status as (typeof RALPH_LOOP_STATUSES)[number])
  ) {
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

// Loose normalization helper for non-runtime consumers and legacy tests.
// Runtime-file parsing uses the stricter contract in ralph-runtime-state.ts.
export function normalizeRalphStatus(data: unknown): RalphLoopStatus {
  assertObject(data, "normalizeRalphStatus");

  const loopCount = typeof data.loop_count === "number" ? data.loop_count : 0;
  const rawStatus = typeof data.status === "string" ? data.status : undefined;
  const status =
    (rawStatus !== undefined
      ? (RALPH_STATUS_MAP[rawStatus as keyof typeof RALPH_STATUS_MAP] as
          | RalphLoopStatus["status"]
          | undefined)
      : undefined) ?? "unknown";

  return {
    loopCount,
    status,
    tasksCompleted: typeof data.tasks_completed === "number" ? data.tasks_completed : 0,
    tasksTotal: typeof data.tasks_total === "number" ? data.tasks_total : 0,
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
    throw new Error('Project name contains invalid character (< > : " / \\ | ? * are not allowed)');
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

export function parseInterval(value?: string): number {
  if (value !== undefined && !Number.isFinite(Number(value))) {
    throw new Error(`Interval must be a number >= ${MIN_INTERVAL_MS} (milliseconds)`);
  }
  const interval = value !== undefined ? Number(value) : DEFAULT_INTERVAL_MS;
  if (interval < MIN_INTERVAL_MS) {
    throw new Error(`Interval must be a number >= ${MIN_INTERVAL_MS} (milliseconds)`);
  }
  return Math.trunc(interval);
}
