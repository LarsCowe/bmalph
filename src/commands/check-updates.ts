import chalk from "chalk";
import { getBundledVersions } from "../installer.js";
import { checkUpstream, type UpstreamStatus, type GitHubError } from "../utils/github.js";
import { withErrorHandling } from "../utils/errors.js";

interface CheckUpdatesOptions {
  json?: boolean;
}

interface JsonOutput {
  bmad: UpstreamStatus | null;
  ralph: UpstreamStatus | null;
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
    const hasUpdates =
      (result.bmad !== null && !result.bmad.isUpToDate) ||
      (result.ralph !== null && !result.ralph.isUpToDate);

    const output: JsonOutput = {
      bmad: result.bmad,
      ralph: result.ralph,
      errors: result.errors,
      hasUpdates,
    };
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  // Human-readable output
  let updatesCount = 0;

  // BMAD status
  if (result.bmad) {
    if (result.bmad.isUpToDate) {
      console.log(chalk.green(`  ✓ BMAD-METHOD: up to date (${result.bmad.bundledSha})`));
    } else {
      updatesCount++;
      console.log(
        chalk.yellow(`  ! BMAD-METHOD: updates available (${result.bmad.bundledSha} → ${result.bmad.latestSha})`),
      );
      console.log(chalk.dim(`    → ${result.bmad.compareUrl}`));
    }
  } else {
    const bmadError = result.errors.find((e) => e.repo === "bmad");
    const reason = bmadError ? getErrorReason(bmadError) : "unknown error";
    console.log(chalk.yellow(`  ? BMAD-METHOD: Could not check (${reason})`));
  }

  // Ralph status
  if (result.ralph) {
    if (result.ralph.isUpToDate) {
      console.log(chalk.green(`  ✓ Ralph: up to date (${result.ralph.bundledSha})`));
    } else {
      updatesCount++;
      console.log(
        chalk.yellow(`  ! Ralph: updates available (${result.ralph.bundledSha} → ${result.ralph.latestSha})`),
      );
      console.log(chalk.dim(`    → ${result.ralph.compareUrl}`));
    }
  } else {
    const ralphError = result.errors.find((e) => e.repo === "ralph");
    const reason = ralphError ? getErrorReason(ralphError) : "unknown error";
    console.log(chalk.yellow(`  ? Ralph: Could not check (${reason})`));
  }

  // Summary
  console.log();
  if (updatesCount === 0 && result.errors.length === 0) {
    console.log(chalk.green("All repositories are up to date."));
  } else if (updatesCount > 0) {
    const plural = updatesCount === 1 ? "repository has" : "repositories have";
    console.log(chalk.yellow(`${updatesCount} ${plural} updates available.`));
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
