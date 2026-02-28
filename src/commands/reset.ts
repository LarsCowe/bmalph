import chalk from "chalk";
import { confirm } from "@inquirer/prompts";
import { isInitialized } from "../installer.js";
import { buildResetPlan, executeResetPlan, planToDryRunActions } from "../reset.js";
import { formatDryRunSummary } from "../utils/dryrun.js";
import { withErrorHandling } from "../utils/errors.js";
import { resolveProjectPlatform } from "../platform/resolve.js";

interface ResetOptions {
  dryRun?: boolean;
  force?: boolean;
  projectDir: string;
}

export async function resetCommand(options: ResetOptions): Promise<void> {
  await withErrorHandling(() => runReset(options));
}

async function runReset(options: ResetOptions): Promise<void> {
  const projectDir = options.projectDir;

  if (!(await isInitialized(projectDir))) {
    console.log(chalk.red("bmalph is not initialized. Nothing to reset."));
    return;
  }

  const platform = await resolveProjectPlatform(projectDir);
  const plan = await buildResetPlan(projectDir, platform);

  // Preview
  const actions = planToDryRunActions(plan);
  if (actions.length === 0) {
    console.log(chalk.dim("Nothing to reset."));
    return;
  }

  // Dry-run mode
  if (options.dryRun) {
    console.log(formatDryRunSummary(actions));
    return;
  }

  // Show preview before confirmation
  for (const action of actions) {
    if (action.type === "delete") {
      console.log(`  ${chalk.red("delete")} ${action.path}`);
    } else if (action.type === "modify") {
      console.log(`  ${chalk.yellow("modify")} ${action.path}`);
    } else if (action.type === "warn") {
      console.log(
        `  ${chalk.yellow("warn")}   ${action.path}${action.reason ? ` (${action.reason})` : ""}`
      );
    }
  }

  // Confirm unless --force or non-interactive
  if (!options.force) {
    if (!process.stdin.isTTY) {
      throw new Error("Non-interactive mode requires --force flag for reset");
    }
    const confirmed = await confirm({
      message: "This will remove all bmalph files from the project. Continue?",
      default: false,
    });
    if (!confirmed) {
      console.log("Aborted.");
      return;
    }
  }

  // Execute
  console.log("\nResetting...");
  await executeResetPlan(projectDir, plan);

  // Summary
  console.log(chalk.green("\nReset complete."));

  if (plan.directories.length > 0) {
    console.log(chalk.dim("\nRemoved:"));
    for (const dir of plan.directories) {
      console.log(`  ${dir}/`);
    }
  }

  if (plan.commandFiles.length > 0) {
    console.log(chalk.dim("\nRemoved commands:"));
    for (const file of plan.commandFiles) {
      console.log(`  ${file}`);
    }
  }

  // Show warnings
  for (const warning of plan.warnings) {
    console.log(chalk.yellow(`\nNote: ${warning.path} ${warning.message}`));
  }
}
