import chalk from "chalk";
import inquirer from "inquirer";
import {
  isInitialized,
  copyBundledAssets,
  mergeInstructionsFile,
  previewUpgrade,
  getBundledVersions,
} from "../installer.js";
import { readConfig, writeConfig } from "../utils/config.js";
import { formatDryRunSummary, type DryRunAction } from "../utils/dryrun.js";
import { withErrorHandling } from "../utils/errors.js";
import { resolveProjectPlatform } from "../platform/resolve.js";

interface UpgradeOptions {
  dryRun?: boolean;
  force?: boolean;
  projectDir: string;
}

export async function upgradeCommand(options: UpgradeOptions): Promise<void> {
  await withErrorHandling(() => runUpgrade(options));
}

async function runUpgrade(options: UpgradeOptions): Promise<void> {
  const projectDir = options.projectDir;

  if (!(await isInitialized(projectDir))) {
    console.log(chalk.red("bmalph is not initialized. Run 'bmalph init' first."));
    return;
  }

  // Read platform from existing config
  const platform = await resolveProjectPlatform(projectDir);

  // Handle dry-run mode
  if (options.dryRun) {
    const preview = await previewUpgrade(projectDir, platform);
    const actions: DryRunAction[] = [
      ...preview.wouldUpdate.map((p) => ({ type: "modify" as const, path: p })),
      ...preview.wouldCreate.map((p) => ({ type: "create" as const, path: p })),
    ];
    console.log(formatDryRunSummary(actions));
    return;
  }

  // Confirm unless --force or non-interactive
  if (!options.force) {
    if (!process.stdin.isTTY) {
      throw new Error("Non-interactive mode requires --force flag for upgrade");
    }
    const { confirm } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirm",
        message: "This will overwrite managed files. Continue?",
        default: false,
      },
    ]);
    if (!confirm) {
      console.log("Aborted.");
      return;
    }
  }

  console.log(chalk.blue(`Upgrading bundled assets for ${platform.displayName}...`));

  const result = await copyBundledAssets(projectDir, platform);
  await mergeInstructionsFile(projectDir, platform);

  // Update upstreamVersions in config to match bundled versions
  const config = await readConfig(projectDir);
  if (config) {
    config.upstreamVersions = getBundledVersions();
    await writeConfig(projectDir, config);
  }

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
