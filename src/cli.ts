import { resolve } from "path";
import { stat } from "fs/promises";
import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { upgradeCommand } from "./commands/upgrade.js";
import { doctorCommand } from "./commands/doctor.js";
import { checkUpdatesCommand } from "./commands/check-updates.js";
import { statusCommand } from "./commands/status.js";
import { setVerbose, setQuiet } from "./utils/logger.js";
import { getPackageVersion } from "./installer.js";
import { isEnoent } from "./utils/errors.js";

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

function resolveProjectDir(): string {
  const dir = program.opts().projectDir;
  return dir ? resolve(dir) : process.cwd();
}

async function resolveAndValidateProjectDir(): Promise<string> {
  const dir = resolveProjectDir();
  try {
    const stats = await stat(dir);
    if (!stats.isDirectory()) {
      throw new Error(`Path is not a directory: ${dir}`);
    }
  } catch (err) {
    if (isEnoent(err)) {
      throw new Error(`Project directory not found: ${dir}`, { cause: err });
    }
    throw err;
  }
  return dir;
}

program
  .command("init")
  .description("Initialize bmalph in the current project")
  .option("-n, --name <name>", "Project name")
  .option("-d, --description <desc>", "Project description")
  .option(
    "--platform <id>",
    "Target platform (claude-code, codex, cursor, windsurf, copilot, aider)"
  )
  .option("--dry-run", "Preview changes without writing files")
  .action(async (opts) =>
    initCommand({ ...opts, projectDir: await resolveAndValidateProjectDir() })
  );

program
  .command("upgrade")
  .description("Update bundled assets to current version")
  .option("--dry-run", "Preview changes without writing files")
  .option("--force", "Skip confirmation prompts")
  .action(async (opts) =>
    upgradeCommand({ ...opts, projectDir: await resolveAndValidateProjectDir() })
  );

program
  .command("doctor")
  .description("Check installation health")
  .option("--json", "Output as JSON")
  .action(async (opts) =>
    doctorCommand({ ...opts, projectDir: await resolveAndValidateProjectDir() })
  );

program
  .command("check-updates")
  .description("Check if bundled BMAD version is up to date with upstream")
  .option("--json", "Output as JSON")
  .action(checkUpdatesCommand);

program
  .command("status")
  .description("Show current project status and phase")
  .option("--json", "Output as JSON")
  .action(async (opts) =>
    statusCommand({ ...opts, projectDir: await resolveAndValidateProjectDir() })
  );

void program.parseAsync();
