import { getBundledVersions } from "../installer.js";
import { checkUpstream, getSkipReason } from "../utils/github.js";
import { formatError } from "../utils/errors.js";
import {
  readRalphCircuitBreaker,
  readRalphRuntimeSession,
  readRalphRuntimeStatus,
} from "../utils/ralph-runtime-state.js";
import { SESSION_AGE_WARNING_MS, API_USAGE_WARNING_PERCENT } from "../utils/constants.js";
import type { CheckResult } from "./doctor.js";

export async function checkCircuitBreaker(projectDir: string): Promise<CheckResult> {
  const label = "circuit breaker";
  const result = await readRalphCircuitBreaker(projectDir);

  if (result.kind === "missing") {
    return { label, passed: true, detail: "not running" };
  }

  if (result.kind === "invalid") {
    return {
      label,
      passed: false,
      detail: "corrupt state file",
      hint: "Delete .ralph/.circuit_breaker_state and restart Ralph",
    };
  }

  if (result.kind === "unreadable") {
    return {
      label,
      passed: false,
      detail: "unreadable state file",
      hint: "Check file permissions or locks on .ralph/.circuit_breaker_state and restart Ralph",
    };
  }

  const state = result.value;
  if (state.state === "CLOSED") {
    const detail = `CLOSED (${state.consecutiveNoProgress} loops without progress)`;
    return { label, passed: true, detail };
  }
  if (state.state === "HALF_OPEN") {
    return { label, passed: true, detail: "HALF_OPEN - monitoring" };
  }

  const detail = `OPEN - ${state.reason ?? "stagnation detected"}`;
  return {
    label,
    passed: false,
    detail,
    hint: "Ralph detected stagnation. Review logs with: bmalph status",
  };
}

export async function checkRalphSession(projectDir: string): Promise<CheckResult> {
  const label = "Ralph session";
  const result = await readRalphRuntimeSession(projectDir);

  if (result.kind === "missing") {
    return { label, passed: true, detail: "no active session" };
  }

  if (result.kind === "invalid") {
    return {
      label,
      passed: false,
      detail: "corrupt session file",
      hint: "Delete .ralph/.ralph_session to reset",
    };
  }

  if (result.kind === "unreadable") {
    return {
      label,
      passed: false,
      detail: "unreadable session file",
      hint: "Check file permissions or locks on .ralph/.ralph_session and retry",
    };
  }

  const session = result.value;
  if (!session.session_id) {
    return { label, passed: true, detail: "no active session" };
  }

  const createdAt = new Date(session.created_at);
  const createdAtMs = createdAt.getTime();
  if (Number.isNaN(createdAtMs)) {
    return {
      label,
      passed: false,
      detail: "invalid timestamp",
      hint: "Delete .ralph/.ralph_session to reset",
    };
  }

  const now = new Date();
  const ageMs = now.getTime() - createdAtMs;
  if (ageMs < 0) {
    return {
      label,
      passed: false,
      detail: "invalid timestamp (future)",
      hint: "Delete .ralph/.ralph_session to reset",
    };
  }

  const ageHours = Math.floor(ageMs / (1000 * 60 * 60));
  const ageMinutes = Math.floor((ageMs % (1000 * 60 * 60)) / (1000 * 60));
  const ageStr = ageHours > 0 ? `${ageHours}h${ageMinutes}m` : `${ageMinutes}m`;

  const maxAgeHours = Math.floor(SESSION_AGE_WARNING_MS / (1000 * 60 * 60));
  if (ageMs >= SESSION_AGE_WARNING_MS) {
    return {
      label,
      passed: false,
      detail: `${ageStr} old (max ${maxAgeHours}h)`,
      hint: "Session is stale. Start a fresh Ralph session",
    };
  }

  return { label, passed: true, detail: ageStr };
}

export async function checkApiCalls(projectDir: string): Promise<CheckResult> {
  const label = "API calls this hour";
  const result = await readRalphRuntimeStatus(projectDir);

  if (result.kind === "missing") {
    return { label, passed: true, detail: "not running" };
  }

  if (result.kind === "invalid") {
    return {
      label,
      passed: false,
      detail: "corrupt status file",
      hint: "Delete .ralph/status.json to reset",
    };
  }

  if (result.kind === "unreadable") {
    return {
      label,
      passed: false,
      detail: "unreadable status file",
      hint: "Check file permissions or locks on .ralph/status.json and retry",
    };
  }

  const calls = result.value.callsMadeThisHour;
  const max = result.value.maxCallsPerHour;

  if (max <= 0) {
    return { label, passed: true, detail: `${calls}/unlimited` };
  }

  const percentage = (calls / max) * 100;
  if (percentage >= API_USAGE_WARNING_PERCENT) {
    return {
      label,
      passed: false,
      detail: `${calls}/${max} (approaching limit)`,
      hint: "Wait for rate limit reset or increase API quota",
    };
  }

  return { label, passed: true, detail: `${calls}/${max}` };
}

export async function checkUpstreamGitHubStatus(_projectDir: string): Promise<CheckResult> {
  const label = "upstream status";
  try {
    const bundled = await getBundledVersions();
    const result = await checkUpstream(bundled);

    if (result.bmad === null) {
      const reason = getSkipReason(result.errors);
      return { label, passed: true, detail: `skipped: ${reason}` };
    }

    return {
      label,
      passed: true,
      detail: `BMAD: ${result.bmad.isUpToDate ? "up to date" : "behind"}`,
    };
  } catch (err) {
    return { label, passed: true, detail: `skipped: ${formatError(err)}` };
  }
}
