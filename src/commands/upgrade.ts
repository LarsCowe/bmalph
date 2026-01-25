import chalk from "chalk";
import { isInitialized, copyBundledAssets, mergeClaudeMd } from "../installer.js";

export async function upgradeCommand(): Promise<void> {
  try {
    await runUpgrade();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(chalk.red(`Error: ${message}`));
    process.exit(1);
  }
}

async function runUpgrade(): Promise<void> {
  const projectDir = process.cwd();

  if (!(await isInitialized(projectDir))) {
    console.log(chalk.red("bmalph is not initialized. Run 'bmalph init' first."));
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
