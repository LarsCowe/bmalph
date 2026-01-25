import chalk from "chalk";

export interface DryRunAction {
  type: "create" | "modify" | "skip";
  path: string;
  reason?: string;
}

export function logDryRunAction(action: DryRunAction): void {
  const prefix = chalk.dim("[dry-run]");
  switch (action.type) {
    case "create":
      console.log(`${prefix} Would create: ${chalk.green(action.path)}`);
      break;
    case "modify":
      console.log(`${prefix} Would modify: ${chalk.yellow(action.path)}`);
      break;
    case "skip":
      console.log(`${prefix} Would skip: ${chalk.dim(action.path)}${action.reason ? ` (${action.reason})` : ""}`);
      break;
  }
}

export function formatDryRunSummary(actions: DryRunAction[]): string {
  if (actions.length === 0) {
    return chalk.dim("No changes would be made.");
  }

  const lines: string[] = [];
  lines.push(chalk.blue("\n[dry-run] Would perform the following actions:\n"));

  const creates = actions.filter((a) => a.type === "create");
  const modifies = actions.filter((a) => a.type === "modify");
  const skips = actions.filter((a) => a.type === "skip");

  if (creates.length > 0) {
    lines.push(chalk.green("Would create:"));
    for (const action of creates) {
      lines.push(`  ${action.path}`);
    }
    lines.push("");
  }

  if (modifies.length > 0) {
    lines.push(chalk.yellow("Would modify:"));
    for (const action of modifies) {
      lines.push(`  ${action.path}`);
    }
    lines.push("");
  }

  if (skips.length > 0) {
    lines.push(chalk.dim("Would skip:"));
    for (const action of skips) {
      lines.push(`  ${action.path}${action.reason ? ` (${action.reason})` : ""}`);
    }
    lines.push("");
  }

  lines.push(chalk.dim("No changes made."));

  return lines.join("\n");
}
