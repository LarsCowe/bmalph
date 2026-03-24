import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";

const mockSpawn = vi.fn();
const mockExecFileSync = vi.fn();
vi.mock("node:child_process", () => ({
  spawn: mockSpawn,
  execFileSync: mockExecFileSync,
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
    vi.resetModules();
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

  it("throws when bash returns a non-zero exit code", async () => {
    mockSpawn.mockImplementation(() => {
      const child = createMockChild();
      process.nextTick(() => child.emit("close", 1));
      return child;
    });

    const { validateBashAvailable } = await import("../../src/run/ralph-process.js");
    await expect(validateBashAvailable()).rejects.toThrow("bash");
  });

  it("times out when bash validation hangs", async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "linux", configurable: true });

    try {
      const mockChild = createMockChild();
      mockSpawn.mockReturnValue(mockChild);

      const { validateBashAvailable } = await import("../../src/run/ralph-process.js");

      await expect(validateBashAvailable()).rejects.toThrow("bash");
      expect(mockChild.kill).toHaveBeenCalled();
    } finally {
      Object.defineProperty(process, "platform", {
        value: originalPlatform,
        configurable: true,
      });
    }
  }, 10000);

  it("filters Windows shim bash paths and caches a working Git Bash binary", async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "win32", configurable: true });

    try {
      mockExecFileSync.mockReturnValue(
        "C:\\Windows\\System32\\bash.exe\r\nC:\\Program Files\\Git\\bin\\bash.exe\r\n"
      );
      mockSpawn.mockImplementation((command: string, args: string[]) => {
        const child = createMockChild();
        process.nextTick(() => {
          if (args[0] === "--version") {
            child.emit("close", command.includes("Git\\bin\\bash.exe") ? 0 : 1);
          }
        });
        return child;
      });

      const { validateBashAvailable, spawnRalphLoop } =
        await import("../../src/run/ralph-process.js");

      await expect(validateBashAvailable()).resolves.toBeUndefined();

      const loopChild = createMockChild();
      mockSpawn.mockReset();
      mockSpawn.mockReturnValue(loopChild);

      spawnRalphLoop("C:\\Users\\Test\\project", "cursor", { inheritStdio: false });

      expect(mockExecFileSync).toHaveBeenCalledWith("where", ["bash"], expect.any(Object));
      expect(mockSpawn).toHaveBeenCalledWith(
        "C:\\Program Files\\Git\\bin\\bash.exe",
        ["./.ralph/ralph_loop.sh"],
        expect.objectContaining({
          cwd: "C:\\Users\\Test\\project",
          env: expect.objectContaining({ PLATFORM_DRIVER: "cursor" }),
        })
      );
    } finally {
      Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true });
    }
  });

  it("deduplicates concurrent bash resolution while discovery is in flight", async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "win32", configurable: true });

    try {
      mockExecFileSync.mockReturnValue("C:\\Program Files\\Git\\bin\\bash.exe\r\n");
      mockSpawn.mockImplementation((_command: string, args: string[]) => {
        const child = createMockChild();
        process.nextTick(() => {
          if (args[0] === "--version") {
            child.emit("close", 0);
          }
        });
        return child;
      });

      const { resolveBashCommand } = await import("../../src/run/ralph-process.js");
      const results = await Promise.all([resolveBashCommand(), resolveBashCommand()]);

      expect(results).toEqual([
        "C:\\Program Files\\Git\\bin\\bash.exe",
        "C:\\Program Files\\Git\\bin\\bash.exe",
      ]);
      expect(mockSpawn).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true });
    }
  });
});

describe("parseBashVersion", () => {
  it("extracts version from standard bash --version output", async () => {
    const { parseBashVersion } = await import("../../src/run/ralph-process.js");
    const output = "GNU bash, version 5.2.37(1)-release (x86_64-pc-linux-gnu)\n";
    expect(parseBashVersion(output)).toBe("5.2.37");
  });

  it("extracts version from macOS system bash output", async () => {
    const { parseBashVersion } = await import("../../src/run/ralph-process.js");
    const output =
      "GNU bash, version 3.2.57(1)-release (arm64-apple-darwin24)\nCopyright (C) 2007 Free Software Foundation, Inc.\n";
    expect(parseBashVersion(output)).toBe("3.2.57");
  });

  it("returns undefined for empty output", async () => {
    const { parseBashVersion } = await import("../../src/run/ralph-process.js");
    expect(parseBashVersion("")).toBeUndefined();
  });

  it("returns undefined for malformed output", async () => {
    const { parseBashVersion } = await import("../../src/run/ralph-process.js");
    expect(parseBashVersion("not a bash version string")).toBeUndefined();
  });
});

describe("detectBashVersion", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  function createPipedMockChild(): ChildProcess {
    const mockStdout = new EventEmitter();
    const mockStderr = new EventEmitter();
    return createMockChild({
      stdout: mockStdout as unknown as ChildProcess["stdout"],
      stderr: mockStderr as unknown as ChildProcess["stderr"],
    });
  }

  function mockSpawnForVersionDetection(versionOutput: string): void {
    mockSpawn.mockImplementation((_cmd: string, args: string[]) => {
      if (args[0] === "--version") {
        const child = createMockChild();
        process.nextTick(() => child.emit("close", 0));
        return child;
      }

      // runBashCommand spawns bash -lc "bash --version"
      const child = createPipedMockChild();
      process.nextTick(() => {
        child.stdout!.emit("data", Buffer.from(versionOutput));
        child.emit("close", 0);
      });
      return child;
    });
  }

  it("returns version string after spawning the resolved bash", async () => {
    mockSpawnForVersionDetection("GNU bash, version 5.2.37(1)-release (x86_64-pc-linux-gnu)\n");

    const { resolveBashCommand, detectBashVersion } =
      await import("../../src/run/ralph-process.js");
    await resolveBashCommand();

    const version = await detectBashVersion();
    expect(version).toBe("5.2.37");
  });

  it("returns undefined when bash --version output is unparseable", async () => {
    mockSpawnForVersionDetection("some other shell\n");

    const { resolveBashCommand, detectBashVersion } =
      await import("../../src/run/ralph-process.js");
    await resolveBashCommand();

    const version = await detectBashVersion();
    expect(version).toBeUndefined();
  });

  it("caches the result across multiple calls", async () => {
    let bashLcCount = 0;
    mockSpawn.mockImplementation((_cmd: string, args: string[]) => {
      if (args[0] === "--version") {
        const child = createMockChild();
        process.nextTick(() => child.emit("close", 0));
        return child;
      }

      bashLcCount++;
      const child = createPipedMockChild();
      process.nextTick(() => {
        child.stdout!.emit(
          "data",
          Buffer.from("GNU bash, version 5.2.37(1)-release (x86_64-pc-linux-gnu)\n")
        );
        child.emit("close", 0);
      });
      return child;
    });

    const { resolveBashCommand, detectBashVersion } =
      await import("../../src/run/ralph-process.js");
    await resolveBashCommand();

    await detectBashVersion();
    await detectBashVersion();

    expect(bashLcCount).toBe(1);
  });

  it("returns undefined when runBashCommand throws", async () => {
    mockSpawn.mockImplementation((_cmd: string, args: string[]) => {
      if (args[0] === "--version") {
        const child = createMockChild();
        process.nextTick(() => child.emit("close", 0));
        return child;
      }

      const child = createPipedMockChild();
      process.nextTick(() => child.emit("error", new Error("spawn failed")));
      return child;
    });

    const { resolveBashCommand, detectBashVersion } =
      await import("../../src/run/ralph-process.js");
    await resolveBashCommand();

    const version = await detectBashVersion();
    expect(version).toBeUndefined();
  });
});

describe("validateRalphLoop", () => {
  beforeEach(() => {
    vi.resetModules();
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
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("spawns bash with ralph_loop.sh and PLATFORM_DRIVER env", async () => {
    const mockChild = createMockChild();
    mockSpawn.mockReturnValue(mockChild);

    const { spawnRalphLoop } = await import("../../src/run/ralph-process.js");
    const rp = spawnRalphLoop("/project", "claude-code", { inheritStdio: false });

    expect(mockSpawn).toHaveBeenCalledWith(
      "bash",
      ["./.ralph/ralph_loop.sh"],
      expect.objectContaining({
        cwd: "/project",
        env: expect.objectContaining({ PLATFORM_DRIVER: "claude-code" }),
      })
    );
    expect(rp.state).toBe("running");
  });

  it("uses a bash-safe relative loop path on Windows project directories", async () => {
    const mockChild = createMockChild();
    mockSpawn.mockReturnValue(mockChild);

    const { spawnRalphLoop } = await import("../../src/run/ralph-process.js");
    spawnRalphLoop("C:\\Users\\Test\\project", "claude-code", { inheritStdio: false });

    const spawnArgs = mockSpawn.mock.calls[0][1] as string[];
    expect(spawnArgs[0]).toBe("./.ralph/ralph_loop.sh");
    expect(spawnArgs[0]).not.toContain("C:\\Users\\Test\\project");
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

  it("kills the Unix process group when the child pid exists", async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "linux", configurable: true });

    try {
      const mockChild = createMockChild();
      mockSpawn.mockReturnValue(mockChild);
      const processKillSpy = vi.spyOn(process, "kill").mockReturnValue(true);

      const { spawnRalphLoop } = await import("../../src/run/ralph-process.js");
      const rp = spawnRalphLoop("/project", "claude-code", { inheritStdio: false });

      rp.kill();

      expect(processKillSpy).toHaveBeenCalledWith(-12345, "SIGTERM");
      expect(mockChild.kill).not.toHaveBeenCalled();

      processKillSpy.mockRestore();
    } finally {
      Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true });
    }
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

  it("transitions to stopped and fires onExit on spawn error event", async () => {
    const mockChild = createMockChild();
    mockSpawn.mockReturnValue(mockChild);

    const { spawnRalphLoop } = await import("../../src/run/ralph-process.js");
    const rp = spawnRalphLoop("/project", "claude-code", { inheritStdio: false });

    const exitCallback = vi.fn();
    rp.onExit(exitCallback);

    mockChild.emit("error", new Error("spawn ENOENT"));

    expect(rp.state).toBe("stopped");
    expect(exitCallback).toHaveBeenCalledWith(null);
  });

  it("passes REVIEW_MODE, REVIEW_ENABLED, and REVIEW_INTERVAL env vars for enhanced mode", async () => {
    const mockChild = createMockChild();
    mockSpawn.mockReturnValue(mockChild);

    const { spawnRalphLoop } = await import("../../src/run/ralph-process.js");
    spawnRalphLoop("/project", "claude-code", { inheritStdio: false, reviewMode: "enhanced" });

    expect(mockSpawn).toHaveBeenCalledWith(
      "bash",
      ["./.ralph/ralph_loop.sh"],
      expect.objectContaining({
        env: expect.objectContaining({
          PLATFORM_DRIVER: "claude-code",
          REVIEW_MODE: "enhanced",
          REVIEW_ENABLED: "true",
          REVIEW_INTERVAL: "5",
        }),
      })
    );
  });

  it("passes REVIEW_MODE and REVIEW_ENABLED without REVIEW_INTERVAL for ultimate mode", async () => {
    const mockChild = createMockChild();
    mockSpawn.mockReturnValue(mockChild);

    const { spawnRalphLoop } = await import("../../src/run/ralph-process.js");
    spawnRalphLoop("/project", "claude-code", { inheritStdio: false, reviewMode: "ultimate" });

    const spawnEnv = mockSpawn.mock.calls[0][2].env;
    expect(spawnEnv.REVIEW_MODE).toBe("ultimate");
    expect(spawnEnv.REVIEW_ENABLED).toBe("true");
    expect(spawnEnv.REVIEW_INTERVAL).toBeUndefined();
  });

  it("sets REVIEW_MODE to off without REVIEW_ENABLED when reviewMode is off", async () => {
    const mockChild = createMockChild();
    mockSpawn.mockReturnValue(mockChild);

    const { spawnRalphLoop } = await import("../../src/run/ralph-process.js");
    spawnRalphLoop("/project", "claude-code", { inheritStdio: false, reviewMode: "off" });

    const spawnEnv = mockSpawn.mock.calls[0][2].env;
    expect(spawnEnv.REVIEW_MODE).toBe("off");
    expect(spawnEnv.REVIEW_ENABLED).toBeUndefined();
  });

  it("does not set review env vars when reviewMode is omitted", async () => {
    const mockChild = createMockChild();
    mockSpawn.mockReturnValue(mockChild);

    const { spawnRalphLoop } = await import("../../src/run/ralph-process.js");
    spawnRalphLoop("/project", "claude-code", { inheritStdio: false });

    const spawnEnv = mockSpawn.mock.calls[0][2].env;
    expect(spawnEnv.REVIEW_MODE).toBeUndefined();
  });

  it("uses taskkill to terminate the process tree on win32 platform", async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "win32", configurable: true });

    try {
      const mockChild = createMockChild();
      mockSpawn.mockReturnValue(mockChild);

      const processKillSpy = vi.spyOn(process, "kill");

      const { spawnRalphLoop } = await import("../../src/run/ralph-process.js");
      const rp = spawnRalphLoop("/project", "claude-code", { inheritStdio: false });

      rp.kill();

      expect(mockExecFileSync).toHaveBeenCalledWith(
        "taskkill.exe",
        ["/PID", "12345", "/T", "/F"],
        expect.objectContaining({
          stdio: "ignore",
          windowsHide: true,
        })
      );
      expect(mockChild.kill).not.toHaveBeenCalled();
      expect(processKillSpy).not.toHaveBeenCalled();

      processKillSpy.mockRestore();
    } finally {
      Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true });
    }
  });

  it("falls back to child.kill on win32 when taskkill fails", async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "win32", configurable: true });

    try {
      const mockChild = createMockChild();
      mockSpawn.mockReturnValue(mockChild);
      mockExecFileSync.mockImplementation(() => {
        throw new Error("taskkill failed");
      });

      const { spawnRalphLoop } = await import("../../src/run/ralph-process.js");
      const rp = spawnRalphLoop("/project", "claude-code", { inheritStdio: false });

      rp.kill();

      expect(mockExecFileSync).toHaveBeenCalledWith(
        "taskkill.exe",
        ["/PID", "12345", "/T", "/F"],
        expect.any(Object)
      );
      expect(mockChild.kill).toHaveBeenCalledWith("SIGTERM");
    } finally {
      Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true });
    }
  });

  it("falls back to child.kill on win32 when the child pid is missing", async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "win32", configurable: true });

    try {
      const mockChild = createMockChild({ pid: undefined });
      mockSpawn.mockReturnValue(mockChild);

      const { spawnRalphLoop } = await import("../../src/run/ralph-process.js");
      const rp = spawnRalphLoop("/project", "claude-code", { inheritStdio: false });

      rp.kill();

      expect(mockExecFileSync).not.toHaveBeenCalled();
      expect(mockChild.kill).toHaveBeenCalledWith("SIGTERM");
    } finally {
      Object.defineProperty(process, "platform", { value: originalPlatform, configurable: true });
    }
  });
});

describe("validateGitRepo", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  function createPipedMockChild(): ChildProcess {
    const mockStdout = new EventEmitter();
    const mockStderr = new EventEmitter();
    return createMockChild({
      stdout: mockStdout as unknown as ChildProcess["stdout"],
      stderr: mockStderr as unknown as ChildProcess["stderr"],
    });
  }

  function mockSpawnForGitCheck(gitDirExitCode: number, headExitCode = 0): void {
    mockSpawn.mockImplementation((_cmd: string, args: string[]) => {
      // resolveBashCommand: bash --version
      if (args[0] === "--version") {
        const child = createMockChild();
        process.nextTick(() => child.emit("close", 0));
        return child;
      }

      // runBashCommand: bash -lc "<command>"
      const command = args[1] as string;
      const child = createPipedMockChild();
      if (command.includes("git rev-parse --git-dir")) {
        process.nextTick(() => child.emit("close", gitDirExitCode));
      } else if (command.includes("git rev-parse HEAD")) {
        process.nextTick(() => child.emit("close", headExitCode));
      } else {
        process.nextTick(() => child.emit("close", 0));
      }
      return child;
    });
  }

  it("resolves when directory is a git repo with commits", async () => {
    mockSpawnForGitCheck(0, 0);

    const { validateGitRepo } = await import("../../src/run/ralph-process.js");

    await expect(validateGitRepo("/project")).resolves.toBeUndefined();
  });

  it("throws when directory is not a git repository", async () => {
    mockSpawnForGitCheck(128);

    const { validateGitRepo } = await import("../../src/run/ralph-process.js");

    await expect(validateGitRepo("/project")).rejects.toThrow(/git repository/i);
  });

  it("throws when git repo has no commits", async () => {
    mockSpawnForGitCheck(0, 128);

    const { validateGitRepo } = await import("../../src/run/ralph-process.js");

    await expect(validateGitRepo("/project")).rejects.toThrow(/commit/i);
  });
});
