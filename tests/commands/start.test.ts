import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EventEmitter } from "events";

vi.mock("chalk", () => ({
  default: {
    red: (s: string) => s,
    green: (s: string) => s,
    blue: (s: string) => s,
    yellow: (s: string) => s,
    bold: (s: string) => s,
    dim: (s: string) => s,
    cyan: (s: string) => s,
  },
}));

vi.mock("child_process", () => ({
  spawn: vi.fn(),
}));

vi.mock("../../src/installer.js", () => ({
  isInitialized: vi.fn(),
}));

vi.mock("../../src/utils/config.js", () => ({
  readConfig: vi.fn(),
}));

vi.mock("../../src/utils/state.js", () => ({
  writePhaseState: vi.fn(),
}));

describe("start command", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`process.exit(${code})`);
    }) as never);
    vi.resetModules();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    exitSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it("exits when not initialized", async () => {
    const { isInitialized } = await import("../../src/installer.js");
    vi.mocked(isInitialized).mockResolvedValue(false);

    const { startCommand } = await import("../../src/commands/start.js");
    await expect(startCommand({})).rejects.toThrow("process.exit(1)");
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("not initialized")
    );
  });

  it("exits when config unreadable", async () => {
    const { isInitialized } = await import("../../src/installer.js");
    const { readConfig } = await import("../../src/utils/config.js");

    vi.mocked(isInitialized).mockResolvedValue(true);
    vi.mocked(readConfig).mockResolvedValue(null);

    const { startCommand } = await import("../../src/commands/start.js");
    await expect(startCommand({})).rejects.toThrow("process.exit(1)");
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Could not read config")
    );
  });

  it("exits on invalid phase 0", async () => {
    const { isInitialized } = await import("../../src/installer.js");
    const { readConfig } = await import("../../src/utils/config.js");

    vi.mocked(isInitialized).mockResolvedValue(true);
    vi.mocked(readConfig).mockResolvedValue({
      name: "test",
      description: "",
      level: 2,
      createdAt: "2025-01-01T00:00:00.000Z",
    });

    const { startCommand } = await import("../../src/commands/start.js");
    await expect(startCommand({ phase: "0" })).rejects.toThrow("process.exit(1)");
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Phase must be between 1 and 4")
    );
  });

  it("exits on invalid phase 5", async () => {
    const { isInitialized } = await import("../../src/installer.js");
    const { readConfig } = await import("../../src/utils/config.js");

    vi.mocked(isInitialized).mockResolvedValue(true);
    vi.mocked(readConfig).mockResolvedValue({
      name: "test",
      description: "",
      level: 2,
      createdAt: "2025-01-01T00:00:00.000Z",
    });

    const { startCommand } = await import("../../src/commands/start.js");
    await expect(startCommand({ phase: "5" })).rejects.toThrow("process.exit(1)");
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Phase must be between 1 and 4")
    );
  });

  it("writes state and spawns loop at default phase 1", async () => {
    const { isInitialized } = await import("../../src/installer.js");
    const { readConfig } = await import("../../src/utils/config.js");
    const { writePhaseState } = await import("../../src/utils/state.js");
    const { spawn } = await import("child_process");

    vi.mocked(isInitialized).mockResolvedValue(true);
    vi.mocked(readConfig).mockResolvedValue({
      name: "test",
      description: "",
      level: 2,
      createdAt: "2025-01-01T00:00:00.000Z",
    });
    vi.mocked(writePhaseState).mockResolvedValue(undefined);

    const fakeChild = new EventEmitter();
    vi.mocked(spawn).mockReturnValue(fakeChild as never);

    const { startCommand } = await import("../../src/commands/start.js");
    await startCommand({});

    expect(writePhaseState).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ currentPhase: 1, status: "running" })
    );
    expect(spawn).toHaveBeenCalledWith(
      "bash",
      [expect.stringContaining("bmalph.sh"), "1"],
      expect.objectContaining({ stdio: "inherit" })
    );
  });

  it("starts from specified phase", async () => {
    const { isInitialized } = await import("../../src/installer.js");
    const { readConfig } = await import("../../src/utils/config.js");
    const { writePhaseState } = await import("../../src/utils/state.js");
    const { spawn } = await import("child_process");

    vi.mocked(isInitialized).mockResolvedValue(true);
    vi.mocked(readConfig).mockResolvedValue({
      name: "test",
      description: "",
      level: 2,
      createdAt: "2025-01-01T00:00:00.000Z",
    });
    vi.mocked(writePhaseState).mockResolvedValue(undefined);

    const fakeChild = new EventEmitter();
    vi.mocked(spawn).mockReturnValue(fakeChild as never);

    const { startCommand } = await import("../../src/commands/start.js");
    await startCommand({ phase: "3" });

    expect(writePhaseState).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ currentPhase: 3 })
    );
    expect(spawn).toHaveBeenCalledWith(
      "bash",
      [expect.stringContaining("bmalph.sh"), "3"],
      expect.objectContaining({ stdio: "inherit" })
    );
  });
});
