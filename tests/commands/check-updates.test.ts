import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from "vitest";

vi.mock("chalk");

vi.mock("../../src/installer.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/installer.js")>();
  return {
    ...actual,
    getBundledVersions: vi.fn(() => ({
      bmadCommit: "48881f86",
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

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    process.exitCode = undefined;
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
      errors: [],
    };
    vi.mocked(checkUpstream).mockResolvedValue(mockResult);

    await checkUpdatesCommand({});

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("BMAD-METHOD");
    expect(output).toContain("up to date");
    expect(output).toContain("Up to date");
    expect(process.exitCode).toBeUndefined();
  });

  it("shows commits behind with compare URL", async () => {
    const mockResult: CheckUpstreamResult = {
      bmad: {
        bundledSha: "48881f86",
        latestSha: "abc12345",
        isUpToDate: false,
        compareUrl: "https://github.com/bmad-code-org/BMAD-METHOD/compare/48881f86...abc12345",
      },
      errors: [],
    };
    vi.mocked(checkUpstream).mockResolvedValue(mockResult);

    await checkUpdatesCommand({});

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("BMAD-METHOD");
    expect(output).toContain("updates available");
    expect(output).toContain("48881f86");
    expect(output).toContain("abc12345");
    expect(output).toContain(
      "https://github.com/bmad-code-org/BMAD-METHOD/compare/48881f86...abc12345"
    );
    expect(output).toContain("Updates available");
  });

  it("outputs JSON when --json flag provided", async () => {
    const mockResult: CheckUpstreamResult = {
      bmad: {
        bundledSha: "48881f86",
        latestSha: "abc12345",
        isUpToDate: false,
        compareUrl: "https://github.com/bmad-code-org/BMAD-METHOD/compare/48881f86...abc12345",
      },
      errors: [],
    };
    vi.mocked(checkUpstream).mockResolvedValue(mockResult);

    await checkUpdatesCommand({ json: true });

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("bmad");
    expect(parsed).not.toHaveProperty("ralph");
    expect(parsed).toHaveProperty("errors");
    expect(parsed).toHaveProperty("hasUpdates");
    expect(parsed.hasUpdates).toBe(true);
    expect(parsed.bmad.isUpToDate).toBe(false);
  });

  it("handles offline gracefully", async () => {
    const mockResult: CheckUpstreamResult = {
      bmad: null,
      errors: [{ type: "network", message: "Network error: fetch failed", repo: "bmad" }],
    };
    vi.mocked(checkUpstream).mockResolvedValue(mockResult);

    await checkUpdatesCommand({});

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Could not check");
    expect(output).toContain("network");
    expect(process.exitCode).toBeUndefined();
  });

  it("handles rate limit gracefully", async () => {
    const mockResult: CheckUpstreamResult = {
      bmad: null,
      errors: [{ type: "rate-limit", message: "Rate limited", repo: "bmad" }],
    };
    vi.mocked(checkUpstream).mockResolvedValue(mockResult);

    await checkUpdatesCommand({});

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Could not check");
    expect(output).toContain("rate");
    expect(process.exitCode).toBeUndefined();
  });

  it("outputs JSON with errors when fetch fails", async () => {
    const mockResult: CheckUpstreamResult = {
      bmad: null,
      errors: [{ type: "network", message: "Network error", repo: "bmad" }],
    };
    vi.mocked(checkUpstream).mockResolvedValue(mockResult);

    await checkUpdatesCommand({ json: true });

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    const parsed = JSON.parse(output);
    expect(parsed.bmad).toBeNull();
    expect(parsed.errors).toHaveLength(1);
    expect(parsed.hasUpdates).toBe(false);
  });

  it("handles getBundledVersions() error gracefully", async () => {
    const { getBundledVersions } = await import("../../src/installer.js");
    vi.mocked(getBundledVersions).mockImplementation(() => {
      throw new Error("Failed to read bundled-versions.json at /path/to/file: ENOENT");
    });

    await checkUpdatesCommand({});

    const errorOutput = vi
      .mocked(console.error)
      .mock.calls.map((c) => c[0])
      .join("\n");
    expect(errorOutput).toContain("Failed to read bundled-versions.json");
    expect(process.exitCode).toBe(1);
  });
});
