import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { upgradeCommand } from "./commands/upgrade.js";
import { doctorCommand } from "./commands/doctor.js";
import { checkUpdatesCommand } from "./commands/check-updates.js";
import { statusCommand } from "./commands/status.js";
import { setVerbose } from "./utils/logger.js";
import { getPackageVersion } from "./installer.js";

const program = new Command();

program
  .name("bmalph")
  .description("BMAD-METHOD + Ralph integration — structured planning to autonomous implementation")
  .version(getPackageVersion())
  .option("--verbose", "Enable debug logging")
  .option("--no-color", "Disable colored output")
  .hook("preAction", () => {
    const opts = program.opts();
    if (opts.verbose) {
      setVerbose(true);
    }
    if (opts.color === false) {
      // Disable chalk colors by setting FORCE_COLOR environment variable
      process.env.FORCE_COLOR = "0";
    }
  });

program
  .command("init")
  .description("Initialize bmalph in the current project")
  .option("-n, --name <name>", "Project name")
  .option("-d, --description <desc>", "Project description")
  .option("--dry-run", "Preview changes without writing files")
  .action(initCommand);

program
  .command("upgrade")
  .description("Update bundled assets to current version")
  .option("--dry-run", "Preview changes without writing files")
  .action(upgradeCommand);

program
  .command("doctor")
  .description("Check installation health")
  .option("--json", "Output as JSON")
  .action(doctorCommand);

program
  .command("check-updates")
  .description("Check if bundled BMAD/Ralph versions are up to date with upstream")
  .option("--json", "Output as JSON")
  .action(checkUpdatesCommand);

program
  .command("status")
  .description("Show current project status and phase")
  .option("--json", "Output as JSON")
  .action(statusCommand);

program.parse();
