import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { upgradeCommand } from "./commands/upgrade.js";
import { doctorCommand } from "./commands/doctor.js";
import { setVerbose } from "./utils/logger.js";
import { getPackageVersion } from "./installer.js";

const program = new Command();

program
  .name("bmalph")
  .description("BMAD-METHOD + Ralph integration — structured planning to autonomous implementation")
  .version(getPackageVersion())
  .option("--verbose", "Enable debug logging")
  .hook("preAction", () => {
    if (program.opts().verbose) {
      setVerbose(true);
    }
  });

program
  .command("init")
  .description("Initialize bmalph in the current project")
  .option("-n, --name <name>", "Project name")
  .option("-d, --description <desc>", "Project description")
  .action(initCommand);

program.command("upgrade").description("Update bundled assets to current version").action(upgradeCommand);

program.command("doctor").description("Check installation health").action(doctorCommand);

program.parse();
