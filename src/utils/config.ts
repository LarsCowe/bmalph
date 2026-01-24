import { writeFile } from "fs/promises";
import { join } from "path";
import { readJsonFile } from "./json.js";
import { validateConfig } from "./validate.js";

export interface BmalphConfig {
  name: string;
  description: string;
  createdAt: string;
}

const CONFIG_FILE = "bmalph/config.json";

export async function readConfig(projectDir: string): Promise<BmalphConfig | null> {
  const data = await readJsonFile<unknown>(join(projectDir, CONFIG_FILE));
  if (data === null) return null;
  return validateConfig(data);
}

export async function writeConfig(projectDir: string, config: BmalphConfig): Promise<void> {
  await writeFile(join(projectDir, CONFIG_FILE), JSON.stringify(config, null, 2) + "\n");
}
