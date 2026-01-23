import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("chalk", () => ({
  default: {
    red: (s: string) => s,
    green: (s: string) => s,
    blue: (s: string) => s,
    yellow: (s: string) => s,
    bold: (s: string) => s,
    dim: (s: string) => s,
    cyan: (s: string) => s,
    white: (s: string) => s,
    gray: (s: string) => s,
  },
}));

describe("guide command", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it("displays all 4 phases", async () => {
    const { guideCommand } = await import("../../src/commands/guide.js");
    guideCommand();

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Phase 1");
    expect(output).toContain("Analysis");
    expect(output).toContain("Phase 2");
    expect(output).toContain("Planning");
    expect(output).toContain("Phase 3");
    expect(output).toContain("Design");
    expect(output).toContain("Phase 4");
    expect(output).toContain("Implementation");
  });

  it("shows BMAD and Ralph sections", async () => {
    const { guideCommand } = await import("../../src/commands/guide.js");
    guideCommand();

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("BMAD");
    expect(output).toContain("Ralph");
  });

  it("shows available commands", async () => {
    const { guideCommand } = await import("../../src/commands/guide.js");
    guideCommand();

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("bmalph start");
    expect(output).toContain("bmalph status");
    expect(output).toContain("bmalph resume");
    expect(output).toContain("/bmalph");
  });
});
