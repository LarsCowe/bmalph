import { describe, it, expect, vi } from "vitest";
import { join } from "path";

const { mockReadFile } = vi.hoisted(() => ({
  mockReadFile: vi.fn(),
}));

vi.mock("fs/promises", async () => {
  const actual = await vi.importActual<typeof import("fs/promises")>("fs/promises");
  return { ...actual, readFile: mockReadFile };
});

vi.mock("../../src/utils/file-system.js", async () => {
  const actual = await vi.importActual<typeof import("../../src/utils/file-system.js")>(
    "../../src/utils/file-system.js"
  );
  return {
    ...actual,
    getFilesRecursive: vi.fn(async () => ["shared.md"]),
  };
});

import { generateSpecsChangelog } from "../../src/transition/specs-changelog.js";

describe("specs-changelog error handling", () => {
  it("does not crash when new spec file is unreadable", async () => {
    const oldDir = "/fake/old";
    const newDir = "/fake/new";

    mockReadFile.mockImplementation(async (path: string) => {
      if (path === join(oldDir, "shared.md")) {
        return "old content";
      }
      if (path === join(newDir, "shared.md")) {
        const err = new Error("EACCES: permission denied") as NodeJS.ErrnoException;
        err.code = "EACCES";
        throw err;
      }
      return "";
    });

    const changes = await generateSpecsChangelog(oldDir, newDir);

    // Should not crash — treat unreadable new file as empty, producing a "modified" entry
    expect(changes).toBeDefined();
    expect(changes).toEqual([expect.objectContaining({ file: "shared.md", status: "modified" })]);
  });
});
