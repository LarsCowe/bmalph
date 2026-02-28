import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getBundledVersions } from "../installer.js";
import { checkUpstream, getSkipReason } from "../utils/github.js";
import { isEnoent, formatError } from "../utils/errors.js";
import {
  validateCircuitBreakerState,
  validateRalphSession,
  validateRalphApiStatus,
} from "../utils/validate.js";
import {
  SESSION_AGE_WARNING_MS,
  API_USAGE_WARNING_PERCENT,
  RALPH_STATUS_FILE,
} from "../utils/constants.js";
import type { CheckResult } from "./doctor.js";

export async function checkCircuitBreaker(projectDir: string): Promise<CheckResult> {
  const label = "circuit breaker";
  const statePath = join(projectDir, ".ralph/.circuit_breaker_state");
  try {
    const content = await readFile(statePath, "utf-8");
    const parsed = JSON.parse(content);
    const state = validateCircuitBreakerState(parsed);
    if (state.state === "CLOSED") {
      const detail = `CLOSED (${state.consecutive_no_progress} loops without progress)`;
      return { label, passed: true, detail };
    }
    if (state.state === "HALF_OPEN") {
      return { label, passed: true, detail: `HALF_OPEN - monitoring` };
    }
    const detail = `OPEN - ${state.reason ?? "stagnation detected"}`;
    return {
      label,
      passed: false,
      detail,
      hint: "Ralph detected stagnation. Review logs with: bmalph status",
    };
  } catch (err) {
    if (isEnoent(err)) {
      return { label, passed: true, detail: "not running" };
    }
    return {
      label,
      passed: false,
      detail: "corrupt state file",
      hint: "Delete .ralph/.circuit_breaker_state and restart Ralph",
    };
  }
}

export async function checkRalphSession(projectDir: string): Promise<CheckResult> {
  const label = "Ralph session";
  const sessionPath = join(projectDir, ".ralph/.ralph_session");
  try {
    const content = await readFile(sessionPath, "utf-8");
    const parsed = JSON.parse(content);
    const session = validateRalphSession(parsed);
    if (!session.session_id || session.session_id === "") {
      return { label, passed: true, detail: "no active session" };
    }
    const createdAt = new Date(session.created_at);
    const now = new Date();
    const ageMs = now.getTime() - createdAt.getTime();
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
  } catch (err) {
    if (isEnoent(err)) {
      return { label, passed: true, detail: "no active session" };
    }
    return {
      label,
      passed: false,
      detail: "corrupt session file",
      hint: "Delete .ralph/.ralph_session to reset",
    };
  }
}

export async function checkApiCalls(projectDir: string): Promise<CheckResult> {
  const label = "API calls this hour";
  const statusPath = join(projectDir, RALPH_STATUS_FILE);
  try {
    const content = await readFile(statusPath, "utf-8");
    const parsed = JSON.parse(content);
    const status = validateRalphApiStatus(parsed);
    const calls = status.calls_made_this_hour;
    const max = status.max_calls_per_hour;

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
  } catch (err) {
    if (isEnoent(err)) {
      return { label, passed: true, detail: "not running" };
    }
    return {
      label,
      passed: false,
      detail: "corrupt status file",
      hint: "Delete .ralph/status.json to reset",
    };
  }
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
