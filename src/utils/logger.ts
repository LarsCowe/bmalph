import chalk from "chalk";

let verbose = false;

export function setVerbose(value: boolean): void {
  verbose = value;
}

export function isVerbose(): boolean {
  return verbose;
}

export function debug(message: string): void {
  if (verbose) {
    console.log(chalk.dim(`[debug] ${message}`));
  }
}
