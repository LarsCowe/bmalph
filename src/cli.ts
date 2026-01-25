import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { setVerbose } from "./utils/logger.js";

const program = new Command();

program
  .name("bmalph")
  .description("BMAD-METHOD + Ralph integration — structured planning to autonomous implementation")
  .version("0.8.4")
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

program.parse();
