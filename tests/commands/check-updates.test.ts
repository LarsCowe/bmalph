import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from "vitest";

vi.mock("chalk", () => ({
  default: {
    red: (s: string) => s,
    green: (s: string) => s,
    yellow: (s: string) => s,
    blue: (s: string) => s,
    cyan: (s: string) => s,
    dim: (s: string) => s,
    bold: (s: string) => s,
  },
}));

vi.mock("../../src/installer.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/installer.js")>();
  return {
    ...actual,
    getBundledVersions: vi.fn(() => ({
      bmadCommit: "48881f86",
      ralphCommit: "019b8c73",
    })),
  };
});

vi.mock("../../src/utils/github.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/utils/github.js")>();
  return {
    ...actual,
    checkUpstream: vi.fn(),
    clearCache: vi.fn(),
  };
});

import { checkUpdatesCommand } from "../../src/commands/check-updates.js";
import { checkUpstream } from "../../src/utils/github.js";
import type { CheckUpstreamResult } from "../../src/utils/github.js";

describe("check-updates command", () => {
  let consoleSpy: MockInstance;
  let exitSpy: MockInstance;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows up-to-date when bundled matches upstream", async () => {
    const mockResult: CheckUpstreamResult = {
      bmad: {
        bundledSha: "48881f86",
        latestSha: "48881f86",
        isUpToDate: true,
        compareUrl: "https://github.com/bmad-code-org/BMAD-METHOD/compare/48881f86...48881f86",
      },
      ralph: {
        bundledSha: "019b8c73",
        latestSha: "019b8c73",
        isUpToDate: true,
        compareUrl: "https://github.com/snarktank/ralph/compare/019b8c73...019b8c73",
      },
      errors: [],
    };
    vi.mocked(checkUpstream).mockResolvedValue(mockResult);

    await checkUpdatesCommand({});

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("BMAD-METHOD");
    expect(output).toContain("up to date");
    expect(output).toContain("Ralph");
    expect(output).toContain("All repositories are up to date");
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("shows commits behind with compare URL", async () => {
    const mockResult: CheckUpstreamResult = {
      bmad: {
        bundledSha: "48881f86",
        latestSha: "48881f86",
        isUpToDate: true,
        compareUrl: "https://github.com/bmad-code-org/BMAD-METHOD/compare/48881f86...48881f86",
      },
      ralph: {
        bundledSha: "019b8c73",
        latestSha: "abc12345",
        isUpToDate: false,
        compareUrl: "https://github.com/snarktank/ralph/compare/019b8c73...abc12345",
      },
      errors: [],
    };
    vi.mocked(checkUpstream).mockResolvedValue(mockResult);

    await checkUpdatesCommand({});

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Ralph");
    expect(output).toContain("updates available");
    expect(output).toContain("019b8c73");
    expect(output).toContain("abc12345");
    expect(output).toContain("https://github.com/snarktank/ralph/compare/019b8c73...abc12345");
    expect(output).toContain("1 repository has updates available");
  });

  it("outputs JSON when --json flag provided", async () => {
    const mockResult: CheckUpstreamResult = {
      bmad: {
        bundledSha: "48881f86",
        latestSha: "48881f86",
        isUpToDate: true,
        compareUrl: "https://github.com/bmad-code-org/BMAD-METHOD/compare/48881f86...48881f86",
      },
      ralph: {
        bundledSha: "019b8c73",
        latestSha: "abc12345",
        isUpToDate: false,
        compareUrl: "https://github.com/snarktank/ralph/compare/019b8c73...abc12345",
      },
      errors: [],
    };
    vi.mocked(checkUpstream).mockResolvedValue(mockResult);

    await checkUpdatesCommand({ json: true });

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("bmad");
    expect(parsed).toHaveProperty("ralph");
    expect(parsed).toHaveProperty("errors");
    expect(parsed).toHaveProperty("hasUpdates");
    expect(parsed.hasUpdates).toBe(true);
    expect(parsed.bmad.isUpToDate).toBe(true);
    expect(parsed.ralph.isUpToDate).toBe(false);
  });

  it("handles offline gracefully", async () => {
    const mockResult: CheckUpstreamResult = {
      bmad: null,
      ralph: null,
      errors: [
        { type: "network", message: "Network error: fetch failed", repo: "bmad" },
        { type: "network", message: "Network error: fetch failed", repo: "ralph" },
      ],
    };
    vi.mocked(checkUpstream).mockResolvedValue(mockResult);

    await checkUpdatesCommand({});

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Could not check");
    expect(output).toContain("network");
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("handles rate limit gracefully", async () => {
    const mockResult: CheckUpstreamResult = {
      bmad: null,
      ralph: null,
      errors: [
        { type: "rate-limit", message: "Rate limited", repo: "bmad" },
        { type: "rate-limit", message: "Rate limited", repo: "ralph" },
      ],
    };
    vi.mocked(checkUpstream).mockResolvedValue(mockResult);

    await checkUpdatesCommand({});

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Could not check");
    expect(output).toContain("rate");
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("outputs JSON with errors when both repos fail", async () => {
    const mockResult: CheckUpstreamResult = {
      bmad: null,
      ralph: null,
      errors: [
        { type: "network", message: "Network error", repo: "bmad" },
        { type: "network", message: "Network error", repo: "ralph" },
      ],
    };
    vi.mocked(checkUpstream).mockResolvedValue(mockResult);

    await checkUpdatesCommand({ json: true });

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    const parsed = JSON.parse(output);
    expect(parsed.bmad).toBeNull();
    expect(parsed.ralph).toBeNull();
    expect(parsed.errors).toHaveLength(2);
    expect(parsed.hasUpdates).toBe(false);
  });

  it("handles partial failure gracefully", async () => {
    const mockResult: CheckUpstreamResult = {
      bmad: {
        bundledSha: "48881f86",
        latestSha: "48881f86",
        isUpToDate: true,
        compareUrl: "https://github.com/bmad-code-org/BMAD-METHOD/compare/48881f86...48881f86",
      },
      ralph: null,
      errors: [{ type: "network", message: "Network error", repo: "ralph" }],
    };
    vi.mocked(checkUpstream).mockResolvedValue(mockResult);

    await checkUpdatesCommand({});

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("BMAD-METHOD");
    expect(output).toContain("up to date");
    expect(output).toContain("Could not check");
    expect(output).toContain("Ralph");
  });

  it("shows both repos have updates when behind", async () => {
    const mockResult: CheckUpstreamResult = {
      bmad: {
        bundledSha: "48881f86",
        latestSha: "newbmad1",
        isUpToDate: false,
        compareUrl: "https://github.com/bmad-code-org/BMAD-METHOD/compare/48881f86...newbmad1",
      },
      ralph: {
        bundledSha: "019b8c73",
        latestSha: "newralph",
        isUpToDate: false,
        compareUrl: "https://github.com/snarktank/ralph/compare/019b8c73...newralph",
      },
      errors: [],
    };
    vi.mocked(checkUpstream).mockResolvedValue(mockResult);

    await checkUpdatesCommand({});

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("2 repositories have updates available");
  });
});
