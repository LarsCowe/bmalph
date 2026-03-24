import chalk from "chalk";
import { formatStatus } from "../utils/format-status.js";
import type {
  DashboardState,
  LoopInfo,
  CircuitBreakerInfo,
  StoryProgress,
  AnalysisInfo,
  ReviewInfo,
  LogEntry,
  ExecutionProgress,
  SessionInfo,
} from "./types.js";

export type FooterRenderer = (lastUpdated: Date, cols: number) => string;

export interface DashboardRenderOptions {
  footerRenderer?: FooterRenderer;
}

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
const ANSI_PATTERN = /\x1B\[[0-9;]*m/g;
// eslint-disable-next-line no-control-regex
const ANSI_PREFIX_PATTERN = /^\x1B\[[0-9;]*m/;
// eslint-disable-next-line no-control-regex
const VT_ESCAPE_PATTERN = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~]|\][^\x07]*(?:\x07|\x1B\\))/g;
// eslint-disable-next-line no-control-regex
const CONTROL_CHAR_PATTERN = /[\x00-\x08\x0B-\x1F\x7F]/g;
const DISPLAY_SEGMENTER = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const COMBINING_MARK_PATTERN = /\p{Mark}/u;
const EMOJI_PATTERN = /\p{Extended_Pictographic}/u;

function stripAnsi(str: string): string {
  return str.replace(ANSI_PATTERN, "");
}

function sanitizeExternalText(str: string): string {
  return str
    .replace(VT_ESCAPE_PATTERN, "")
    .replace(/\r\n?/g, " ")
    .replace(/\n/g, " ")
    .replace(/\t/g, "    ")
    .replace(CONTROL_CHAR_PATTERN, "");
}

function displayWidth(str: string): number {
  return Array.from(DISPLAY_SEGMENTER.segment(stripAnsi(str))).reduce((width, segment) => {
    return width + graphemeDisplayWidth(segment.segment);
  }, 0);
}

function graphemeDisplayWidth(grapheme: string): number {
  let width = 0;

  for (const char of grapheme) {
    const codePoint = char.codePointAt(0);
    if (codePoint === undefined || isZeroWidthChar(char, codePoint)) {
      continue;
    }

    if (EMOJI_PATTERN.test(char) || isWideCodePoint(codePoint)) {
      return 2;
    }

    width = 1;
  }

  return width;
}

function isZeroWidthChar(char: string, codePoint: number): boolean {
  return (
    COMBINING_MARK_PATTERN.test(char) ||
    codePoint === 0x200c ||
    codePoint === 0x200d ||
    isVariationSelector(codePoint)
  );
}

function isVariationSelector(codePoint: number): boolean {
  return (
    (codePoint >= 0xfe00 && codePoint <= 0xfe0f) || (codePoint >= 0xe0100 && codePoint <= 0xe01ef)
  );
}

function isWideCodePoint(codePoint: number): boolean {
  return (
    codePoint >= 0x1100 &&
    (codePoint <= 0x115f ||
      codePoint === 0x2329 ||
      codePoint === 0x232a ||
      (codePoint >= 0x2e80 && codePoint <= 0x3247 && codePoint !== 0x303f) ||
      (codePoint >= 0x3250 && codePoint <= 0x4dbf) ||
      (codePoint >= 0x4e00 && codePoint <= 0xa4c6) ||
      (codePoint >= 0xa960 && codePoint <= 0xa97c) ||
      (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
      (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
      (codePoint >= 0xfe10 && codePoint <= 0xfe19) ||
      (codePoint >= 0xfe30 && codePoint <= 0xfe6b) ||
      (codePoint >= 0xff01 && codePoint <= 0xff60) ||
      (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
      (codePoint >= 0x1f300 && codePoint <= 0x1f64f) ||
      (codePoint >= 0x1f900 && codePoint <= 0x1f9ff) ||
      (codePoint >= 0x20000 && codePoint <= 0x3fffd))
  );
}

function truncateAnsi(str: string, len: number): string {
  if (len <= 0) {
    return "";
  }

  if (displayWidth(str) <= len) {
    return str;
  }

  let result = "";
  let index = 0;
  let visibleCount = 0;
  let sawAnsi = false;

  outer: while (index < str.length) {
    const ansiMatch = str.slice(index).match(ANSI_PREFIX_PATTERN);
    if (ansiMatch) {
      result += ansiMatch[0];
      index += ansiMatch[0].length;
      sawAnsi = true;
      continue;
    }

    const nextAnsiIndex = str.indexOf("\x1B", index);
    const textChunk = nextAnsiIndex === -1 ? str.slice(index) : str.slice(index, nextAnsiIndex);
    for (const segment of DISPLAY_SEGMENTER.segment(textChunk)) {
      const width = graphemeDisplayWidth(segment.segment);
      if (visibleCount + width > len) {
        break outer;
      }

      result += segment.segment;
      visibleCount += width;
    }

    index += textChunk.length;
  }

  if (sawAnsi) {
    result += "\x1B[0m";
  }

  return result;
}

export function padRight(str: string, len: number): string {
  if (len <= 0) {
    return "";
  }

  const fitted = truncateAnsi(str, len);
  const visualLen = displayWidth(fitted);
  if (visualLen >= len) {
    return fitted;
  }
  return fitted + " ".repeat(len - visualLen);
}

export function progressBar(completed: number, total: number, width: number): string {
  if (total <= 0) {
    return PROGRESS_EMPTY.repeat(width);
  }
  const ratio = Math.min(completed / total, 1);
  const filled = Math.round(ratio * width);
  return chalk.green(PROGRESS_FILLED.repeat(filled)) + PROGRESS_EMPTY.repeat(width - filled);
}

export function formatSessionAge(createdAt: string, referenceTime: number = Date.now()): string {
  const start = new Date(createdAt).getTime();
  if (Number.isNaN(start)) {
    return "0m 0s";
  }

  const diffSeconds = Math.max(0, Math.floor((referenceTime - start) / 1000));

  const hours = Math.floor(diffSeconds / 3600);
  const minutes = Math.floor((diffSeconds % 3600) / 60);
  const seconds = diffSeconds % 60;

  if (hours > 0) {
    return `${String(hours)}h ${String(minutes)}m`;
  }
  return `${String(minutes)}m ${String(seconds)}s`;
}

export function formatElapsed(seconds: number): string {
  if (seconds < 60) {
    return `${String(seconds)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${String(minutes)}m ${String(remaining)}s`;
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
  const safeTimestamp = sanitizeExternalText(timestamp);
  const timePart = safeTimestamp.split(" ")[1];
  return timePart ?? formatTime(new Date(safeTimestamp));
}

export function box(title: string, lines: string[], cols: number): string {
  const innerWidth = Math.max(0, cols - 2);
  const titleStr = title ? truncateAnsi(`\u2500 ${title} `, innerWidth) : "";
  const topBorder =
    BOX_CHARS.topLeft +
    titleStr +
    BOX_CHARS.horizontal.repeat(Math.max(0, innerWidth - displayWidth(titleStr))) +
    BOX_CHARS.topRight;

  const bottomBorder =
    BOX_CHARS.bottomLeft + BOX_CHARS.horizontal.repeat(innerWidth) + BOX_CHARS.bottomRight;

  const contentLines = lines.map(
    (line) =>
      BOX_CHARS.vertical + " " + padRight(line, Math.max(0, innerWidth - 1)) + BOX_CHARS.vertical
  );

  return [topBorder, ...contentLines, bottomBorder].join("\n");
}

export function renderHeader(cols: number): string {
  const innerWidth = Math.max(0, cols - 2);
  const title = truncateAnsi("RALPH MONITOR", innerWidth);
  const titleLength = displayWidth(title);
  const padding = Math.max(0, Math.floor((innerWidth - titleLength) / 2));
  const centeredTitle =
    " ".repeat(padding) + title + " ".repeat(Math.max(0, innerWidth - padding - titleLength));

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
  cols: number,
  referenceTime: number = Date.now()
): string {
  if (loop === null) {
    return box("Loop Status", ["Status: waiting for data"], cols);
  }

  const apiPercent =
    loop.maxCallsPerHour > 0
      ? Math.round((loop.callsMadeThisHour / loop.maxCallsPerHour) * 100)
      : 0;
  const loopStr = `Loop: #${String(loop.loopCount)}`;
  const statusStr = `Status: ${formatStatus(sanitizeExternalText(loop.status))}`;
  const apiStr = `API: ${String(loop.callsMadeThisHour)}/${String(loop.maxCallsPerHour)} (${String(apiPercent)}%)`;
  const line1 = `${padRight(loopStr, 17)}${padRight(statusStr, 21)}${apiStr}`;

  const sessionStr =
    session !== null ? `Session: ${formatSessionAge(session.createdAt, referenceTime)}` : "";
  const innerWidth = cols - 4;

  let line2: string;
  if (execution !== null) {
    const elapsedStr = formatElapsed(execution.elapsedSeconds);
    const safeIndicator = sanitizeExternalText(execution.indicator);
    const executingStr = `${safeIndicator} executing (${elapsedStr})`;
    const sessionPad = Math.max(
      0,
      innerWidth - displayWidth(executingStr) - displayWidth(sessionStr)
    );
    line2 = `${executingStr}${" ".repeat(sessionPad)}${sessionStr}`;
  } else {
    const actionStr = `Action: ${sanitizeExternalText(loop.lastAction)}`;
    const sessionPad = Math.max(0, innerWidth - displayWidth(actionStr) - displayWidth(sessionStr));
    line2 = `${actionStr}${" ".repeat(sessionPad)}${sessionStr}`;
  }

  const lines = [line1, line2];

  if (execution !== null && execution.lastOutput.length > 0) {
    const safeOutput = sanitizeExternalText(execution.lastOutput);
    const maxOutputLen = Math.max(0, innerWidth - 2);
    const truncated = truncateAnsi(safeOutput, maxOutputLen);
    lines.push(chalk.dim(`  ${truncated}`));
  }

  return box("Loop Status", lines, cols);
}

export function renderCircuitBreakerPanel(cb: CircuitBreakerInfo | null, cols: number): string {
  const halfCols = Math.floor(cols / 2) - 1;

  if (cb === null) {
    return box("Circuit Breaker", ["N/A"], halfCols);
  }

  const lines = [
    `State: ${formatCBState(sanitizeExternalText(cb.state))}`,
    `No-progress: ${String(cb.consecutiveNoProgress)}`,
    `Opens: ${String(cb.totalOpens)}`,
  ];

  if (cb.state === "OPEN" && cb.reason) {
    lines.push(`Reason: ${sanitizeExternalText(cb.reason)}`);
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
    lines.push(`Next: ${sanitizeExternalText(stories.nextStory)}`);
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
  const lines = [
    [
      `Files: ${String(analysis.filesModified)}`,
      `Parse: ${String(analysis.formatConfidence)}%`,
      `Completion: ${String(analysis.confidenceScore)}%`,
    ].join("    "),
    [`Test-only: ${yesNo(analysis.isTestOnly)}`, `Stuck: ${yesNo(analysis.isStuck)}`].join("    "),
    [
      `Exit signal: ${yesNo(analysis.exitSignal)}`,
      `Permission denials: ${String(analysis.permissionDenialCount)}`,
    ].join("    "),
    [
      `Claimed tasks: ${String(analysis.tasksCompletedThisLoop)}`,
      `Checkbox delta: ${String(analysis.fixPlanCompletedDelta)}`,
    ].join("    "),
    `Progress mismatch: ${yesNo(analysis.hasProgressTrackingMismatch)}`,
  ];

  return box("Last Analysis", lines, cols);
}

export function renderReviewPanel(review: ReviewInfo | null | undefined, cols: number): string {
  if (!review) {
    return "";
  }

  const safeSeverity = sanitizeExternalText(review.severity);
  const severityColor =
    safeSeverity === "CRITICAL" || safeSeverity === "HIGH"
      ? chalk.red
      : safeSeverity === "MEDIUM"
        ? chalk.yellow
        : chalk.green;

  const safeSummary = sanitizeExternalText(review.summary);
  const lines = [
    `Severity: ${severityColor(safeSeverity)}    Issues: ${String(review.issuesFound)}`,
    safeSummary ? chalk.dim(safeSummary.slice(0, 70)) : "",
  ].filter(Boolean);

  return box("Review Findings", lines, cols);
}

export function renderLogsPanel(logs: LogEntry[], cols: number): string {
  if (logs.length === 0) {
    return box("Recent Activity", [chalk.dim("No activity yet")], cols);
  }

  const innerWidth = cols - 4;
  const lines = logs.map((entry) => {
    const time = extractTime(entry.timestamp);
    const level = padRight(sanitizeExternalText(entry.level), 7);
    const prefix = `[${time}] ${level}`;
    const maxMsg = Math.max(0, innerWidth - displayWidth(prefix) - 1);
    const safeMessage = sanitizeExternalText(entry.message);
    const msg = truncateAnsi(safeMessage, maxMsg);
    return `${chalk.dim(`[${time}]`)} ${level} ${msg}`;
  });

  return box("Recent Activity", lines, cols);
}

export function renderLiveLogPanel(liveLog: string[], cols: number): string {
  if (liveLog.length === 0) {
    return box("Live Output", [chalk.dim("No live output yet")], cols);
  }

  const innerWidth = cols - 4;
  const lines = liveLog.map((line) => {
    const safeLine = sanitizeExternalText(line);
    const trimmed = truncateAnsi(safeLine, innerWidth);
    return chalk.dim(trimmed);
  });

  return box("Live Output", lines, cols);
}

export function renderFooterLine(leftText: string, rightText: string, cols: number): string {
  const availableWidth = Math.max(0, cols - 1);
  const minimumWidth = displayWidth(leftText) + 1 + displayWidth(rightText);

  if (availableWidth < minimumWidth) {
    return ` ${truncateAnsi(`${leftText} ${rightText}`, availableWidth)}`;
  }

  const gap = availableWidth - displayWidth(leftText) - displayWidth(rightText);
  return ` ${chalk.dim(leftText)}${" ".repeat(gap)}${chalk.dim(rightText)}`;
}

export function renderFooter(lastUpdated: Date, cols: number): string {
  return renderFooterLine("q quit", `Updated: ${formatTime(lastUpdated)}`, cols);
}

function hasAnyData(state: DashboardState): boolean {
  return (
    state.loop !== null ||
    state.circuitBreaker !== null ||
    state.stories !== null ||
    state.analysis !== null ||
    state.execution !== null ||
    state.session !== null ||
    state.review !== null ||
    state.recentLogs.length > 0 ||
    state.liveLog.length > 0
  );
}

export function renderDashboard(
  state: DashboardState,
  cols?: number,
  options: DashboardRenderOptions = {}
): string {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- columns is undefined in non-TTY
  const width = cols ?? process.stdout.columns ?? 80;
  const referenceTime = state.lastUpdated.getTime();
  const footerRenderer = options.footerRenderer ?? renderFooter;

  if (!hasAnyData(state)) {
    const lines: string[] = [];
    lines.push(renderHeader(width));
    lines.push("");
    lines.push(chalk.dim(padRight("  Waiting for Ralph to start...", width)));
    lines.push("");
    lines.push(footerRenderer(state.lastUpdated, width));
    return lines.join("\n");
  }

  const sections: string[] = [];

  sections.push(renderHeader(width));
  sections.push(renderLoopPanel(state.loop, state.execution, state.session, width, referenceTime));

  const leftPanel = renderCircuitBreakerPanel(state.circuitBreaker, width);
  const rightPanel = renderStoriesPanel(state.stories, width);
  sections.push(renderSideBySide(leftPanel, rightPanel, width));

  sections.push(renderAnalysisPanel(state.analysis, width));

  const reviewPanel = renderReviewPanel(state.review, width);
  if (reviewPanel) {
    sections.push(reviewPanel);
  }

  if (state.execution !== null) {
    sections.push(renderLiveLogPanel(state.liveLog, width));
  }

  sections.push(renderLogsPanel(state.recentLogs, width));
  sections.push(footerRenderer(state.lastUpdated, width));

  return sections
    .join("\n")
    .split("\n")
    .map((line) => truncateAnsi(line, width))
    .join("\n");
}
