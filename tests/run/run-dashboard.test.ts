import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RalphProcess } from "../../src/run/types.js";

vi.mock("../../src/watch/dashboard.js", () => ({
  createRefreshCallback: vi.fn(),
  setupTerminal: vi.fn(),
}));

vi.mock("../../src/watch/file-watcher.js", () => ({
  FileWatcher: vi.fn(function (this: { start: () => void; stop: () => void }) {
    this.start = vi.fn();
    this.stop = vi.fn();
  }),
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

  it("shows stopped state with exit code 0", async () => {
    const { renderStatusBar } = await import("../../src/run/run-dashboard.js");
    const ralph = { state: "stopped", exitCode: 0, child: { pid: 12345 } } as RalphProcess;

    const result = renderStatusBar(ralph);

    expect(result).toContain("stopped");
    expect(result).toContain("exit 0");
    expect(result).toContain("q");
  });

  it("shows stopped state with non-zero exit code", async () => {
    const { renderStatusBar } = await import("../../src/run/run-dashboard.js");
    const ralph = { state: "stopped", exitCode: 1, child: { pid: 12345 } } as RalphProcess;

    const result = renderStatusBar(ralph);

    expect(result).toContain("stopped");
    expect(result).toContain("exit 1");
  });

  it("shows detached state", async () => {
    const { renderStatusBar } = await import("../../src/run/run-dashboard.js");
    const ralph = { state: "detached", exitCode: null, child: { pid: 12345 } } as RalphProcess;

    const result = renderStatusBar(ralph);

    expect(result).toContain("detached");
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
  let mockSetupTerminal: ReturnType<typeof vi.fn>;
  let mockCreateRefreshCallback: ReturnType<typeof vi.fn>;
  let MockFileWatcher: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();

    const dashboardMod = await import("../../src/watch/dashboard.js");
    mockSetupTerminal = vi.mocked(dashboardMod.setupTerminal);
    mockCreateRefreshCallback = vi.mocked(dashboardMod.createRefreshCallback);

    const fwMod = await import("../../src/watch/file-watcher.js");
    MockFileWatcher = vi.mocked(fwMod.FileWatcher);

    mockSetupTerminal.mockReturnValue(vi.fn());
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

  it("calls setupTerminal for cursor control", async () => {
    const ralph = createMockRalphProcess();

    const { startRunDashboard } = await import("../../src/run/run-dashboard.js");
    const promise = startRunDashboard({ projectDir: "/project", interval: 2000, ralph });

    triggerExit(ralph, 0);
    await resolveViaTick(promise);

    expect(mockSetupTerminal).toHaveBeenCalled();
  });

  it("registers an exit callback on ralph", async () => {
    const ralph = createMockRalphProcess();

    const { startRunDashboard } = await import("../../src/run/run-dashboard.js");
    const promise = startRunDashboard({ projectDir: "/project", interval: 2000, ralph });

    expect(ralph.onExit).toHaveBeenCalled();

    triggerExit(ralph, 0);
    await resolveViaTick(promise);
  });

  it("wraps the refresh callback to include a write interceptor", async () => {
    const ralph = createMockRalphProcess();

    const { startRunDashboard } = await import("../../src/run/run-dashboard.js");
    const promise = startRunDashboard({ projectDir: "/project", interval: 2000, ralph });

    // createRefreshCallback should receive a wrapped write function
    expect(mockCreateRefreshCallback).toHaveBeenCalledWith("/project", expect.any(Function));

    triggerExit(ralph, 0);
    await resolveViaTick(promise);
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
  // The promise may or may not have resolved depending on stdin handling
  // For unit tests with mocked stdin, we race with a timeout
  await Promise.race([promise, new Promise((r) => setTimeout(r, 100))]);
}
