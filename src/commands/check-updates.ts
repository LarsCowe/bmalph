import chalk from "chalk";
import { getBundledVersions } from "../installer.js";
import { checkUpstream, type UpstreamStatus, type GitHubError } from "../utils/github.js";
import { withErrorHandling } from "../utils/errors.js";

interface CheckUpdatesOptions {
  json?: boolean;
}

interface JsonOutput {
  bmad: UpstreamStatus | null;
  errors: GitHubError[];
  hasUpdates: boolean;
}

export async function checkUpdatesCommand(options: CheckUpdatesOptions = {}): Promise<void> {
  await withErrorHandling(() => runCheckUpdates(options));
}

async function runCheckUpdates(options: CheckUpdatesOptions): Promise<void> {
  const bundled = getBundledVersions();

  if (!options.json) {
    console.log(chalk.dim("Checking upstream versions...\n"));
  }

  const result = await checkUpstream(bundled);

  if (options.json) {
    const hasUpdates = result.bmad !== null && !result.bmad.isUpToDate;

    const output: JsonOutput = {
      bmad: result.bmad,
      errors: result.errors,
      hasUpdates,
    };
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  // Human-readable output
  if (result.bmad) {
    if (result.bmad.isUpToDate) {
      console.log(chalk.green(`  ✓ BMAD-METHOD: up to date (${result.bmad.bundledSha})`));
    } else {
      console.log(
        chalk.yellow(
          `  ! BMAD-METHOD: updates available (${result.bmad.bundledSha} → ${result.bmad.latestSha})`
        )
      );
      console.log(chalk.dim(`    → ${result.bmad.compareUrl}`));
    }
  } else {
    const bmadError = result.errors.find((e) => e.repo === "bmad");
    const reason = bmadError ? getErrorReason(bmadError) : "unknown error";
    console.log(chalk.yellow(`  ? BMAD-METHOD: Could not check (${reason})`));
  }

  // Summary
  console.log();
  if (result.bmad !== null && result.bmad.isUpToDate && result.errors.length === 0) {
    console.log(chalk.green("Up to date."));
  } else if (result.bmad !== null && !result.bmad.isUpToDate) {
    console.log(chalk.yellow("Updates available."));
  }
}

function getErrorReason(error: GitHubError): string {
  switch (error.type) {
    case "network":
      return "network error";
    case "timeout":
      return "request timed out";
    case "rate-limit":
      return "rate limited";
    case "not-found":
      return "repository not found";
    case "api-error":
      return `API error (${error.status || "unknown"})`;
    default:
      return "unknown error";
  }
}
