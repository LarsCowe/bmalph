import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";

const mockSpawn = vi.fn();
vi.mock("node:child_process", () => ({
  spawn: mockSpawn,
}));

const mockExists = vi.fn();
vi.mock("../../src/utils/file-system.js", () => ({
  exists: mockExists,
}));

function createMockChild(overrides?: Partial<ChildProcess>): ChildProcess {
  const emitter = new EventEmitter();
  const child = Object.assign(emitter, {
    pid: 12345,
    stdin: null,
    stdout: null,
    stderr: null,
    stdio: [null, null, null, null, null] as ChildProcess["stdio"],
    channel: undefined,
    connected: false,
    exitCode: null,
    signalCode: null,
    spawnargs: [],
    spawnfile: "",
    killed: false,
    kill: vi.fn().mockReturnValue(true),
    send: vi.fn(),
    disconnect: vi.fn(),
    ref: vi.fn(),
    unref: vi.fn(),
    [Symbol.dispose]: vi.fn(),
    ...overrides,
  }) as unknown as ChildProcess;
  return child;
}

describe("validateBashAvailable", () => {
  let originalPath: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    originalPath = process.env.PATH;
  });

  afterEach(() => {
    process.env.PATH = originalPath;
  });

  it("resolves when bash is found in PATH", async () => {
    mockSpawn.mockImplementation(() => {
      const child = createMockChild();
      process.nextTick(() => child.emit("close", 0));
      return child;
    });

    const { validateBashAvailable } = await import("../../src/run/ralph-process.js");
    await expect(validateBashAvailable()).resolves.toBeUndefined();
  });

  it("throws when bash is not found", async () => {
    mockSpawn.mockImplementation(() => {
      const child = createMockChild();
      process.nextTick(() => child.emit("error", new Error("spawn bash ENOENT")));
      return child;
    });

    const { validateBashAvailable } = await import("../../src/run/ralph-process.js");
    await expect(validateBashAvailable()).rejects.toThrow("bash");
  });
});

describe("validateRalphLoop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves when ralph_loop.sh exists", async () => {
    mockExists.mockResolvedValue(true);

    const { validateRalphLoop } = await import("../../src/run/ralph-process.js");
    await expect(validateRalphLoop("/project")).resolves.toBeUndefined();
    expect(mockExists).toHaveBeenCalledWith(expect.stringContaining("ralph_loop.sh"));
  });

  it("throws when ralph_loop.sh is missing", async () => {
    mockExists.mockResolvedValue(false);

    const { validateRalphLoop } = await import("../../src/run/ralph-process.js");
    await expect(validateRalphLoop("/project")).rejects.toThrow("ralph_loop.sh");
  });

  it("re-throws non-ENOENT errors instead of masking them", async () => {
    mockExists.mockRejectedValue(Object.assign(new Error("EACCES"), { code: "EACCES" }));

    const { validateRalphLoop } = await import("../../src/run/ralph-process.js");
    await expect(validateRalphLoop("/project")).rejects.toThrow("EACCES");
  });
});

describe("spawnRalphLoop", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("spawns bash with ralph_loop.sh and PLATFORM_DRIVER env", async () => {
    const mockChild = createMockChild();
    mockSpawn.mockReturnValue(mockChild);

    const { spawnRalphLoop } = await import("../../src/run/ralph-process.js");
    const rp = spawnRalphLoop("/project", "claude-code", { inheritStdio: false });

    expect(mockSpawn).toHaveBeenCalledWith(
      "bash",
      [expect.stringContaining("ralph_loop.sh")],
      expect.objectContaining({
        cwd: "/project",
        env: expect.objectContaining({ PLATFORM_DRIVER: "claude-code" }),
      })
    );
    expect(rp.state).toBe("running");
  });

  it("uses inherit stdio when inheritStdio is true", async () => {
    const mockChild = createMockChild();
    mockSpawn.mockReturnValue(mockChild);

    const { spawnRalphLoop } = await import("../../src/run/ralph-process.js");
    spawnRalphLoop("/project", "codex", { inheritStdio: true });

    expect(mockSpawn).toHaveBeenCalledWith(
      "bash",
      expect.any(Array),
      expect.objectContaining({
        stdio: "inherit",
      })
    );
  });

  it("uses piped stdio when inheritStdio is false", async () => {
    const mockChild = createMockChild();
    mockSpawn.mockReturnValue(mockChild);

    const { spawnRalphLoop } = await import("../../src/run/ralph-process.js");
    spawnRalphLoop("/project", "claude-code", { inheritStdio: false });

    expect(mockSpawn).toHaveBeenCalledWith(
      "bash",
      expect.any(Array),
      expect.objectContaining({
        stdio: ["ignore", "pipe", "pipe"],
      })
    );
  });

  it("tracks exit code and updates state on child exit", async () => {
    const mockChild = createMockChild();
    mockSpawn.mockReturnValue(mockChild);

    const { spawnRalphLoop } = await import("../../src/run/ralph-process.js");
    const rp = spawnRalphLoop("/project", "claude-code", { inheritStdio: false });

    const exitCallback = vi.fn();
    rp.onExit(exitCallback);

    mockChild.emit("close", 0);

    expect(rp.state).toBe("stopped");
    expect(rp.exitCode).toBe(0);
    expect(exitCallback).toHaveBeenCalledWith(0);
  });

  it("calls kill on the child process", async () => {
    const mockChild = createMockChild();
    mockSpawn.mockReturnValue(mockChild);

    const { spawnRalphLoop } = await import("../../src/run/ralph-process.js");
    const rp = spawnRalphLoop("/project", "claude-code", { inheritStdio: false });

    rp.kill();

    expect(mockChild.kill).toHaveBeenCalled();
  });

  it("does not throw when fallback child.kill also fails (process already dead)", async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "linux", configurable: true });

    try {
      const mockChild = createMockChild();
      mockSpawn.mockReturnValue(mockChild);

      // Mock process.kill to throw ESRCH (process group kill fails)
      const processKillSpy = vi.spyOn(process, "kill").mockImplementation(() => {
        throw Object.assign(new Error("ESRCH"), { code: "ESRCH" });
      });

      // Mock child.kill to also throw (child already dead)
      vi.mocked(mockChild.kill).mockImplementation(() => {
        throw Object.assign(new Error("ESRCH"), { code: "ESRCH" });
      });

      const { spawnRalphLoop } = await import("../../src/run/ralph-process.js");
      const rp = spawnRalphLoop("/project", "claude-code", { inheritStdio: false });

      // Should not throw
      expect(() => rp.kill()).not.toThrow();

      processKillSpy.mockRestore();
    } finally {
      Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true });
    }
  });

  it("detach unrefs the child and updates state", async () => {
    const mockChild = createMockChild();
    mockSpawn.mockReturnValue(mockChild);

    const { spawnRalphLoop } = await import("../../src/run/ralph-process.js");
    const rp = spawnRalphLoop("/project", "claude-code", { inheritStdio: false });

    rp.detach();

    expect(mockChild.unref).toHaveBeenCalled();
    expect(rp.state).toBe("detached");
  });

  it("exposes the child pid", async () => {
    const mockChild = createMockChild({ pid: 99999 });
    mockSpawn.mockReturnValue(mockChild);

    const { spawnRalphLoop } = await import("../../src/run/ralph-process.js");
    const rp = spawnRalphLoop("/project", "claude-code", { inheritStdio: false });

    expect(rp.child.pid).toBe(99999);
  });

  it("fires onExit callback immediately when registered after process exits", async () => {
    const mockChild = createMockChild();
    mockSpawn.mockReturnValue(mockChild);

    const { spawnRalphLoop } = await import("../../src/run/ralph-process.js");
    const rp = spawnRalphLoop("/project", "claude-code", { inheritStdio: false });

    mockChild.emit("close", 42);

    const exitCallback = vi.fn();
    rp.onExit(exitCallback);

    expect(exitCallback).toHaveBeenCalledWith(42);
  });
});
