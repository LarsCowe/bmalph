import { readFile, writeFile } from "fs/promises";
import { join } from "path";

export interface BmalphConfig {
  name: string;
  description: string;
  level: number;
  createdAt: string;
}

const CONFIG_FILE = "bmalph/config.json";

export async function readConfig(projectDir: string): Promise<BmalphConfig | null> {
  try {
    const content = await readFile(join(projectDir, CONFIG_FILE), "utf-8");
    return JSON.parse(content) as BmalphConfig;
  } catch {
    return null;
  }
}

export async function writeConfig(projectDir: string, config: BmalphConfig): Promise<void> {
  await writeFile(join(projectDir, CONFIG_FILE), JSON.stringify(config, null, 2) + "\n");
}
