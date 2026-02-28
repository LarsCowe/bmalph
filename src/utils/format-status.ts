import chalk from "chalk";

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
    default:
      return status;
  }
}
