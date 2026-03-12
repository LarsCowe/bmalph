import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { RALPH_DIR, RALPH_STATUS_FILE } from "./constants.js";
import { isEnoent } from "./errors.js";
import {
  validateCircuitBreakerState,
  validateRalphLoopStatus,
  validateRalphSession,
  type CircuitBreakerState,
  type RalphLoopStatus,
  type RalphSession,
} from "./validate.js";

export interface RalphRuntimeStatus extends RalphLoopStatus {
  callsMadeThisHour: number;
  maxCallsPerHour: number;
  lastAction: string;
}

export interface RalphRuntimeCircuitBreaker {
  state: CircuitBreakerState["state"];
  consecutiveNoProgress: number;
  totalOpens: number;
  reason?: string;
}

export type RalphRuntimeReadResult<T> =
  | { kind: "ok"; path: string; value: T }
  | { kind: "missing"; path: string }
  | { kind: "invalid"; path: string; error: Error }
  | { kind: "unreadable"; path: string; error: Error };

const RALPH_SESSION_FILE = ".ralph_session";
const CIRCUIT_BREAKER_STATE_FILE = ".circuit_breaker_state";
const CAMEL_CASE_CORE_KEYS = ["loopCount", "tasksCompleted", "tasksTotal"] as const;
const SNAKE_CASE_CORE_KEYS = ["loop_count", "tasks_completed", "tasks_total"] as const;
const RAW_RALPH_STATUS_MAP = {
  running: "running",
  halted: "blocked",
  stopped: "blocked",
  completed: "completed",
  success: "completed",
  graceful_exit: "completed",
  paused: "blocked",
  error: "blocked",
} as const;

type StatusFormat = "camelCase" | "snakeCase";

export async function readRalphRuntimeStatus(
  projectDir: string
): Promise<RalphRuntimeReadResult<RalphRuntimeStatus>> {
  const path = join(projectDir, RALPH_STATUS_FILE);
  const raw = await readRuntimeJson(path);
  if (raw.kind !== "ok") {
    return raw;
  }

  try {
    const data = asObject(raw.value);
    const format = classifyStatusFormat(data);
    const normalized =
      format === "camelCase" ? validateRalphLoopStatus(data) : validateRalphSnakeCaseStatus(data);
    const [callsKey, maxCallsKey, lastActionKey] =
      format === "camelCase"
        ? ([
            ["callsMadeThisHour", "calls_made_this_hour"],
            ["maxCallsPerHour", "max_calls_per_hour"],
            ["lastAction", "last_action"],
          ] as const)
        : ([
            ["calls_made_this_hour", "callsMadeThisHour"],
            ["max_calls_per_hour", "maxCallsPerHour"],
            ["last_action", "lastAction"],
          ] as const);

    return {
      kind: "ok",
      path,
      value: {
        ...normalized,
        callsMadeThisHour: readOptionalNumber(data, ...callsKey),
        maxCallsPerHour: readOptionalNumber(data, ...maxCallsKey),
        lastAction: readOptionalString(data, ...lastActionKey),
      },
    };
  } catch (error) {
    return invalidResult(path, error);
  }
}

export async function readRalphRuntimeSession(
  projectDir: string
): Promise<RalphRuntimeReadResult<RalphSession>> {
  const path = join(projectDir, RALPH_DIR, RALPH_SESSION_FILE);
  const raw = await readRuntimeJson(path);
  if (raw.kind !== "ok") {
    return raw;
  }

  try {
    return {
      kind: "ok",
      path,
      value: validateRalphSession(raw.value),
    };
  } catch (error) {
    return invalidResult(path, error);
  }
}

export async function readRalphCircuitBreaker(
  projectDir: string
): Promise<RalphRuntimeReadResult<RalphRuntimeCircuitBreaker>> {
  const path = join(projectDir, RALPH_DIR, CIRCUIT_BREAKER_STATE_FILE);
  const raw = await readRuntimeJson(path);
  if (raw.kind !== "ok") {
    return raw;
  }

  try {
    const state = validateCircuitBreakerState(raw.value);
    const data = asObject(raw.value);

    return {
      kind: "ok",
      path,
      value: {
        state: state.state,
        consecutiveNoProgress: state.consecutive_no_progress,
        totalOpens: readOptionalNumber(data, "total_opens", "totalOpens"),
        reason: state.reason,
      },
    };
  } catch (error) {
    return invalidResult(path, error);
  }
}

async function readRuntimeJson(path: string): Promise<RalphRuntimeReadResult<unknown>> {
  let content: string;
  try {
    content = await readFile(path, "utf-8");
  } catch (error) {
    if (isEnoent(error)) {
      return { kind: "missing", path };
    }

    return unreadableResult(path, error);
  }

  try {
    return {
      kind: "ok",
      path,
      value: JSON.parse(content) as unknown,
    };
  } catch (error) {
    return invalidResult(path, new Error(`Invalid JSON in ${path}`, { cause: error }));
  }
}

function hasKnownCamelCaseLoopKey(data: unknown): boolean {
  if (!isObject(data)) {
    return false;
  }

  return CAMEL_CASE_CORE_KEYS.some((key) => key in data);
}

function hasKnownSnakeCaseCoreKey(data: unknown): boolean {
  if (!isObject(data)) {
    return false;
  }

  return SNAKE_CASE_CORE_KEYS.some((key) => key in data);
}

function classifyStatusFormat(data: Record<string, unknown>): StatusFormat {
  const hasCamelCore = hasKnownCamelCaseLoopKey(data);
  const hasSnakeCore = hasKnownSnakeCaseCoreKey(data);

  if (hasCamelCore && hasSnakeCore) {
    throw new Error("Mixed camelCase and snake_case core status fields are not supported");
  }

  if (hasCamelCore) {
    return "camelCase";
  }

  if ("loop_count" in data) {
    return "snakeCase";
  }

  throw new Error("Expected a camelCase loop status or Ralph snake_case status with loop_count");
}

function validateRalphSnakeCaseStatus(data: Record<string, unknown>): RalphLoopStatus {
  if (typeof data.loop_count !== "number") {
    throw new Error("ralphSnakeCaseStatus.loop_count must be a number");
  }

  if (typeof data.status !== "string") {
    throw new Error("ralphSnakeCaseStatus.status must be a string");
  }

  const mappedStatus =
    RAW_RALPH_STATUS_MAP[data.status as keyof typeof RAW_RALPH_STATUS_MAP] ?? undefined;
  if (mappedStatus === undefined) {
    throw new Error(
      `ralphSnakeCaseStatus.status must be one of: ${Object.keys(RAW_RALPH_STATUS_MAP).join(", ")}`
    );
  }

  if ("tasks_completed" in data && typeof data.tasks_completed !== "number") {
    throw new Error("ralphSnakeCaseStatus.tasks_completed must be a number");
  }

  if ("tasks_total" in data && typeof data.tasks_total !== "number") {
    throw new Error("ralphSnakeCaseStatus.tasks_total must be a number");
  }

  return {
    loopCount: data.loop_count,
    status: mappedStatus,
    tasksCompleted: typeof data.tasks_completed === "number" ? data.tasks_completed : 0,
    tasksTotal: typeof data.tasks_total === "number" ? data.tasks_total : 0,
  };
}

function readOptionalNumber(data: Record<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    if (!(key in data)) {
      continue;
    }

    if (typeof data[key] === "number") {
      return data[key];
    }

    throw new Error(`Expected ${keys.join(" or ")} to be a number`);
  }

  return 0;
}

function readOptionalString(data: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    if (!(key in data)) {
      continue;
    }

    if (typeof data[key] === "string") {
      return data[key];
    }

    throw new Error(`Expected ${keys.join(" or ")} to be a string`);
  }

  return "";
}

function asObject(data: unknown): Record<string, unknown> {
  if (isObject(data)) {
    return data;
  }

  throw new Error("Expected a JSON object");
}

function isObject(data: unknown): data is Record<string, unknown> {
  return data !== null && typeof data === "object" && !Array.isArray(data);
}

function invalidResult<T>(path: string, error: unknown): RalphRuntimeReadResult<T> {
  return {
    kind: "invalid",
    path,
    error: toError(error),
  };
}

function unreadableResult<T>(path: string, error: unknown): RalphRuntimeReadResult<T> {
  return {
    kind: "unreadable",
    path,
    error: toError(error),
  };
}

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}
