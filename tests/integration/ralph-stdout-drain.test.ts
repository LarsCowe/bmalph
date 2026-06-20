import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnRalphLoop, validateBashAvailable } from "../../src/run/ralph-process.js";

/**
 * Regression test for the pipe-buffer deadlock: in non-inherit (dashboard /
 * swarm) mode the loop's stdout/stderr are piped but nothing consumes them.
 * A child that writes more than the OS pipe buffer (~64KB) blocks on write()
 * forever unless the streams are drained. This spawns a REAL bash process that
 * emits ~600KB and asserts it actually exits.
 */
describe("ralph loop stdout drain (integration)", { timeout: 30000 }, () => {
  let projectDir: string;

  beforeEach(async () => {
    projectDir = join(tmpdir(), `bmalph-drain-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(join(projectDir, ".ralph"), { recursive: true });
    // Emit far more than the ~64KB pipe buffer, then exit cleanly.
    await writeFile(
      join(projectDir, ".ralph", "ralph_loop.sh"),
      '#!/bin/bash\nfor i in $(seq 1 20000); do echo "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"; done\nexit 0\n'
    );
  });

  afterEach(async () => {
    await rm(projectDir, { recursive: true, force: true });
  });

  it("does not deadlock when the piped child floods stdout", async () => {
    await validateBashAvailable();

    const rp = spawnRalphLoop(projectDir, "claude-code", { inheritStdio: false });

    try {
      const exitCode = await new Promise<number | null>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("loop deadlocked: child never exited (pipe buffer not drained)")),
          15000
        );
        rp.onExit((code) => {
          clearTimeout(timer);
          resolve(code);
        });
      });

      expect(exitCode).toBe(0);
    } finally {
      if (rp.state === "running") rp.kill();
    }
  });
});
