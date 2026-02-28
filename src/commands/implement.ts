import chalk from "chalk";
import { access } from "node:fs/promises";
import { join } from "node:path";
import { runTransition } from "../transition/orchestration.js";
import { withErrorHandling } from "../utils/errors.js";
import { resolveProjectPlatform } from "../platform/resolve.js";
import type { PreflightIssue } from "../transition/types.js";

interface ImplementOptions {
  force?: boolean;
  projectDir: string;
}

export async function implementCommand(options: ImplementOptions): Promise<void> {
  await withErrorHandling(() => runImplement(options));
}

async function runImplement(options: ImplementOptions): Promise<void> {
  const { projectDir, force } = options;

  // Re-run protection: warn if implement was already run
  try {
    await access(join(projectDir, ".ralph/@fix_plan.md"));
    if (!force) {
      console.log(chalk.yellow("Warning: bmalph implement has already been run."));
      console.log(
        "Re-running will overwrite PROMPT.md, PROJECT_CONTEXT.md, @AGENT.md, and SPECS_INDEX.md."
      );
      console.log("Fix plan progress will be preserved.\n");
      console.log(`Use ${chalk.bold("--force")} to proceed anyway.`);
      process.exitCode = 1;
      return;
    }
  } catch {
    // fix_plan doesn't exist — first run, proceed
  }

  const platform = await resolveProjectPlatform(projectDir);

  const result = await runTransition(projectDir, { force });

  // Print preflight issues with severity icons
  if (result.preflightIssues && result.preflightIssues.length > 0) {
    console.log(chalk.bold("\nPre-flight checks\n"));
    for (const issue of result.preflightIssues) {
      console.log(`  ${severityIcon(issue)} ${issue.message}`);
      if (issue.suggestion) {
        console.log(chalk.dim(`     ${issue.suggestion}`));
      }
    }
    console.log("");
  }

  // Print warnings
  if (result.warnings.length > 0) {
    for (const warning of result.warnings) {
      console.log(chalk.yellow(`  ! ${warning}`));
    }
    console.log("");
  }

  // Generated files summary
  if (result.generatedFiles.length > 0) {
    console.log(chalk.bold("\nGenerated files\n"));
    for (const file of result.generatedFiles) {
      const icon = file.action === "created" ? chalk.green("+") : chalk.cyan("~");
      console.log(`  ${icon} ${file.path}`);
    }
    console.log("");
  }

  // Summary
  const preserved = result.fixPlanPreserved ? chalk.dim(" (progress preserved)") : "";
  console.log(chalk.green(`Transition complete: ${result.storiesCount} stories`) + preserved);

  if (result.warnings.length > 0) {
    console.log(chalk.yellow(`  ${result.warnings.length} warning(s)`));
  }

  // Driver instructions
  console.log("");
  if (platform.tier === "full") {
    console.log(`Start the Ralph loop:\n`);
    console.log(`    bash .ralph/drivers/${platform.id}.sh`);
  } else {
    console.log(
      `Ralph requires a full-tier platform (claude-code or codex). ` +
        `Current platform: ${platform.displayName}`
    );
  }
}

function severityIcon(issue: PreflightIssue): string {
  switch (issue.severity) {
    case "error":
      return chalk.red("\u2717");
    case "warning":
      return chalk.yellow("!");
    case "info":
      return chalk.dim("i");
  }
}
