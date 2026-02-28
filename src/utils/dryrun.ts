import chalk from "chalk";

export interface DryRunAction {
  type: "create" | "modify" | "skip" | "delete" | "warn";
  path: string;
  reason?: string;
}

export function formatDryRunSummary(actions: DryRunAction[]): string {
  if (actions.length === 0) {
    return chalk.dim("No changes would be made.");
  }

  const lines: string[] = [];
  lines.push(chalk.blue("\n[dry-run] Would perform the following actions:\n"));

  const deletes = actions.filter((a) => a.type === "delete");
  const creates = actions.filter((a) => a.type === "create");
  const modifies = actions.filter((a) => a.type === "modify");
  const skips = actions.filter((a) => a.type === "skip");
  const warns = actions.filter((a) => a.type === "warn");

  if (deletes.length > 0) {
    lines.push(chalk.red("Would delete:"));
    for (const action of deletes) {
      lines.push(`  ${action.path}`);
    }
    lines.push("");
  }

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

  if (warns.length > 0) {
    lines.push(chalk.yellow("Warnings:"));
    for (const action of warns) {
      lines.push(`  ${action.path}${action.reason ? ` (${action.reason})` : ""}`);
    }
    lines.push("");
  }

  lines.push(chalk.dim("No changes made."));

  return lines.join("\n");
}
