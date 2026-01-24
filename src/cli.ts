import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { implementCommand } from "./commands/implement.js";
import { resetCommand } from "./commands/reset.js";

const program = new Command();

program
  .name("bmalph")
  .description("BMAD-METHOD + Ralph integration — structured planning to autonomous implementation")
  .version("0.4.2");

program
  .command("init")
  .description("Initialize bmalph in the current project")
  .option("-n, --name <name>", "Project name")
  .option("-d, --description <desc>", "Project description")
  .option("-l, --level <level>", "Complexity level (0-4)", "2")
  .action(initCommand);

program
  .command("implement")
  .description("Transition to Ralph implementation loop")
  .action(implementCommand);

program
  .command("reset")
  .description("Reset state (keeps artifacts)")
  .option("--hard", "Also remove _bmad/, .ralph/, and artifacts")
  .action(resetCommand);

program.parse();
