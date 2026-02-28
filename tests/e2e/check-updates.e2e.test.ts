import { describe, it, expect } from "vitest";
import { runCli } from "./helpers/cli-runner.js";

describe("bmalph check-updates e2e", { timeout: 60000 }, () => {
  it("check-updates --json outputs valid JSON", async () => {
    const result = await runCli(["check-updates", "--json"]);

    // Command should not crash regardless of network availability
    expect(result.exitCode).toBe(0);

    const output = JSON.parse(result.stdout);
    expect(output).toHaveProperty("bmad");
    expect(output).toHaveProperty("errors");
    expect(output).toHaveProperty("hasUpdates");
    expect(typeof output.hasUpdates).toBe("boolean");
    expect(Array.isArray(output.errors)).toBe(true);
  });

  it("check-updates produces human-readable output", async () => {
    const result = await runCli(["check-updates"]);

    expect(result.exitCode).toBe(0);
    // Should contain either a success or a "could not check" message
    expect(result.stdout).toMatch(/BMAD-METHOD|Checking upstream/);
  });
});
