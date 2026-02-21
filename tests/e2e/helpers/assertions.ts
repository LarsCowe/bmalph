import { access, readFile, stat } from "fs/promises";
import { join } from "path";
import { expect } from "vitest";

/**
 * Assert that a directory exists
 */
export async function expectDirectoryExists(path: string): Promise<void> {
  const s = await stat(path);
  expect(s.isDirectory(), `Expected ${path} to be a directory`).toBe(true);
}

/**
 * Assert that a file exists
 */
export async function expectFileExists(path: string): Promise<void> {
  await expect(access(path)).resolves.toBeUndefined();
}

/**
 * Assert that a file does not exist
 */
export async function expectFileNotExists(path: string): Promise<void> {
  await expect(access(path)).rejects.toThrow();
}

/**
 * Assert that a file contains a substring
 */
export async function expectFileContains(path: string, substring: string): Promise<void> {
  const content = await readFile(path, "utf-8");
  expect(content).toContain(substring);
}

/**
 * Assert that a file does not contain a substring
 */
export async function expectFileNotContains(path: string, substring: string): Promise<void> {
  const content = await readFile(path, "utf-8");
  expect(content).not.toContain(substring);
}

/**
 * Assert that a file contains valid JSON
 */
export async function expectValidJson(path: string): Promise<unknown> {
  const content = await readFile(path, "utf-8");
  const data = JSON.parse(content);
  expect(data).toBeDefined();
  return data;
}

/**
 * Composite check: assert that bmalph is properly initialized in a directory
 */
export async function expectBmalphInitialized(projectPath: string): Promise<void> {
  // Core directories
  await expectDirectoryExists(join(projectPath, "_bmad"));
  await expectDirectoryExists(join(projectPath, ".ralph"));
  await expectDirectoryExists(join(projectPath, "bmalph"));
  await expectDirectoryExists(join(projectPath, ".claude/commands"));

  // Key files
  await expectFileExists(join(projectPath, "bmalph/config.json"));
  await expectFileExists(join(projectPath, ".ralph/ralph_loop.sh"));
  await expectFileExists(join(projectPath, ".claude/commands/bmalph.md"));
  await expectFileExists(join(projectPath, "CLAUDE.md"));

  // CLAUDE.md contains BMAD snippet
  await expectFileContains(join(projectPath, "CLAUDE.md"), "BMAD-METHOD");

  // Config is valid JSON
  await expectValidJson(join(projectPath, "bmalph/config.json"));
}

/**
 * Assert that doctor output contains a specific check with expected status
 */
export function expectDoctorCheckPassed(output: string, checkLabel: string): void {
  // Doctor uses ✓ for passed checks
  expect(output).toMatch(new RegExp(`[✓✔]\\s+${escapeRegex(checkLabel)}`));
}

/**
 * Assert that doctor output contains a specific check as failed
 */
export function expectDoctorCheckFailed(output: string, checkLabel: string): void {
  // Doctor uses ✗ for failed checks
  expect(output).toMatch(new RegExp(`[✗✘]\\s+${escapeRegex(checkLabel)}`));
}

/**
 * Assert that the output contains the passed/failed summary
 */
export function expectDoctorSummary(
  output: string,
  expectedPassed: number,
  expectedFailed: number
): void {
  expect(output).toContain(`${expectedPassed} passed`);
  if (expectedFailed > 0) {
    expect(output).toContain(`${expectedFailed} failed`);
  }
}

/**
 * Platform-specific config for assertions
 */
export interface PlatformAssertionConfig {
  id: string;
  instructionsFile: string;
  commandDelivery: "directory" | "inline" | "none";
}

/**
 * Composite check: assert that bmalph is properly initialized for a specific platform
 */
export async function expectBmalphInitializedForPlatform(
  projectPath: string,
  platform: PlatformAssertionConfig
): Promise<void> {
  // Core directories (all platforms)
  await expectDirectoryExists(join(projectPath, "_bmad"));
  await expectDirectoryExists(join(projectPath, ".ralph"));
  await expectDirectoryExists(join(projectPath, "bmalph"));

  // Key files (all platforms)
  await expectFileExists(join(projectPath, "bmalph/config.json"));
  await expectFileExists(join(projectPath, ".ralph/ralph_loop.sh"));

  // Config has correct platform
  const config = (await expectValidJson(join(projectPath, "bmalph/config.json"))) as Record<
    string,
    unknown
  >;
  expect(config.platform).toBe(platform.id);

  // Instructions file exists and contains BMAD snippet
  await expectFileExists(join(projectPath, platform.instructionsFile));
  await expectFileContains(join(projectPath, platform.instructionsFile), "BMAD-METHOD");

  // Command delivery structure
  if (platform.commandDelivery === "directory") {
    await expectDirectoryExists(join(projectPath, ".claude/commands"));
    await expectFileExists(join(projectPath, ".claude/commands/bmalph.md"));
  } else {
    await expectFileNotExists(join(projectPath, ".claude/commands"));
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
