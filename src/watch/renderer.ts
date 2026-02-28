import chalk from "chalk";
import { formatStatus } from "../utils/format-status.js";
import type {
  DashboardState,
  LoopInfo,
  CircuitBreakerInfo,
  StoryProgress,
  AnalysisInfo,
  LogEntry,
  ExecutionProgress,
  SessionInfo,
} from "./types.js";

const BOX_CHARS = {
  topLeft: "\u250C",
  topRight: "\u2510",
  bottomLeft: "\u2514",
  bottomRight: "\u2518",
  horizontal: "\u2500",
  vertical: "\u2502",
  headerLeft: "\u2554",
  headerRight: "\u2557",
  headerBottom: "\u255A",
  headerBottomRight: "\u255D",
  headerHoriz: "\u2550",
  headerVert: "\u2551",
} as const;

const PROGRESS_FILLED = "\u2588";
const PROGRESS_EMPTY = "\u2591";

// eslint-disable-next-line no-control-regex
const ANSI_PATTERN = /\x1B\[\d+m/g;

function stripAnsi(str: string): string {
  return str.replace(ANSI_PATTERN, "");
}

export function padRight(str: string, len: number): string {
  const visualLen = stripAnsi(str).length;
  if (visualLen >= len) {
    return str;
  }
  return str + " ".repeat(len - visualLen);
}

export function progressBar(completed: number, total: number, width: number): string {
  if (total <= 0) {
    return PROGRESS_EMPTY.repeat(width);
  }
  const ratio = Math.min(completed / total, 1);
  const filled = Math.round(ratio * width);
  return chalk.green(PROGRESS_FILLED.repeat(filled)) + PROGRESS_EMPTY.repeat(width - filled);
}

export function formatSessionAge(createdAt: string): string {
  const now = Date.now();
  const start = new Date(createdAt).getTime();
  const diffSeconds = Math.max(0, Math.floor((now - start) / 1000));

  const hours = Math.floor(diffSeconds / 3600);
  const minutes = Math.floor((diffSeconds % 3600) / 60);
  const seconds = diffSeconds % 60;

  if (hours > 0) {
    return `${String(hours)}h ${String(minutes)}m`;
  }
  return `${String(minutes)}m ${String(seconds)}s`;
}

export function formatCBState(state: string): string {
  switch (state) {
    case "CLOSED":
      return chalk.green(state);
    case "HALF_OPEN":
      return chalk.yellow(state);
    case "OPEN":
      return chalk.red(state);
    default:
      return state;
  }
}

function formatTime(date: Date): string {
  const h = String(date.getUTCHours()).padStart(2, "0");
  const m = String(date.getUTCMinutes()).padStart(2, "0");
  const s = String(date.getUTCSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function extractTime(timestamp: string): string {
  const timePart = timestamp.split(" ")[1];
  return timePart ?? formatTime(new Date(timestamp));
}

export function box(title: string, lines: string[], cols: number): string {
  const innerWidth = cols - 2;
  const titleStr = title ? `\u2500 ${title} ` : "";
  const topBorder =
    BOX_CHARS.topLeft +
    titleStr +
    BOX_CHARS.horizontal.repeat(Math.max(0, innerWidth - titleStr.length)) +
    BOX_CHARS.topRight;

  const bottomBorder =
    BOX_CHARS.bottomLeft + BOX_CHARS.horizontal.repeat(innerWidth) + BOX_CHARS.bottomRight;

  const contentLines = lines.map(
    (line) => BOX_CHARS.vertical + " " + padRight(line, innerWidth - 1) + BOX_CHARS.vertical
  );

  return [topBorder, ...contentLines, bottomBorder].join("\n");
}

export function renderHeader(cols: number): string {
  const innerWidth = cols - 2;
  const title = "RALPH MONITOR";
  const padding = Math.max(0, Math.floor((innerWidth - title.length) / 2));
  const centeredTitle =
    " ".repeat(padding) + title + " ".repeat(innerWidth - padding - title.length);

  const topBorder =
    BOX_CHARS.headerLeft + BOX_CHARS.headerHoriz.repeat(innerWidth) + BOX_CHARS.headerRight;

  const titleLine = BOX_CHARS.headerVert + chalk.bold(centeredTitle) + BOX_CHARS.headerVert;

  const bottomBorder =
    BOX_CHARS.headerBottom + BOX_CHARS.headerHoriz.repeat(innerWidth) + BOX_CHARS.headerBottomRight;

  return [topBorder, titleLine, bottomBorder].join("\n");
}

export function renderLoopPanel(
  loop: LoopInfo | null,
  execution: ExecutionProgress | null,
  session: SessionInfo | null,
  cols: number
): string {
  if (loop === null) {
    return box("Loop Status", ["Status: waiting for data"], cols);
  }

  const apiPercent =
    loop.maxCallsPerHour > 0
      ? Math.round((loop.callsMadeThisHour / loop.maxCallsPerHour) * 100)
      : 0;
  const loopStr = `Loop: #${String(loop.loopCount)}`;
  const statusStr = `Status: ${formatStatus(loop.status)}`;
  const apiStr = `API: ${String(loop.callsMadeThisHour)}/${String(loop.maxCallsPerHour)} (${String(apiPercent)}%)`;
  const line1 = `${padRight(loopStr, 17)}${padRight(statusStr, 21)}${apiStr}`;

  const actionLabel = execution !== null ? execution.status : loop.lastAction;
  const actionStr = `Action: ${actionLabel}`;
  const sessionStr = session !== null ? `Session: ${formatSessionAge(session.createdAt)}` : "";
  const innerWidth = cols - 4;
  const sessionPad = Math.max(0, innerWidth - actionStr.length - sessionStr.length);
  const line2 = `${actionStr}${" ".repeat(sessionPad)}${sessionStr}`;

  return box("Loop Status", [line1, line2], cols);
}

export function renderCircuitBreakerPanel(cb: CircuitBreakerInfo | null, cols: number): string {
  const halfCols = Math.floor(cols / 2) - 1;

  if (cb === null) {
    return box("Circuit Breaker", ["N/A"], halfCols);
  }

  const lines = [
    `State: ${formatCBState(cb.state)}`,
    `No-progress: ${String(cb.consecutiveNoProgress)}`,
    `Opens: ${String(cb.totalOpens)}`,
  ];

  if (cb.state === "OPEN" && cb.reason) {
    lines.push(`Reason: ${cb.reason}`);
  }

  return box("Circuit Breaker", lines, halfCols);
}

export function renderStoriesPanel(stories: StoryProgress | null, cols: number): string {
  const halfCols = Math.floor(cols / 2) - 1;

  if (stories === null) {
    return box("Stories", ["N/A"], halfCols);
  }

  const total = stories.total;
  const completed = stories.completed;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const bar = progressBar(completed, total, 20);

  const lines = [
    `Progress: ${String(completed)}/${String(total)} (${String(percent)}%)`,
    `[${bar}]`,
  ];

  if (stories.nextStory !== null) {
    lines.push(`Next: ${stories.nextStory}`);
  }

  return box("Stories", lines, halfCols);
}

export function renderSideBySide(left: string, right: string, cols: number): string {
  const halfWidth = Math.floor(cols / 2) - 1;
  const leftLines = left.split("\n");
  const rightLines = right.split("\n");
  const maxLines = Math.max(leftLines.length, rightLines.length);
  const result: string[] = [];

  for (let i = 0; i < maxLines; i++) {
    const l = leftLines[i] ?? "";
    const r = rightLines[i] ?? "";
    result.push(padRight(l, halfWidth) + "  " + r);
  }

  return result.join("\n");
}

export function renderAnalysisPanel(analysis: AnalysisInfo | null, cols: number): string {
  if (analysis === null) {
    return box("Last Analysis", ["N/A"], cols);
  }

  const yesNo = (v: boolean): string => (v ? "yes" : "no");
  const line1 = [
    `Files: ${String(analysis.filesModified)}`,
    `Confidence: ${String(analysis.confidenceScore)}%`,
    `Test-only: ${yesNo(analysis.isTestOnly)}`,
    `Stuck: ${yesNo(analysis.isStuck)}`,
  ].join("    ");

  const line2 = [
    `Exit signal: ${yesNo(analysis.exitSignal)}`,
    `Permission denials: ${String(analysis.permissionDenialCount)}`,
  ].join("    ");

  return box("Last Analysis", [line1, line2], cols);
}

export function renderLogsPanel(logs: LogEntry[], cols: number): string {
  if (logs.length === 0) {
    return box("Recent Activity", [chalk.dim("No activity yet")], cols);
  }

  const innerWidth = cols - 4;
  const lines = logs.map((entry) => {
    const time = extractTime(entry.timestamp);
    const level = padRight(entry.level, 7);
    const prefix = `[${time}] ${level}`;
    const maxMsg = Math.max(0, innerWidth - prefix.length - 1);
    const msg = entry.message.length > maxMsg ? entry.message.slice(0, maxMsg) : entry.message;
    return `${chalk.dim(`[${time}]`)} ${level} ${msg}`;
  });

  return box("Recent Activity", lines, cols);
}

export function renderFooter(lastUpdated: Date, cols: number): string {
  const left = chalk.dim("q quit");
  const right = `Updated: ${formatTime(lastUpdated)}`;
  const gap = Math.max(1, cols - "q quit".length - right.length);
  return ` ${left}${" ".repeat(gap - 1)}${chalk.dim(right)}`;
}

function hasAnyData(state: DashboardState): boolean {
  return (
    state.loop !== null ||
    state.circuitBreaker !== null ||
    state.stories !== null ||
    state.analysis !== null ||
    state.execution !== null ||
    state.session !== null ||
    state.recentLogs.length > 0
  );
}

export function renderDashboard(state: DashboardState, cols?: number): string {
  const width = cols ?? process.stdout.columns ?? 80;

  if (!hasAnyData(state)) {
    const lines: string[] = [];
    lines.push(renderHeader(width));
    lines.push("");
    lines.push(chalk.dim(padRight("  Waiting for Ralph to start...", width)));
    lines.push("");
    lines.push(renderFooter(state.lastUpdated, width));
    return lines.join("\n");
  }

  const sections: string[] = [];

  sections.push(renderHeader(width));
  sections.push(renderLoopPanel(state.loop, state.execution, state.session, width));

  const leftPanel = renderCircuitBreakerPanel(state.circuitBreaker, width);
  const rightPanel = renderStoriesPanel(state.stories, width);
  sections.push(renderSideBySide(leftPanel, rightPanel, width));

  sections.push(renderAnalysisPanel(state.analysis, width));
  sections.push(renderLogsPanel(state.recentLogs, width));
  sections.push(renderFooter(state.lastUpdated, width));

  return sections.join("\n");
}
