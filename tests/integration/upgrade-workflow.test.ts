import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm, readFile, writeFile, access } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { installProject, copyBundledAssets } from "../../src/installer.js";
import { writeConfig, type BmalphConfig } from "../../src/utils/config.js";

describe("upgrade workflow", { timeout: 30000 }, () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `bmalph-upgrade-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Windows file locking
    }
  });

  it("init then upgrade restores modified bundled files", async () => {
    // Initial install
    await installProject(testDir);
    const config: BmalphConfig = {
      name: "upgrade-test",
      description: "Testing upgrade",
      level: 2,
      createdAt: new Date().toISOString(),
    };
    await writeConfig(testDir, config);

    // Modify a bundled file
    await writeFile(join(testDir, ".ralph/ralph_loop.sh"), "# corrupted content");

    // Upgrade (copyBundledAssets restores bundled files)
    await copyBundledAssets(testDir);

    // Bundled file is restored
    const loopContent = await readFile(join(testDir, ".ralph/ralph_loop.sh"), "utf-8");
    expect(loopContent).not.toBe("# corrupted content");
    expect(loopContent).toContain("#!/");

    // Config is preserved
    const configContent = JSON.parse(await readFile(join(testDir, "bmalph/config.json"), "utf-8"));
    expect(configContent.name).toBe("upgrade-test");
  });

  it("upgrade preserves user state directories", async () => {
    await installProject(testDir);

    // Create user files in state directories
    await writeFile(join(testDir, ".ralph/specs/my-spec.md"), "# My Spec");
    await writeFile(join(testDir, ".ralph/logs/run-001.log"), "log entry");
    await writeFile(join(testDir, "bmalph/state/custom.json"), "{}");

    // Upgrade
    await copyBundledAssets(testDir);

    // User files preserved
    const spec = await readFile(join(testDir, ".ralph/specs/my-spec.md"), "utf-8");
    expect(spec).toBe("# My Spec");

    const log = await readFile(join(testDir, ".ralph/logs/run-001.log"), "utf-8");
    expect(log).toBe("log entry");

    const state = await readFile(join(testDir, "bmalph/state/custom.json"), "utf-8");
    expect(state).toBe("{}");
  });

  it("upgrade is idempotent on version marker", async () => {
    await installProject(testDir);

    const first = await readFile(join(testDir, ".ralph/ralph_loop.sh"), "utf-8");
    await copyBundledAssets(testDir);
    const second = await readFile(join(testDir, ".ralph/ralph_loop.sh"), "utf-8");

    expect(first).toBe(second);
  });

  it("upgrade updates .gitignore without duplicating entries", async () => {
    await installProject(testDir);
    await copyBundledAssets(testDir);

    const gitignore = await readFile(join(testDir, ".gitignore"), "utf-8");
    const logMatches = gitignore.match(/\.ralph\/logs\//g);
    const outputMatches = gitignore.match(/_bmad-output\//g);

    expect(logMatches).toHaveLength(1);
    expect(outputMatches).toHaveLength(1);
  });

  it("upgrade restores _bmad directory structure", async () => {
    await installProject(testDir);

    // Delete a subdirectory
    await rm(join(testDir, "_bmad/bmm"), { recursive: true, force: true });

    // Upgrade restores it
    await copyBundledAssets(testDir);
    await expect(access(join(testDir, "_bmad/bmm"))).resolves.toBeUndefined();
  });
});
