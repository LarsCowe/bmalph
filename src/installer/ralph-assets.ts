import { chmod, cp, mkdir, readFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { debug } from "../utils/logger.js";
import { atomicWriteFile, exists } from "../utils/file-system.js";
import { formatError } from "../utils/errors.js";
import type { Platform } from "../platform/types.js";
import { isTemplateCustomized } from "./template-files.js";

export interface RalphAssetInstallResult {
  updatedPaths: string[];
}

export async function installRalphAssets(
  projectDir: string,
  ralphDir: string,
  platform: Platform,
  packageVersion: string
): Promise<RalphAssetInstallResult> {
  await mkdir(join(projectDir, ".ralph"), { recursive: true });

  const promptPath = join(projectDir, ".ralph/PROMPT.md");
  const agentPath = join(projectDir, ".ralph/@AGENT.md");
  const promptCustomized = await isTemplateCustomized(promptPath, "PROMPT.md");
  const agentCustomized = await isTemplateCustomized(agentPath, "AGENT.md");

  if (!promptCustomized) {
    await cp(join(ralphDir, "templates/PROMPT.md"), promptPath, {
      dereference: false,
    });
  }
  if (!agentCustomized) {
    await cp(join(ralphDir, "templates/AGENT.md"), agentPath, {
      dereference: false,
    });
  }
  await cp(join(ralphDir, "RALPH-REFERENCE.md"), join(projectDir, ".ralph/RALPH-REFERENCE.md"), {
    dereference: false,
  });

  // Copy .ralphrc from template (skip if user has customized it)
  const ralphrcDest = join(projectDir, ".ralph/.ralphrc");
  if (!(await exists(ralphrcDest))) {
    let ralphrcContent = await readFile(join(ralphDir, "templates/ralphrc.template"), "utf-8");
    ralphrcContent = ralphrcContent.replace(
      /PLATFORM_DRIVER="\$\{PLATFORM_DRIVER:-[^"]*\}"/,
      `PLATFORM_DRIVER="\${PLATFORM_DRIVER:-${platform.id}}"`
    );
    await atomicWriteFile(ralphrcDest, ralphrcContent);
  }

  // Copy Ralph loop and lib → .ralph/
  const loopContent = await readFile(join(ralphDir, "ralph_loop.sh"), "utf-8");
  const markerLine = `# bmalph-version: ${packageVersion}`;
  const markedContent = loopContent.includes("# bmalph-version:")
    ? loopContent.replace(/# bmalph-version:.*/, markerLine)
    : loopContent.replace(/^(#!.+\r?\n)/, `$1${markerLine}\n`);
  await atomicWriteFile(join(projectDir, ".ralph/ralph_loop.sh"), markedContent);
  await chmod(join(projectDir, ".ralph/ralph_loop.sh"), 0o755);

  await rm(join(projectDir, ".ralph/lib"), { recursive: true, force: true });
  await cp(join(ralphDir, "lib"), join(projectDir, ".ralph/lib"), {
    recursive: true,
    dereference: false,
  });

  // Copy Ralph utilities → .ralph/
  await cp(join(ralphDir, "ralph_import.sh"), join(projectDir, ".ralph/ralph_import.sh"), {
    dereference: false,
  });
  await chmod(join(projectDir, ".ralph/ralph_import.sh"), 0o755);
  await cp(join(ralphDir, "ralph_monitor.sh"), join(projectDir, ".ralph/ralph_monitor.sh"), {
    dereference: false,
  });
  await chmod(join(projectDir, ".ralph/ralph_monitor.sh"), 0o755);

  // Copy Ralph drivers → .ralph/drivers/
  const driversDir = join(ralphDir, "drivers");
  if (await exists(driversDir)) {
    const destDriversDir = join(projectDir, ".ralph/drivers");
    await rm(destDriversDir, { recursive: true, force: true });
    await cp(driversDir, destDriversDir, { recursive: true, dereference: false });
    try {
      const driverFiles = await readdir(destDriversDir);
      for (const file of driverFiles) {
        if (file.endsWith(".sh")) {
          await chmod(join(destDriversDir, file), 0o755);
        }
      }
    } catch (err) {
      debug(`chmod on driver scripts failed (non-fatal): ${formatError(err)}`);
    }
  }

  return {
    updatedPaths: [
      ".ralph/ralph_loop.sh",
      ".ralph/ralph_import.sh",
      ".ralph/ralph_monitor.sh",
      ".ralph/lib/",
      ...(!promptCustomized ? [".ralph/PROMPT.md"] : []),
      ...(!agentCustomized ? [".ralph/@AGENT.md"] : []),
      ".ralph/RALPH-REFERENCE.md",
    ],
  };
}
