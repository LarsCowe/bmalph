import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
}));

vi.mock("../../src/utils/config.js", () => ({
  readConfig: vi.fn(),
}));

vi.mock("../../src/utils/file-system.js", () => ({
  parseGitignoreLines: vi.fn(
    (content: string) =>
      new Set(
        content
          .split(/\r?\n/)
          .map((line: string) => line.trim())
          .filter(Boolean)
      )
  ),
}));

vi.mock("../../src/installer.js", () => ({
  getPackageVersion: vi.fn(() => Promise.resolve("1.5.0")),
  getBundledVersions: vi.fn(() =>
    Promise.resolve({
      bmadCommit: "abc12345def67890abc12345def67890abc12345",
    })
  ),
}));

vi.mock("../../src/utils/errors.js", () => ({
  isEnoent: vi.fn(
    (err: unknown) =>
      err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT"
  ),
  formatError: vi.fn((err: unknown) => (err instanceof Error ? err.message : String(err))),
}));

import { readFile } from "node:fs/promises";
import { readConfig } from "../../src/utils/config.js";
import { getPackageVersion, getBundledVersions } from "../../src/installer.js";
import {
  checkGitignore,
  checkVersionMarker,
  checkUpstreamVersions,
} from "../../src/commands/doctor-health-checks.js";

const mockReadFile = vi.mocked(readFile);
const mockReadConfig = vi.mocked(readConfig);
const mockGetPackageVersion = vi.mocked(getPackageVersion);
const mockGetBundledVersions = vi.mocked(getBundledVersions);

function enoentError(): NodeJS.ErrnoException {
  const err = new Error("ENOENT: no such file or directory") as NodeJS.ErrnoException;
  err.code = "ENOENT";
  return err;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetPackageVersion.mockReturnValue(Promise.resolve("1.5.0") as unknown as string);
  mockGetBundledVersions.mockReturnValue(
    Promise.resolve({
      bmadCommit: "abc12345def67890abc12345def67890abc12345",
    }) as unknown as ReturnType<typeof getBundledVersions>
  );
});

describe("checkGitignore", () => {
  it("passes when .gitignore contains all required entries", async () => {
    mockReadFile.mockResolvedValue("node_modules/\n.ralph/logs/\n_bmad-output/\n.swarm/\ndist/\n");

    const result = await checkGitignore("/projects/webapp");

    expect(result.passed).toBe(true);
  });

  it("fails when .ralph/logs/ is missing from .gitignore", async () => {
    mockReadFile.mockResolvedValue("node_modules/\n_bmad-output/\n");

    const result = await checkGitignore("/projects/webapp");

    expect(result.passed).toBe(false);
  });

  it("reports which entries are missing", async () => {
    mockReadFile.mockResolvedValue("node_modules/\ndist/\n");

    const result = await checkGitignore("/projects/webapp");

    expect(result.detail).toContain(".ralph/logs/");
  });

  it("includes a hint to add missing entries", async () => {
    mockReadFile.mockResolvedValue("node_modules/\ndist/\n");

    const result = await checkGitignore("/projects/webapp");

    expect(result.hint).toContain("Add to .gitignore");
  });

  it("fails when .gitignore file does not exist", async () => {
    mockReadFile.mockRejectedValue(enoentError());

    const result = await checkGitignore("/projects/webapp");

    expect(result.passed).toBe(false);
  });

  it("reports '.gitignore not found' when file is missing", async () => {
    mockReadFile.mockRejectedValue(enoentError());

    const result = await checkGitignore("/projects/webapp");

    expect(result.detail).toBe(".gitignore not found");
  });

  it("provides create hint when .gitignore is missing", async () => {
    mockReadFile.mockRejectedValue(enoentError());

    const result = await checkGitignore("/projects/webapp");

    expect(result.hint).toContain("Create .gitignore");
  });

  it("handles permission errors gracefully", async () => {
    const err = new Error("EACCES: permission denied") as NodeJS.ErrnoException;
    err.code = "EACCES";
    mockReadFile.mockRejectedValue(err);

    const result = await checkGitignore("/projects/webapp");

    expect(result.detail).toContain("error:");
  });

  it("fails when _bmad-output/ is missing from .gitignore", async () => {
    mockReadFile.mockResolvedValue(".ralph/logs/\nnode_modules/\n");

    const result = await checkGitignore("/projects/webapp");

    expect(result.detail).toContain("_bmad-output/");
  });
});

describe("checkVersionMarker", () => {
  it("passes when version marker matches current package version", async () => {
    mockReadFile.mockResolvedValue("#!/bin/bash\n# bmalph-version: 1.5.0\nset -euo pipefail\n");

    const result = await checkVersionMarker("/projects/webapp");

    expect(result.passed).toBe(true);
  });

  it("shows current version in detail when marker matches", async () => {
    mockReadFile.mockResolvedValue("#!/bin/bash\n# bmalph-version: 1.5.0\nset -euo pipefail\n");

    const result = await checkVersionMarker("/projects/webapp");

    expect(result.detail).toBe("v1.5.0");
  });

  it("fails when version marker does not match current version", async () => {
    mockReadFile.mockResolvedValue("#!/bin/bash\n# bmalph-version: 1.2.0\nset -euo pipefail\n");

    const result = await checkVersionMarker("/projects/webapp");

    expect(result.passed).toBe(false);
  });

  it("shows installed vs current version in detail on mismatch", async () => {
    mockReadFile.mockResolvedValue("#!/bin/bash\n# bmalph-version: 1.2.0\nset -euo pipefail\n");

    const result = await checkVersionMarker("/projects/webapp");

    expect(result.detail).toContain("1.2.0");
  });

  it("suggests running bmalph upgrade on version mismatch", async () => {
    mockReadFile.mockResolvedValue("#!/bin/bash\n# bmalph-version: 0.9.0\nset -euo pipefail\n");

    const result = await checkVersionMarker("/projects/webapp");

    expect(result.hint).toBe("Run: bmalph upgrade");
  });

  it("passes with note for pre-0.8.0 installs without a marker", async () => {
    mockReadFile.mockResolvedValue("#!/bin/bash\nset -euo pipefail\necho 'running'\n");

    const result = await checkVersionMarker("/projects/webapp");

    expect(result.passed).toBe(true);
  });

  it("mentions pre-0.8.0 in detail when no marker is found in existing file", async () => {
    mockReadFile.mockResolvedValue("#!/bin/bash\nset -euo pipefail\n");

    const result = await checkVersionMarker("/projects/webapp");

    expect(result.detail).toContain("pre-0.8.0");
  });

  it("passes when ralph_loop.sh does not exist", async () => {
    mockReadFile.mockRejectedValue(enoentError());

    const result = await checkVersionMarker("/projects/webapp");

    expect(result.passed).toBe(true);
  });

  it("reports generic error for non-ENOENT read failures", async () => {
    const err = new Error("EACCES: permission denied") as NodeJS.ErrnoException;
    err.code = "EACCES";
    mockReadFile.mockRejectedValue(err);

    const result = await checkVersionMarker("/projects/webapp");

    expect(result.passed).toBe(false);
  });
});

describe("checkUpstreamVersions", () => {
  it("passes when installed BMAD commit matches bundled version", async () => {
    const bmadCommit = "abc12345def67890abc12345def67890abc12345";
    mockReadConfig.mockResolvedValue({
      name: "my-saas-app",
      description: "SaaS application",
      createdAt: "2025-06-15T10:30:00.000Z",
      upstreamVersions: { bmadCommit },
    });

    const result = await checkUpstreamVersions("/projects/webapp");

    expect(result.passed).toBe(true);
  });

  it("includes the short BMAD commit hash in detail", async () => {
    const bmadCommit = "abc12345def67890abc12345def67890abc12345";
    mockReadConfig.mockResolvedValue({
      name: "my-saas-app",
      description: "SaaS application",
      createdAt: "2025-06-15T10:30:00.000Z",
      upstreamVersions: { bmadCommit },
    });

    const result = await checkUpstreamVersions("/projects/webapp");

    expect(result.detail).toContain("abc12345");
  });

  it("fails when installed BMAD commit differs from bundled version", async () => {
    mockReadConfig.mockResolvedValue({
      name: "my-saas-app",
      description: "SaaS application",
      createdAt: "2025-06-15T10:30:00.000Z",
      upstreamVersions: { bmadCommit: "old98765old98765old98765old98765old98765" },
    });

    const result = await checkUpstreamVersions("/projects/webapp");

    expect(result.passed).toBe(false);
  });

  it("shows outdated detail with both commit hashes on mismatch", async () => {
    mockReadConfig.mockResolvedValue({
      name: "my-saas-app",
      description: "SaaS application",
      createdAt: "2025-06-15T10:30:00.000Z",
      upstreamVersions: { bmadCommit: "old98765old98765old98765old98765old98765" },
    });

    const result = await checkUpstreamVersions("/projects/webapp");

    expect(result.detail).toContain("outdated");
  });

  it("fails when config file is not found", async () => {
    mockReadConfig.mockResolvedValue(null);

    const result = await checkUpstreamVersions("/projects/webapp");

    expect(result.passed).toBe(false);
  });

  it("suggests running bmalph init when config is missing", async () => {
    mockReadConfig.mockResolvedValue(null);

    const result = await checkUpstreamVersions("/projects/webapp");

    expect(result.hint).toBe("Run: bmalph init");
  });

  it("passes with note for pre-1.2.0 installs without upstream tracking", async () => {
    mockReadConfig.mockResolvedValue({
      name: "legacy-project",
      description: "Old project",
      createdAt: "2024-12-01T08:00:00.000Z",
    });

    const result = await checkUpstreamVersions("/projects/webapp");

    expect(result.passed).toBe(true);
  });

  it("mentions pre-1.2.0 in detail for installs without version tracking", async () => {
    mockReadConfig.mockResolvedValue({
      name: "legacy-project",
      description: "Old project",
      createdAt: "2024-12-01T08:00:00.000Z",
    });

    const result = await checkUpstreamVersions("/projects/webapp");

    expect(result.detail).toContain("pre-1.2.0");
  });

  it("handles errors from readConfig gracefully", async () => {
    mockReadConfig.mockRejectedValue(new Error("disk read failure"));

    const result = await checkUpstreamVersions("/projects/webapp");

    expect(result.passed).toBe(false);
  });
});
