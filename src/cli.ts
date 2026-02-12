import { resolve } from "path";
import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { upgradeCommand } from "./commands/upgrade.js";
import { doctorCommand } from "./commands/doctor.js";
import { checkUpdatesCommand } from "./commands/check-updates.js";
import { statusCommand } from "./commands/status.js";
import { setVerbose, setQuiet } from "./utils/logger.js";
import { getPackageVersion } from "./installer.js";

const program = new Command();

program
  .name("bmalph")
  .description("BMAD-METHOD + Ralph integration — structured planning to autonomous implementation")
  .version(getPackageVersion())
  .option("--verbose", "Enable debug logging")
  .option("--no-color", "Disable colored output")
  .option("--quiet", "Suppress non-essential output")
  .option("-C, --project-dir <path>", "Run in specified directory")
  .hook("preAction", () => {
    const opts = program.opts();
    if (opts.verbose) {
      setVerbose(true);
    }
    if (opts.quiet) {
      setQuiet(true);
    }
    if (opts.color === false) {
      process.env.FORCE_COLOR = "0";
    }
  });

function resolveProjectDir(): string | undefined {
  const dir = program.opts().projectDir;
  return dir ? resolve(dir) : undefined;
}

program
  .command("init")
  .description("Initialize bmalph in the current project")
  .option("-n, --name <name>", "Project name")
  .option("-d, --description <desc>", "Project description")
  .option("--dry-run", "Preview changes without writing files")
  .action((opts) => initCommand({ ...opts, projectDir: resolveProjectDir() }));

program
  .command("upgrade")
  .description("Update bundled assets to current version")
  .option("--dry-run", "Preview changes without writing files")
  .option("--force", "Skip confirmation prompts")
  .action((opts) => upgradeCommand({ ...opts, projectDir: resolveProjectDir() }));

program
  .command("doctor")
  .description("Check installation health")
  .option("--json", "Output as JSON")
  .action((opts) => doctorCommand({ ...opts, projectDir: resolveProjectDir() }));

program
  .command("check-updates")
  .description("Check if bundled BMAD/Ralph versions are up to date with upstream")
  .option("--json", "Output as JSON")
  .action(checkUpdatesCommand);

program
  .command("status")
  .description("Show current project status and phase")
  .option("--json", "Output as JSON")
  .action((opts) => statusCommand({ ...opts, projectDir: resolveProjectDir() }));

program.parse();
