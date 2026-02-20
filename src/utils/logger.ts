import chalk from "chalk";

let verbose = false;
let quiet = false;

export function setVerbose(value: boolean): void {
  verbose = value;
}

export function isVerbose(): boolean {
  return verbose;
}

export function setQuiet(value: boolean): void {
  quiet = value;
}

export function isQuiet(): boolean {
  return quiet;
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
  console.log(chalk.yellow(message));
}

export function error(message: string): void {
  console.error(chalk.red(message));
}

export function success(message: string): void {
  if (quiet) return;
  console.log(chalk.green(message));
}
