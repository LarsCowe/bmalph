import { readConfig } from "../utils/config.js";
import { isEnoent, formatError } from "../utils/errors.js";
import { warn } from "../utils/logger.js";
import { getPlatform } from "./registry.js";
import type { Platform } from "./types.js";

/**
 * Resolve the platform for a project from its config, defaulting to claude-code.
 *
 * Used by doctor and upgrade commands to determine which platform checks and
 * assets to use. Falls back to claude-code when config is missing or unreadable.
 */
export async function resolveProjectPlatform(projectDir: string): Promise<Platform> {
  try {
    const config = await readConfig(projectDir);
    if (config?.platform) {
      return getPlatform(config.platform);
    }
  } catch (err) {
    if (!isEnoent(err)) {
      warn(`Failed to read project config: ${formatError(err)}`);
    }
  }
  return getPlatform("claude-code");
}
