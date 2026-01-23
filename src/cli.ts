import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { startCommand } from "./commands/start.js";
import { resumeCommand } from "./commands/resume.js";
import { statusCommand } from "./commands/status.js";
import { resetCommand } from "./commands/reset.js";

const program = new Command();

program
  .name("bmalph")
  .description("Unified AI Development Framework - BMAD phases with Ralph execution loop")
  .version("0.1.0");

program
  .command("init")
  .description("Initialize bmalph in the current project")
  .option("-n, --name <name>", "Project name")
  .option("-d, --description <desc>", "Project description")
  .option("-l, --level <level>", "Complexity level (0-4)", "2")
  .action(initCommand);

program
  .command("start")
  .description("Start the execution loop")
  .option("-p, --phase <phase>", "Start from specific phase (1-4)")
  .action(startCommand);

program
  .command("resume")
  .description("Resume from last checkpoint")
  .action(resumeCommand);

program
  .command("status")
  .description("Show current phase, iteration, and progress")
  .action(statusCommand);

program
  .command("reset")
  .description("Reset state (keeps artifacts)")
  .option("--hard", "Also remove artifacts")
  .action(resetCommand);

program.parse();
