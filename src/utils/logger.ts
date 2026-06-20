import chalk from "chalk";

let verbose = false;
let quiet = false;

export function setVerbose(value: boolean): void {
  verbose = value;
}

export function setQuiet(value: boolean): void {
  quiet = value;
}

export function debug(message: string): void {
  if (quiet) return;
  if (verbose) {
    console.log(chalk.dim(`[debug] ${message}`));
  }
}

export function info(message: string): void {
  if (quiet) return;
  console.log(chalk.blue(message));
}

export function warn(message: string): void {
  if (quiet) return;
  // Warnings go to stderr so they never corrupt machine-readable stdout
  // (e.g. `--json` output or a piped value); stdout is reserved for results.
  console.error(chalk.yellow(message));
}
