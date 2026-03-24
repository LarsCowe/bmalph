import chalk from "chalk";

const EXIT_CODE_LABELS: ReadonlyMap<number, string> = new Map([
  [0, "completed"],
  [1, "error"],
  [124, "timed out"],
  [130, "interrupted (SIGINT)"],
  [137, "killed (OOM or SIGKILL)"],
  [143, "terminated (SIGTERM)"],
]);

export function formatExitReason(code: number | null): string {
  if (code === null) return "unknown";
  return EXIT_CODE_LABELS.get(code) ?? `error (exit ${code})`;
}

/**
 * Shared status formatting with chalk colors.
 *
 * Handles all known status values from both bmalph phase tracking
 * and Ralph loop status. Used by both the status command and the
 * watch dashboard renderer.
 */
export function formatStatus(status: string): string {
  switch (status) {
    case "planning":
      return chalk.blue(status);
    case "implementing":
    case "running":
      return chalk.yellow(status);
    case "completed":
    case "success":
      return chalk.green(status);
    case "halted":
    case "stopped":
    case "blocked":
      return chalk.red(status);
    case "not_started":
      return chalk.dim("not started");
    case "unknown":
      return chalk.dim(status);
    default:
      return status;
  }
}
