import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";
import { readJsonFile } from "./json.js";
import { validateConfig, validateBmadConfig } from "./validate.js";
import { CONFIG_FILE, BMAD_CONFIG_FILE } from "./constants.js";
import { atomicWriteFile } from "./file-system.js";
import { warn, debug } from "./logger.js";
import { formatError, isEnoent } from "./errors.js";
import type { PlatformId } from "../platform/types.js";

export interface UpstreamVersions {
  bmadCommit: string;
}

export interface BmadConfig {
  platform?: string;
  project_name?: string;
  output_folder?: string;
  user_name?: string;
  communication_language?: string;
  document_output_language?: string;
  user_skill_level?: string;
  planning_artifacts?: string;
  implementation_artifacts?: string;
  project_knowledge?: string;
  modules?: string[];
}

export interface BmalphConfig {
  name: string;
  description: string;
  createdAt: string;
  platform?: PlatformId;
  upstreamVersions?: UpstreamVersions;
}

export async function readConfig(projectDir: string): Promise<BmalphConfig | null> {
  let data: unknown;
  try {
    data = await readJsonFile<unknown>(join(projectDir, CONFIG_FILE));
  } catch (err) {
    warn(`Config file is corrupted, treating as missing: ${formatError(err)}`);
    return null;
  }
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

export async function readBmadConfig(projectDir: string): Promise<BmadConfig | null> {
  const configPath = join(projectDir, BMAD_CONFIG_FILE);
  try {
    const content = await readFile(configPath, "utf-8");
    const parsed: unknown = parse(content);
    const config = validateBmadConfig(parsed);
    debug(`Read BMAD config from: ${configPath}`);
    return config;
  } catch (err) {
    if (isEnoent(err)) {
      debug(`BMAD config not found at: ${configPath}`);
      return null;
    }
    warn(`Error reading BMAD config: ${formatError(err)}`);
    return null;
  }
}
