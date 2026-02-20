import { mkdir } from "fs/promises";
import { join } from "path";
import { readJsonFile } from "./json.js";
import { validateConfig } from "./validate.js";
import { CONFIG_FILE } from "./constants.js";
import { atomicWriteFile } from "./file-system.js";
import { warn } from "./logger.js";
import { formatError } from "./errors.js";

export interface UpstreamVersions {
  bmadCommit: string;
  ralphCommit: string;
}

export interface BmalphConfig {
  name: string;
  description: string;
  createdAt: string;
  upstreamVersions?: UpstreamVersions;
}

export async function readConfig(projectDir: string): Promise<BmalphConfig | null> {
  const data = await readJsonFile<unknown>(join(projectDir, CONFIG_FILE));
  if (data === null) return null;
  try {
    return validateConfig(data);
  } catch (err) {
    warn(`Config file is corrupted, treating as missing: ${formatError(err)}`);
    return null;
  }
}

export async function writeConfig(projectDir: string, config: BmalphConfig): Promise<void> {
  await mkdir(join(projectDir, "bmalph"), { recursive: true });
  await atomicWriteFile(join(projectDir, CONFIG_FILE), JSON.stringify(config, null, 2) + "\n");
}
