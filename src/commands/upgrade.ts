import chalk from "chalk";
import { isInitialized, copyBundledAssets, mergeClaudeMd, previewUpgrade } from "../installer.js";
import { formatDryRunSummary, type DryRunAction } from "../utils/dryrun.js";
import { withErrorHandling } from "../utils/errors.js";

interface UpgradeOptions {
  dryRun?: boolean;
  projectDir?: string;
}

export async function upgradeCommand(options: UpgradeOptions = {}): Promise<void> {
  await withErrorHandling(() => runUpgrade(options));
}

async function runUpgrade(options: UpgradeOptions): Promise<void> {
  const projectDir = options.projectDir ?? process.cwd();

  if (!(await isInitialized(projectDir))) {
    console.log(chalk.red("bmalph is not initialized. Run 'bmalph init' first."));
    return;
  }

  // Handle dry-run mode
  if (options.dryRun) {
    const preview = await previewUpgrade(projectDir);
    const actions: DryRunAction[] = preview.wouldUpdate.map((p) => ({
      type: "modify" as const,
      path: p,
    }));
    console.log(formatDryRunSummary(actions));
    return;
  }

  console.log(chalk.blue("Upgrading bundled assets..."));

  const result = await copyBundledAssets(projectDir);
  await mergeClaudeMd(projectDir);

  console.log(chalk.green("\nUpdated:"));
  for (const path of result.updatedPaths) {
    console.log(`  ${path}`);
  }

  console.log(chalk.dim("\nPreserved:"));
  console.log("  bmalph/config.json");
  console.log("  bmalph/state/");
  console.log("  .ralph/logs/");
  console.log("  .ralph/@fix_plan.md");
  console.log("  .ralph/docs/");
  console.log("  .ralph/specs/");

  console.log(chalk.green("\nUpgrade complete."));
}
