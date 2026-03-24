import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RalphProcess } from "../../src/run/types.js";

vi.mock("../../src/watch/dashboard.js", () => ({
  createRefreshCallback: vi.fn(),
}));

vi.mock("../../src/watch/file-watcher.js", () => ({
  FileWatcher: vi.fn(function (this: { start: () => void; stop: () => void }) {
    this.start = vi.fn();
    this.stop = vi.fn();
  }),
}));

vi.mock("../../src/watch/frame-writer.js", () => ({
  createTerminalFrameWriter: vi.fn(() => ({
    cleanup: vi.fn(),
    write: vi.fn(),
  })),
}));

describe("renderStatusBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows running state with PID", async () => {
    const { renderStatusBar } = await import("../../src/run/run-dashboard.js");
    const ralph = { state: "running", exitCode: null, child: { pid: 12345 } } as RalphProcess;

    const result = renderStatusBar(ralph);

    expect(result).toContain("running");
    expect(result).toContain("12345");
    expect(result).toContain("q");
  });

  it("shows stopped state with completed label for exit 0", async () => {
    const { renderStatusBar } = await import("../../src/run/run-dashboard.js");
    const ralph = { state: "stopped", exitCode: 0, child: { pid: 12345 } } as RalphProcess;

    const result = renderStatusBar(ralph);

    expect(result).toContain("stopped");
    expect(result).toContain("completed");
    expect(result).toContain("q");
  });

  it("shows stopped state with error label for exit 1", async () => {
    const { renderStatusBar } = await import("../../src/run/run-dashboard.js");
    const ralph = { state: "stopped", exitCode: 1, child: { pid: 12345 } } as RalphProcess;

    const result = renderStatusBar(ralph);

    expect(result).toContain("stopped");
    expect(result).toContain("error");
  });

  it("shows timed out label for exit 124", async () => {
    const { renderStatusBar } = await import("../../src/run/run-dashboard.js");
    const ralph = { state: "stopped", exitCode: 124, child: { pid: 12345 } } as RalphProcess;

    const result = renderStatusBar(ralph);

    expect(result).toContain("stopped");
    expect(result).toContain("timed out");
  });

  it("shows killed label for exit 137", async () => {
    const { renderStatusBar } = await import("../../src/run/run-dashboard.js");
    const ralph = { state: "stopped", exitCode: 137, child: { pid: 12345 } } as RalphProcess;

    const result = renderStatusBar(ralph);

    expect(result).toContain("stopped");
    expect(result).toContain("killed (OOM or SIGKILL)");
  });

  it("shows unknown label for null exit code", async () => {
    const { renderStatusBar } = await import("../../src/run/run-dashboard.js");
    const ralph = { state: "stopped", exitCode: null, child: { pid: 12345 } } as RalphProcess;

    const result = renderStatusBar(ralph);

    expect(result).toContain("stopped");
    expect(result).toContain("unknown");
  });

  it("shows detached state", async () => {
    const { renderStatusBar } = await import("../../src/run/run-dashboard.js");
    const ralph = { state: "detached", exitCode: null, child: { pid: 12345 } } as RalphProcess;

    const result = renderStatusBar(ralph);

    expect(result).toContain("detached");
  });

  it("shows [review] badge for enhanced review mode", async () => {
    const { renderStatusBar } = await import("../../src/run/run-dashboard.js");
    const ralph = { state: "running", exitCode: null, child: { pid: 12345 } } as RalphProcess;

    const result = renderStatusBar(ralph, "enhanced");

    expect(result).toContain("[review]");
    expect(result).toContain("running");
  });

  it("shows [ultimate] badge for ultimate review mode", async () => {
    const { renderStatusBar } = await import("../../src/run/run-dashboard.js");
    const ralph = { state: "running", exitCode: null, child: { pid: 12345 } } as RalphProcess;

    const result = renderStatusBar(ralph, "ultimate");

    expect(result).toContain("[ultimate]");
    expect(result).toContain("running");
  });

  it("omits review badge when review mode is off", async () => {
    const { renderStatusBar } = await import("../../src/run/run-dashboard.js");
    const ralph = { state: "running", exitCode: null, child: { pid: 12345 } } as RalphProcess;

    const result = renderStatusBar(ralph, "off");

    expect(result).not.toContain("[review]");
    expect(result).not.toContain("[ultimate]");
  });

  it("omits review badge when review mode is undefined", async () => {
    const { renderStatusBar } = await import("../../src/run/run-dashboard.js");
    const ralph = { state: "running", exitCode: null, child: { pid: 12345 } } as RalphProcess;

    const result = renderStatusBar(ralph);

    expect(result).not.toContain("[review]");
    expect(result).not.toContain("[ultimate]");
  });
});

describe("renderQuitPrompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows stop and detach options", async () => {
    const { renderQuitPrompt } = await import("../../src/run/run-dashboard.js");
    const result = renderQuitPrompt();

    expect(result).toContain("s");
    expect(result).toContain("Stop");
    expect(result).toContain("d");
    expect(result).toContain("Detach");
    expect(result).toContain("c");
    expect(result).toContain("Cancel");
  });
});

describe("startRunDashboard", () => {
  let mockCreateRefreshCallback: ReturnType<typeof vi.fn>;
  let mockCreateTerminalFrameWriter: ReturnType<typeof vi.fn>;
  let MockFileWatcher: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();

    const dashboardMod = await import("../../src/watch/dashboard.js");
    mockCreateRefreshCallback = vi.mocked(dashboardMod.createRefreshCallback);
    const frameWriterMod = await import("../../src/watch/frame-writer.js");
    mockCreateTerminalFrameWriter = vi.mocked(frameWriterMod.createTerminalFrameWriter);

    const fwMod = await import("../../src/watch/file-watcher.js");
    MockFileWatcher = vi.mocked(fwMod.FileWatcher);

    mockCreateRefreshCallback.mockReturnValue(vi.fn());
  });

  it("creates file watcher with the given interval", async () => {
    const ralph = createMockRalphProcess();

    const { startRunDashboard } = await import("../../src/run/run-dashboard.js");
    // Start dashboard, it will block until resolved
    const promise = startRunDashboard({ projectDir: "/project", interval: 3000, ralph });

    // Trigger exit and resolve
    triggerExit(ralph, 0);
    await resolveViaTick(promise);

    expect(MockFileWatcher).toHaveBeenCalledWith(expect.any(Function), 3000);
  });

  it("starts the file watcher", async () => {
    const ralph = createMockRalphProcess();

    const { startRunDashboard } = await import("../../src/run/run-dashboard.js");
    const promise = startRunDashboard({ projectDir: "/project", interval: 2000, ralph });

    triggerExit(ralph, 0);
    await resolveViaTick(promise);

    const instance = MockFileWatcher.mock.instances[0] as { start: ReturnType<typeof vi.fn> };
    expect(instance.start).toHaveBeenCalled();
  });

  it("creates a terminal frame writer for cursor control", async () => {
    const ralph = createMockRalphProcess();

    const { startRunDashboard } = await import("../../src/run/run-dashboard.js");
    const promise = startRunDashboard({ projectDir: "/project", interval: 2000, ralph });

    triggerExit(ralph, 0);
    await resolveViaTick(promise);

    expect(mockCreateTerminalFrameWriter).toHaveBeenCalled();
  });

  it("registers an exit callback on ralph", async () => {
    const ralph = createMockRalphProcess();

    const { startRunDashboard } = await import("../../src/run/run-dashboard.js");
    const promise = startRunDashboard({ projectDir: "/project", interval: 2000, ralph });

    expect(ralph.onExit).toHaveBeenCalled();

    triggerExit(ralph, 0);
    await resolveViaTick(promise);
  });

  it("passes a custom footer renderer to the dashboard refresh callback", async () => {
    const ralph = createMockRalphProcess();

    const { startRunDashboard } = await import("../../src/run/run-dashboard.js");
    const promise = startRunDashboard({ projectDir: "/project", interval: 2000, ralph });

    expect(mockCreateRefreshCallback).toHaveBeenCalledWith(
      "/project",
      expect.any(Function),
      expect.objectContaining({
        footerRenderer: expect.any(Function),
      })
    );

    const options = mockCreateRefreshCallback.mock.calls[0]![2] as {
      footerRenderer: (lastUpdated: Date, cols: number) => string;
    };
    expect(options).not.toHaveProperty("decorateFrame");
    expect(options.footerRenderer(new Date("2026-02-25T14:25:15Z"), 80)).toContain(
      "Ralph: running"
    );
    expect(options.footerRenderer(new Date("2026-02-25T14:25:15Z"), 80)).toContain("Updated:");

    triggerExit(ralph, 0);
    await resolveViaTick(promise);
  });

  it("does not refresh or rerun cleanup after signal stop when Ralph exits later", async () => {
    const refresh = vi.fn();
    const cleanup = vi.fn();
    mockCreateRefreshCallback.mockReturnValue(refresh);
    mockCreateTerminalFrameWriter.mockReturnValue({
      cleanup,
      write: vi.fn(),
    });

    const ralph = createMockRalphProcess();
    const stdinIsTTY = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
    Object.defineProperty(process.stdin, "isTTY", {
      configurable: true,
      value: false,
    });

    const processOnSpy = vi.spyOn(process, "on");

    try {
      const { startRunDashboard } = await import("../../src/run/run-dashboard.js");
      const promise = startRunDashboard({ projectDir: "/project", interval: 2000, ralph });

      const sigintHandler = getRegisteredProcessHandler(processOnSpy, "SIGINT");
      sigintHandler();

      await resolveViaTick(promise);

      triggerExit(ralph, 0);
      await new Promise((resolve) => setTimeout(resolve, 0));

      const watcher = MockFileWatcher.mock.instances[0] as { stop: ReturnType<typeof vi.fn> };
      expect(refresh).not.toHaveBeenCalled();
      expect(cleanup).toHaveBeenCalledTimes(1);
      expect(watcher.stop).toHaveBeenCalledTimes(1);
    } finally {
      restoreProperty(process.stdin, "isTTY", stdinIsTTY);
    }
  });
});

// --- helpers ---

interface MockRalphProcess extends RalphProcess {
  _exitCallbacks: Array<(code: number | null) => void>;
}

function createMockRalphProcess(): MockRalphProcess {
  const exitCallbacks: Array<(code: number | null) => void> = [];
  return {
    child: { pid: 12345 } as RalphProcess["child"],
    state: "running",
    exitCode: null,
    kill: vi.fn(),
    detach: vi.fn(),
    onExit: vi.fn((cb) => exitCallbacks.push(cb)),
    _exitCallbacks: exitCallbacks,
  };
}

function triggerExit(ralph: MockRalphProcess, code: number | null): void {
  ralph.state = "stopped";
  ralph.exitCode = code;
  for (const cb of ralph._exitCallbacks) cb(code);
}

async function resolveViaTick(promise: Promise<unknown>): Promise<void> {
  // Allow any pending microtasks/timers to resolve
  await new Promise((r) => setTimeout(r, 50));
  // Track whether the promise actually resolves (not just the timeout winning)
  let resolved = false;
  await Promise.race([
    promise.then(() => {
      resolved = true;
    }),
    new Promise((r) => setTimeout(r, 100)),
  ]);
  expect(resolved).toBe(true);
}

function getRegisteredProcessHandler(
  processOnSpy: ReturnType<typeof vi.spyOn>,
  event: "SIGINT" | "SIGTERM"
): () => void {
  const registration = processOnSpy.mock.calls.find(
    ([registeredEvent]) => registeredEvent === event
  );
  expect(registration).toBeDefined();
  return registration![1] as () => void;
}

function restoreProperty<T extends object, K extends keyof T>(
  target: T,
  key: K,
  descriptor: PropertyDescriptor | undefined
): void {
  if (descriptor) {
    Object.defineProperty(target, key, descriptor);
    return;
  }

  delete target[key];
}
