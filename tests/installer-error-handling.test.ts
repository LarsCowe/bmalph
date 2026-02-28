import { describe, it, expect, vi, beforeEach } from "vitest";

const mockReadFile = vi.fn();
vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...actual,
    readFile: mockReadFile,
  };
});

const mockDebug = vi.fn();
vi.mock("../src/utils/logger.js", () => ({
  debug: mockDebug,
  warn: vi.fn(),
}));

describe("getPackageVersion error discrimination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns unknown and logs debug for non-ENOENT errors", async () => {
    const permissionError = Object.assign(new Error("EACCES: permission denied"), {
      code: "EACCES",
    });
    mockReadFile.mockRejectedValue(permissionError);

    const { getPackageVersion } = await import("../src/installer.js");
    const version = await getPackageVersion();

    expect(version).toBe("unknown");
    expect(mockDebug).toHaveBeenCalledWith(expect.stringContaining("EACCES"));
  });

  it("does not log debug for ENOENT errors", async () => {
    const notFoundError = Object.assign(new Error("ENOENT: no such file"), { code: "ENOENT" });
    mockReadFile.mockRejectedValue(notFoundError);

    const { getPackageVersion } = await import("../src/installer.js");
    const version = await getPackageVersion();

    expect(version).toBe("unknown");
    expect(mockDebug).not.toHaveBeenCalled();
  });
});
