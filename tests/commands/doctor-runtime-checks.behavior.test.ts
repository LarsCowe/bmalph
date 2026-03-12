import { describe, it, expect, afterEach } from "vitest";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  checkApiCalls,
  checkCircuitBreaker,
  checkRalphSession,
} from "../../src/commands/doctor-runtime-checks.js";

function makeTmpDir(): string {
  return join(
    tmpdir(),
    `bmalph-doctor-runtime-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

async function writeJson(path: string, data: unknown): Promise<void> {
  await writeFile(path, JSON.stringify(data));
}

describe("doctor-runtime-checks behavior", () => {
  let testDir: string;

  afterEach(async () => {
    if (!testDir) return;

    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Windows file locking
    }
  });

  it("accepts camelCase status.json for API call checks", async () => {
    testDir = makeTmpDir();
    const ralphDir = join(testDir, ".ralph");
    await mkdir(ralphDir, { recursive: true });
    await writeJson(join(ralphDir, "status.json"), {
      loopCount: 5,
      status: "running",
      tasksCompleted: 2,
      tasksTotal: 8,
    });

    const result = await checkApiCalls(testDir);

    expect(result.passed).toBe(true);
    expect(result.detail).toBe("0/unlimited");
  });

  it("treats malformed snake_case API counters as a corrupt status file", async () => {
    testDir = makeTmpDir();
    const ralphDir = join(testDir, ".ralph");
    await mkdir(ralphDir, { recursive: true });
    await writeJson(join(ralphDir, "status.json"), {
      loop_count: 5,
      status: "running",
      calls_made_this_hour: "oops",
      max_calls_per_hour: 100,
    });

    const result = await checkApiCalls(testDir);

    expect(result.passed).toBe(false);
    expect(result.detail).toBe("corrupt status file");
  });

  it("treats malformed snake_case API counters as corrupt even when a camelCase mirror exists", async () => {
    testDir = makeTmpDir();
    const ralphDir = join(testDir, ".ralph");
    await mkdir(ralphDir, { recursive: true });
    await writeJson(join(ralphDir, "status.json"), {
      loop_count: 5,
      status: "running",
      calls_made_this_hour: "oops",
      callsMadeThisHour: 12,
      max_calls_per_hour: 100,
    });

    const result = await checkApiCalls(testDir);

    expect(result.passed).toBe(false);
    expect(result.detail).toBe("corrupt status file");
  });

  it("treats mixed-format corrupt payloads as a corrupt status file", async () => {
    testDir = makeTmpDir();
    const ralphDir = join(testDir, ".ralph");
    await mkdir(ralphDir, { recursive: true });
    await writeJson(join(ralphDir, "status.json"), {
      loopCount: "oops",
      status: "running",
      last_action: "retrying",
    });

    const result = await checkApiCalls(testDir);

    expect(result.passed).toBe(false);
    expect(result.detail).toBe("corrupt status file");
  });

  it("treats malformed snake_case loop fields as a corrupt status file", async () => {
    testDir = makeTmpDir();
    const ralphDir = join(testDir, ".ralph");
    await mkdir(ralphDir, { recursive: true });
    await writeJson(join(ralphDir, "status.json"), {
      loop_count: "oops",
      status: "running",
      tasks_completed: 2,
      tasks_total: 4,
      calls_made_this_hour: 5,
      max_calls_per_hour: 100,
    });

    const result = await checkApiCalls(testDir);

    expect(result.passed).toBe(false);
    expect(result.detail).toBe("corrupt status file");
  });

  it("treats unrecognized snake_case statuses as a corrupt status file", async () => {
    testDir = makeTmpDir();
    const ralphDir = join(testDir, ".ralph");
    await mkdir(ralphDir, { recursive: true });
    await writeJson(join(ralphDir, "status.json"), {
      loop_count: 7,
      status: "mystery",
      tasks_completed: 2,
      tasks_total: 4,
      calls_made_this_hour: 5,
      max_calls_per_hour: 100,
    });

    const result = await checkApiCalls(testDir);

    expect(result.passed).toBe(false);
    expect(result.detail).toBe("corrupt status file");
  });

  it("treats metadata-only snake_case payloads as a corrupt status file", async () => {
    testDir = makeTmpDir();
    const ralphDir = join(testDir, ".ralph");
    await mkdir(ralphDir, { recursive: true });
    await writeJson(join(ralphDir, "status.json"), {
      calls_made_this_hour: 5,
      max_calls_per_hour: 100,
      last_action: "retrying",
    });

    const result = await checkApiCalls(testDir);

    expect(result.passed).toBe(false);
    expect(result.detail).toBe("corrupt status file");
  });

  it("treats snake_case payloads without status as a corrupt status file", async () => {
    testDir = makeTmpDir();
    const ralphDir = join(testDir, ".ralph");
    await mkdir(ralphDir, { recursive: true });
    await writeJson(join(ralphDir, "status.json"), {
      loop_count: 7,
      calls_made_this_hour: 5,
      max_calls_per_hour: 100,
    });

    const result = await checkApiCalls(testDir);

    expect(result.passed).toBe(false);
    expect(result.detail).toBe("corrupt status file");
  });

  it("accepts a valid paused Ralph status file for API call checks", async () => {
    testDir = makeTmpDir();
    const ralphDir = join(testDir, ".ralph");
    await mkdir(ralphDir, { recursive: true });
    await writeJson(join(ralphDir, "status.json"), {
      loop_count: 7,
      status: "paused",
      calls_made_this_hour: 5,
      max_calls_per_hour: 100,
      last_action: "api_limit",
    });

    const result = await checkApiCalls(testDir);

    expect(result.passed).toBe(true);
    expect(result.detail).toBe("5/100");
  });

  it("accepts a valid error Ralph status file for API call checks", async () => {
    testDir = makeTmpDir();
    const ralphDir = join(testDir, ".ralph");
    await mkdir(ralphDir, { recursive: true });
    await writeJson(join(ralphDir, "status.json"), {
      loop_count: 7,
      status: "error",
      calls_made_this_hour: 5,
      max_calls_per_hour: 100,
      last_action: "failed",
    });

    const result = await checkApiCalls(testDir);

    expect(result.passed).toBe(true);
    expect(result.detail).toBe("5/100");
  });

  it("prefers Ralph snake_case API counters over conflicting camelCase mirrors", async () => {
    testDir = makeTmpDir();
    const ralphDir = join(testDir, ".ralph");
    await mkdir(ralphDir, { recursive: true });
    await writeJson(join(ralphDir, "status.json"), {
      loop_count: 5,
      status: "running",
      calls_made_this_hour: 12,
      max_calls_per_hour: 100,
      callsMadeThisHour: 0,
    });

    const result = await checkApiCalls(testDir);

    expect(result.passed).toBe(true);
    expect(result.detail).toBe("12/100");
  });

  it("prefers Ralph total_opens over conflicting camelCase mirrors in circuit breaker checks", async () => {
    testDir = makeTmpDir();
    const ralphDir = join(testDir, ".ralph");
    await mkdir(ralphDir, { recursive: true });
    await writeJson(join(ralphDir, ".circuit_breaker_state"), {
      state: "CLOSED",
      consecutive_no_progress: 1,
      total_opens: 4,
      totalOpens: 2,
    });

    const result = await checkCircuitBreaker(testDir);

    expect(result.passed).toBe(true);
    expect(result.detail).toBe("CLOSED (1 loops without progress)");
  });

  it("treats malformed Ralph total_opens as a corrupt circuit breaker file", async () => {
    testDir = makeTmpDir();
    const ralphDir = join(testDir, ".ralph");
    await mkdir(ralphDir, { recursive: true });
    await writeJson(join(ralphDir, ".circuit_breaker_state"), {
      state: "CLOSED",
      consecutive_no_progress: 1,
      total_opens: "oops",
      totalOpens: 2,
    });

    const result = await checkCircuitBreaker(testDir);

    expect(result.passed).toBe(false);
    expect(result.detail).toBe("corrupt state file");
  });

  it("treats unparsable session timestamps as invalid", async () => {
    testDir = makeTmpDir();
    const ralphDir = join(testDir, ".ralph");
    await mkdir(ralphDir, { recursive: true });
    await writeJson(join(ralphDir, ".ralph_session"), {
      session_id: "sess-1",
      created_at: "not-a-date",
    });

    const result = await checkRalphSession(testDir);

    expect(result.passed).toBe(false);
    expect(result.detail).toBe("invalid timestamp");
  });
});
