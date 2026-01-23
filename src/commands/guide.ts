import chalk from "chalk";

export function guideCommand(): void {
  console.log(chalk.bold("\nBMALPH Workflow\n"));

  console.log(chalk.blue("  BMAD — Structured Planning"));
  console.log(chalk.dim("  ─────────────────────────────────────────"));
  console.log(`  Phase 1  Analysis        Requirements, research, risks`);
  console.log(`  Phase 2  Planning        PRD, stories, MVP scope`);
  console.log(`  Phase 3  Design          Architecture, data model, API\n`);

  console.log(chalk.blue("  Ralph — Autonomous Implementation"));
  console.log(chalk.dim("  ─────────────────────────────────────────"));
  console.log(`  Phase 4  Implementation  TDD build, code review, validation\n`);

  console.log(chalk.dim("  Each phase runs iteratively with human checkpoints."));
  console.log(chalk.dim("  The loop detects completion and advances automatically.\n"));

  console.log("Commands:");
  console.log(`  ${chalk.cyan("bmalph start")}       Begin from Phase 1`);
  console.log(`  ${chalk.cyan("bmalph status")}      Check current progress`);
  console.log(`  ${chalk.cyan("bmalph resume")}      Continue from last checkpoint`);
  console.log(`  ${chalk.cyan("/bmalph")}            Interactive mode in Claude Code`);
}
