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

vi.mock("../../src/utils/state.js", () => ({
  readPhaseState: vi.fn(),
  getPhaseLabel: vi.fn((phase: number) => {
    const labels: Record<number, string> = {
      1: "Analysis",
      2: "Planning",
      3: "Design",
      4: "Implementation",
    };
    return labels[phase] ?? "Unknown";
  }),
  getPhaseInfo: vi.fn((phase: number) => {
    const info: Record<number, { name: string; agent: string; goal: string; outputs: string[] }> = {
      1: { name: "Analysis", agent: "Mary (Analyst)", goal: "Gather requirements, constraints, and risks", outputs: ["requirements.md", "constraints.md", "research.md", "risks.md"] },
      2: { name: "Planning", agent: "Larry (PM)", goal: "Create PRD, user stories, and MVP scope", outputs: ["prd.md", "stories.md", "mvp-scope.md"] },
      3: { name: "Design", agent: "Mo (Architect)", goal: "Define architecture, data model, and conventions", outputs: ["architecture.md", "data-model.md", "conventions.md"] },
      4: { name: "Implementation", agent: "Ralph (Developer)", goal: "TDD build, code review, and validation", outputs: ["code", "tests", "documentation"] },
    };
    return info[phase] ?? { name: "Unknown", agent: "Unknown", goal: "Unknown", outputs: [] };
  }),
}));

describe("resume command", () => {
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

    const { resumeCommand } = await import("../../src/commands/resume.js");
    await expect(resumeCommand()).rejects.toThrow("process.exit(1)");
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("not initialized")
    );
  });

  it("exits when no state found", async () => {
    const { isInitialized } = await import("../../src/installer.js");
    const { readPhaseState } = await import("../../src/utils/state.js");

    vi.mocked(isInitialized).mockResolvedValue(true);
    vi.mocked(readPhaseState).mockResolvedValue(null);

    const { resumeCommand } = await import("../../src/commands/resume.js");
    await expect(resumeCommand()).rejects.toThrow("process.exit(1)");
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("No state found")
    );
  });

  it("returns when already completed", async () => {
    const { isInitialized } = await import("../../src/installer.js");
    const { readPhaseState } = await import("../../src/utils/state.js");
    const { spawn } = await import("child_process");

    vi.mocked(isInitialized).mockResolvedValue(true);
    vi.mocked(readPhaseState).mockResolvedValue({
      currentPhase: 4,
      iteration: 10,
      status: "completed",
      startedAt: "2025-01-01T00:00:00.000Z",
      lastUpdated: "2025-01-01T02:00:00.000Z",
    });

    const { resumeCommand } = await import("../../src/commands/resume.js");
    await resumeCommand();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("All phases completed")
    );
    expect(spawn).not.toHaveBeenCalled();
  });

  it("spawns loop from saved phase", async () => {
    const { isInitialized } = await import("../../src/installer.js");
    const { readPhaseState } = await import("../../src/utils/state.js");
    const { spawn } = await import("child_process");

    vi.mocked(isInitialized).mockResolvedValue(true);
    vi.mocked(readPhaseState).mockResolvedValue({
      currentPhase: 2,
      iteration: 3,
      status: "running",
      startedAt: "2025-01-01T00:00:00.000Z",
      lastUpdated: "2025-01-01T01:00:00.000Z",
    });

    const fakeChild = new EventEmitter();
    vi.mocked(spawn).mockReturnValue(fakeChild as never);

    const { resumeCommand } = await import("../../src/commands/resume.js");
    await resumeCommand();

    expect(spawn).toHaveBeenCalledWith(
      "bash",
      [expect.stringContaining("bmalph.sh"), "2"],
      expect.objectContaining({ stdio: "inherit" })
    );
  });

  it("shows phase info before spawning", async () => {
    const { isInitialized } = await import("../../src/installer.js");
    const { readPhaseState } = await import("../../src/utils/state.js");
    const { spawn } = await import("child_process");

    vi.mocked(isInitialized).mockResolvedValue(true);
    vi.mocked(readPhaseState).mockResolvedValue({
      currentPhase: 3,
      iteration: 1,
      status: "running",
      startedAt: "2025-01-01T00:00:00.000Z",
      lastUpdated: "2025-01-01T01:00:00.000Z",
    });

    const fakeChild = new EventEmitter();
    vi.mocked(spawn).mockReturnValue(fakeChild as never);

    const { resumeCommand } = await import("../../src/commands/resume.js");
    await resumeCommand();

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Phase 3");
    expect(output).toContain("Design");
    expect(output).toContain("Mo (Architect)");
    expect(output).toContain("architecture");
  });
});
