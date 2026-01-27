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

export function info(message: string): void {
  console.log(chalk.blue(message));
}

export function warn(message: string): void {
  console.log(chalk.yellow(message));
}

export function error(message: string): void {
  console.error(chalk.red(message));
}

export function success(message: string): void {
  console.log(chalk.green(message));
}
