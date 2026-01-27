import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm, readFile, access } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { installProject, mergeClaudeMd } from "../../src/installer.js";
import { writeConfig, readConfig, type BmalphConfig } from "../../src/utils/config.js";

describe("init flow integration", { timeout: 30000 }, () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(
      tmpdir(),
      `bmalph-integration-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Windows file locking
    }
  });

  it("full init creates a working project structure", async () => {
    await installProject(testDir);

    const config: BmalphConfig = {
      name: "test-project",
      description: "Integration test project",
      createdAt: new Date().toISOString(),
    };
    await writeConfig(testDir, config);
    await mergeClaudeMd(testDir);

    // Verify config is readable
    const readBack = await readConfig(testDir);
    expect(readBack).toEqual(config);

    // Verify CLAUDE.md was created
    const claudeMd = await readFile(join(testDir, "CLAUDE.md"), "utf-8");
    expect(claudeMd).toContain("BMAD-METHOD");

    // Verify _bmad directory with actual BMAD agents
    await expect(access(join(testDir, "_bmad/config.yaml"))).resolves.toBeUndefined();
    await expect(access(join(testDir, "_bmad/core"))).resolves.toBeUndefined();
    await expect(access(join(testDir, "_bmad/bmm"))).resolves.toBeUndefined();

    // Verify BMAD agent files exist
    await expect(
      access(join(testDir, "_bmad/bmm/agents/analyst.agent.yaml"))
    ).resolves.toBeUndefined();
    await expect(access(join(testDir, "_bmad/bmm/agents/pm.agent.yaml"))).resolves.toBeUndefined();
    await expect(
      access(join(testDir, "_bmad/bmm/agents/architect.agent.yaml"))
    ).resolves.toBeUndefined();

    // Verify .ralph directory with ralph loop
    await expect(access(join(testDir, ".ralph/ralph_loop.sh"))).resolves.toBeUndefined();
    await expect(access(join(testDir, ".ralph/lib/circuit_breaker.sh"))).resolves.toBeUndefined();
    await expect(access(join(testDir, ".ralph/lib/response_analyzer.sh"))).resolves.toBeUndefined();

    // Verify .ralph subdirectories
    await expect(access(join(testDir, ".ralph/specs"))).resolves.toBeUndefined();
    await expect(access(join(testDir, ".ralph/logs"))).resolves.toBeUndefined();

    // Verify bmalph state directory
    await expect(access(join(testDir, "bmalph/state"))).resolves.toBeUndefined();
  });

  it("config round-trip works with all fields", async () => {
    await installProject(testDir);

    const config: BmalphConfig = {
      name: "my-project",
      description: "A complex project",
      createdAt: "2025-06-01T00:00:00.000Z",
    };
    await writeConfig(testDir, config);

    const readBack = await readConfig(testDir);
    expect(readBack).toEqual(config);
  });

  it("mergeClaudeMd references /bmalph slash command", async () => {
    await installProject(testDir);
    await mergeClaudeMd(testDir);

    const claudeMd = await readFile(join(testDir, "CLAUDE.md"), "utf-8");
    expect(claudeMd).toContain("/bmalph");
    expect(claudeMd).toContain("/bmalph-implement");
    expect(claudeMd).toContain("/bmalph-status");
    expect(claudeMd).not.toContain("bmalph plan");
    // Expanded content: phases, agents, help command
    expect(claudeMd).toContain("Analysis");
    expect(claudeMd).toContain("Implementation");
    expect(claudeMd).toContain("/bmad-help");
    expect(claudeMd).toContain("/analyst");
  });

  it("installs slash command to .claude/commands/", async () => {
    await installProject(testDir);
    await expect(access(join(testDir, ".claude/commands/bmalph.md"))).resolves.toBeUndefined();
    const content = await readFile(join(testDir, ".claude/commands/bmalph.md"), "utf-8");
    expect(content).toContain("_bmad/core/agents/bmad-master.agent.yaml");
  });
});
