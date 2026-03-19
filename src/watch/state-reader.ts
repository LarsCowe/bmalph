import { join } from "node:path";
import { open, readFile } from "node:fs/promises";
import { readJsonFile } from "../utils/json.js";
import { RALPH_DIR } from "../utils/constants.js";
import { parseFixPlan } from "../transition/fix-plan.js";
import { debug } from "../utils/logger.js";
import { formatError } from "../utils/errors.js";
import {
  readRalphCircuitBreaker,
  readRalphRuntimeSession,
  readRalphRuntimeStatus,
} from "../utils/ralph-runtime-state.js";
import type {
  DashboardState,
  LoopInfo,
  CircuitBreakerInfo,
  StoryProgress,
  AnalysisInfo,
  ExecutionProgress,
  SessionInfo,
  ReviewInfo,
  LogEntry,
} from "./types.js";

const LOG_LINE_PATTERN = /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\] \[(\w+)\] (.+)$/;
const DEFAULT_MAX_LOG_LINES = 8;
const TAIL_BYTES = 4096;

export async function readDashboardState(projectDir: string): Promise<DashboardState> {
  const [loop, circuitBreaker, stories, analysis, execution, session, review, recentLogs, liveLog] =
    await Promise.all([
      readLoopInfo(projectDir),
      readCircuitBreakerInfo(projectDir),
      readStoryProgress(projectDir),
      readAnalysisInfo(projectDir),
      readExecutionProgress(projectDir),
      readSessionInfo(projectDir),
      readReviewInfo(projectDir),
      readRecentLogs(projectDir),
      readLiveLog(projectDir),
    ]);

  const ralphCompleted = loop !== null && loop.status === "completed";

  return {
    loop,
    circuitBreaker,
    stories,
    analysis,
    execution,
    session,
    review,
    recentLogs,
    liveLog,
    ralphCompleted,
    lastUpdated: new Date(),
  };
}

export async function readLoopInfo(projectDir: string): Promise<LoopInfo | null> {
  const result = await readRalphRuntimeStatus(projectDir);
  if (result.kind === "missing") {
    return null;
  }

  if (result.kind !== "ok") {
    debug(`Failed to read loop info: ${formatError(result.error)}`);
    return null;
  }

  return {
    loopCount: result.value.loopCount,
    status: result.value.status,
    lastAction: result.value.lastAction,
    callsMadeThisHour: result.value.callsMadeThisHour,
    maxCallsPerHour: result.value.maxCallsPerHour,
  };
}

export async function readCircuitBreakerInfo(
  projectDir: string
): Promise<CircuitBreakerInfo | null> {
  const result = await readRalphCircuitBreaker(projectDir);
  if (result.kind === "missing") {
    return null;
  }

  if (result.kind !== "ok") {
    debug(`Failed to read circuit breaker info: ${formatError(result.error)}`);
    return null;
  }

  return {
    state: result.value.state,
    consecutiveNoProgress: result.value.consecutiveNoProgress,
    totalOpens: result.value.totalOpens,
    reason: result.value.reason,
  };
}

export async function readStoryProgress(projectDir: string): Promise<StoryProgress | null> {
  let content: string;
  try {
    content = await readFile(join(projectDir, RALPH_DIR, "@fix_plan.md"), "utf-8");
  } catch (err) {
    debug(`Failed to read fix plan: ${formatError(err)}`);
    return null;
  }

  const items = parseFixPlan(content);
  const completed = items.filter((item) => item.completed).length;
  const total = items.length;
  const nextItem = items.find((item) => !item.completed);
  const nextStory = nextItem ? `Story ${nextItem.id}: ${nextItem.title ?? ""}`.trim() : null;

  return { completed, total, nextStory };
}

export async function readAnalysisInfo(projectDir: string): Promise<AnalysisInfo | null> {
  try {
    const data = await readJsonFile<Record<string, unknown>>(
      join(projectDir, RALPH_DIR, ".response_analysis")
    );
    if (data === null) return null;

    const analysis = data.analysis;
    if (typeof analysis !== "object" || analysis === null) return null;

    const a = analysis as Record<string, unknown>;
    const filesModified = typeof a.files_modified === "number" ? a.files_modified : 0;
    const confidenceScore = typeof a.confidence_score === "number" ? a.confidence_score : 0;
    const isTestOnly = typeof a.is_test_only === "boolean" ? a.is_test_only : false;
    const isStuck = typeof a.is_stuck === "boolean" ? a.is_stuck : false;
    const exitSignal = typeof a.exit_signal === "boolean" ? a.exit_signal : false;
    const tasksCompletedThisLoop =
      typeof a.tasks_completed_this_loop === "number" ? a.tasks_completed_this_loop : 0;
    const fixPlanCompletedDelta =
      typeof a.fix_plan_completed_delta === "number" ? a.fix_plan_completed_delta : 0;
    const hasProgressTrackingMismatch =
      typeof a.has_progress_tracking_mismatch === "boolean"
        ? a.has_progress_tracking_mismatch
        : false;
    const hasPermissionDenials =
      typeof a.has_permission_denials === "boolean" ? a.has_permission_denials : false;
    const permissionDenialCount =
      typeof a.permission_denial_count === "number" ? a.permission_denial_count : 0;

    return {
      filesModified,
      confidenceScore,
      isTestOnly,
      isStuck,
      exitSignal,
      tasksCompletedThisLoop,
      fixPlanCompletedDelta,
      hasProgressTrackingMismatch,
      hasPermissionDenials,
      permissionDenialCount,
    };
  } catch (err) {
    debug(`Failed to read analysis info: ${formatError(err)}`);
    return null;
  }
}

export async function readExecutionProgress(projectDir: string): Promise<ExecutionProgress | null> {
  try {
    const data = await readJsonFile<Record<string, unknown>>(
      join(projectDir, RALPH_DIR, "progress.json")
    );
    if (data === null) return null;

    const status = typeof data.status === "string" ? data.status : "";
    if (status !== "executing") return null;

    const elapsedSeconds = typeof data.elapsed_seconds === "number" ? data.elapsed_seconds : 0;
    const indicator = typeof data.indicator === "string" ? data.indicator : "⠋";
    const lastOutput = typeof data.last_output === "string" ? data.last_output : "";

    return { status, elapsedSeconds, indicator, lastOutput };
  } catch (err) {
    debug(`Failed to read execution progress: ${formatError(err)}`);
    return null;
  }
}

export async function readSessionInfo(projectDir: string): Promise<SessionInfo | null> {
  const result = await readRalphRuntimeSession(projectDir);
  if (result.kind === "missing") {
    return null;
  }

  if (result.kind !== "ok") {
    debug(`Failed to read session info: ${formatError(result.error)}`);
    return null;
  }

  if (result.value.kind !== "active") {
    return null;
  }

  return {
    createdAt: result.value.created_at,
    lastUsed: result.value.last_used,
  };
}

export async function readReviewInfo(projectDir: string): Promise<ReviewInfo | null> {
  try {
    const data = await readJsonFile<Record<string, unknown>>(
      join(projectDir, RALPH_DIR, ".review_findings.json")
    );
    if (data === null) return null;

    const issuesFound = typeof data.issues_found === "number" ? data.issues_found : 0;
    if (issuesFound === 0) return null;

    const severity = typeof data.severity === "string" ? data.severity : "LOW";
    const summary = typeof data.summary === "string" ? data.summary : "";

    return { issuesFound, severity, summary };
  } catch (err) {
    debug(`Failed to read review info: ${formatError(err)}`);
    return null;
  }
}

const LIVE_LOG_MAX_LINES = 5;
const LIVE_LOG_TAIL_BYTES = 2048;

export async function readLiveLog(projectDir: string): Promise<string[]> {
  const logPath = join(projectDir, RALPH_DIR, "live.log");
  let content: string;
  try {
    const fh = await open(logPath, "r");
    try {
      const stats = await fh.stat();
      if (stats.size === 0) {
        return [];
      }
      if (stats.size <= LIVE_LOG_TAIL_BYTES) {
        content = await fh.readFile("utf-8");
      } else {
        const position = stats.size - LIVE_LOG_TAIL_BYTES;
        const buf = Buffer.alloc(LIVE_LOG_TAIL_BYTES);
        const { bytesRead } = await fh.read(buf, 0, LIVE_LOG_TAIL_BYTES, position);
        const raw = buf.toString("utf-8", 0, bytesRead);
        const newlineIdx = raw.indexOf("\n");
        content = newlineIdx >= 0 ? raw.slice(newlineIdx + 1) : raw;
      }
    } finally {
      await fh.close();
    }
  } catch (err) {
    debug(`Failed to read live log: ${formatError(err)}`);
    return [];
  }

  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0);
  return lines.slice(-LIVE_LOG_MAX_LINES);
}

export async function readRecentLogs(
  projectDir: string,
  maxLines: number = DEFAULT_MAX_LOG_LINES
): Promise<LogEntry[]> {
  const logPath = join(projectDir, RALPH_DIR, "logs", "ralph.log");
  let content: string;
  try {
    const fh = await open(logPath, "r");
    try {
      const stats = await fh.stat();
      if (stats.size === 0) {
        return [];
      }
      if (stats.size <= TAIL_BYTES) {
        content = await fh.readFile("utf-8");
      } else {
        const position = stats.size - TAIL_BYTES;
        const buf = Buffer.alloc(TAIL_BYTES);
        const { bytesRead } = await fh.read(buf, 0, TAIL_BYTES, position);
        const raw = buf.toString("utf-8", 0, bytesRead);
        const newlineIdx = raw.indexOf("\n");
        content = newlineIdx >= 0 ? raw.slice(newlineIdx + 1) : raw;
      }
    } finally {
      await fh.close();
    }
  } catch (err) {
    debug(`Failed to read recent logs: ${formatError(err)}`);
    return [];
  }

  const lines = content.split(/\r?\n/).filter((line) => line.length > 0);
  const tail = lines.slice(-maxLines);

  const entries: LogEntry[] = [];
  for (const line of tail) {
    const match = LOG_LINE_PATTERN.exec(line);
    if (match) {
      entries.push({
        timestamp: match[1]!,
        level: match[2]!,
        message: match[3]!,
      });
    }
  }

  return entries;
}
