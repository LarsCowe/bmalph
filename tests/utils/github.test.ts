import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

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

import {
  fetchLatestCommit,
  checkUpstream,
  clearCache,
  GitHubClient,
  type RepoInfo,
} from "../../src/utils/github.js";
import type { BundledVersions } from "../../src/installer.js";

describe("github utilities", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    clearCache();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  describe("fetchLatestCommit", () => {
    const bmadRepo: RepoInfo = {
      owner: "bmad-code-org",
      repo: "BMAD-METHOD",
      branch: "main",
    };

    it("returns commit info on success", async () => {
      const mockResponse = {
        sha: "abc123def456789",
        commit: {
          message: "feat: add new feature",
          author: {
            date: "2024-01-15T10:30:00Z",
          },
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await fetchLatestCommit(bmadRepo);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sha).toBe("abc123def456789");
        expect(result.data.shortSha).toBe("abc123de");
        expect(result.data.message).toBe("feat: add new feature");
        expect(result.data.date).toBe("2024-01-15T10:30:00Z");
      }

      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.github.com/repos/bmad-code-org/BMAD-METHOD/commits/main",
        expect.objectContaining({
          headers: expect.objectContaining({
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "bmalph-cli",
          }),
        }),
      );
    });

    it("returns network error when offline", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("fetch failed"));

      const result = await fetchLatestCommit(bmadRepo);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("network");
        expect(result.error.message).toContain("fetch failed");
      }
    });

    it("returns rate-limit error when limited", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        headers: new Map([["X-RateLimit-Remaining", "0"]]),
        json: () =>
          Promise.resolve({
            message: "API rate limit exceeded",
          }),
      });

      const result = await fetchLatestCommit(bmadRepo);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("rate-limit");
      }
    });

    it("returns not-found error for missing repo", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ message: "Not Found" }),
      });

      const result = await fetchLatestCommit(bmadRepo);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("not-found");
      }
    });

    it("respects timeout", async () => {
      // Mock fetch to never resolve (simulating slow connection)
      global.fetch = vi.fn().mockImplementation(
        () =>
          new Promise((_, reject) => {
            // Simulate AbortController abort
            setTimeout(() => reject(new DOMException("Aborted", "AbortError")), 50);
          }),
      );

      const result = await fetchLatestCommit(bmadRepo, { timeoutMs: 50 });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("timeout");
      }
    });

    it("uses cached results within TTL", async () => {
      const mockResponse = {
        sha: "abc123def456789",
        commit: {
          message: "feat: cached",
          author: { date: "2024-01-15T10:30:00Z" },
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      // First call
      await fetchLatestCommit(bmadRepo);
      // Second call should use cache
      await fetchLatestCommit(bmadRepo);

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("checkUpstream", () => {
    const bundled: BundledVersions = {
      bmadCommit: "48881f86",
      ralphCommit: "019b8c73",
    };

    describe("SHA comparison accuracy", () => {
      it("reports outdated when bundled is prefix of latest (false positive case)", async () => {
        // Bug: startsWith would incorrectly mark this as up-to-date
        // bundled="abc1" is a prefix of latest="abc12345", but they're different commits!
        const shortBundled: BundledVersions = {
          bmadCommit: "abc1",
          ralphCommit: "def1",
        };

        global.fetch = vi
          .fn()
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                sha: "abc12345abcdef12", // shortSha = "abc12345"
                commit: { message: "new commit", author: { date: "2024-01-15T10:30:00Z" } },
              }),
          })
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                sha: "def12345abcdef12", // shortSha = "def12345"
                commit: { message: "new commit", author: { date: "2024-01-15T10:30:00Z" } },
              }),
          });

        const result = await checkUpstream(shortBundled);

        // These should be OUTDATED, not up-to-date
        expect(result.bmad?.isUpToDate).toBe(false);
        expect(result.ralph?.isUpToDate).toBe(false);
      });

      it("reports outdated when latest is prefix of bundled", async () => {
        // Another edge case: what if somehow bundled is longer?
        const longBundled: BundledVersions = {
          bmadCommit: "abc12345",
          ralphCommit: "def12345",
        };

        global.fetch = vi
          .fn()
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                sha: "abc1xxxxabcdef12", // shortSha = "abc1xxxx" - different!
                commit: { message: "new commit", author: { date: "2024-01-15T10:30:00Z" } },
              }),
          })
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                sha: "def1xxxxabcdef12", // shortSha = "def1xxxx" - different!
                commit: { message: "new commit", author: { date: "2024-01-15T10:30:00Z" } },
              }),
          });

        const result = await checkUpstream(longBundled);

        expect(result.bmad?.isUpToDate).toBe(false);
        expect(result.ralph?.isUpToDate).toBe(false);
      });

      it("reports up-to-date only when SHAs match exactly", async () => {
        const exactBundled: BundledVersions = {
          bmadCommit: "abc12345",
          ralphCommit: "def12345",
        };

        global.fetch = vi
          .fn()
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                sha: "abc12345abcdef12", // shortSha = "abc12345" - exact match!
                commit: { message: "same commit", author: { date: "2024-01-15T10:30:00Z" } },
              }),
          })
          .mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                sha: "def12345abcdef12", // shortSha = "def12345" - exact match!
                commit: { message: "same commit", author: { date: "2024-01-15T10:30:00Z" } },
              }),
          });

        const result = await checkUpstream(exactBundled);

        expect(result.bmad?.isUpToDate).toBe(true);
        expect(result.ralph?.isUpToDate).toBe(true);
      });
    });

    it("checks both repos and returns combined result", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              sha: "48881f86abcdef12",
              commit: { message: "same commit", author: { date: "2024-01-15T10:30:00Z" } },
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              sha: "abc12345newcommit",
              commit: { message: "new ralph", author: { date: "2024-01-16T10:30:00Z" } },
            }),
        });

      const result = await checkUpstream(bundled);

      expect(result.bmad).not.toBeNull();
      expect(result.ralph).not.toBeNull();
      expect(result.errors).toHaveLength(0);

      if (result.bmad) {
        expect(result.bmad.isUpToDate).toBe(true);
        expect(result.bmad.bundledSha).toBe("48881f86");
      }
      if (result.ralph) {
        expect(result.ralph.isUpToDate).toBe(false);
        expect(result.ralph.bundledSha).toBe("019b8c73");
        expect(result.ralph.latestSha).toBe("abc12345");
      }
    });

    it("generates correct compare URLs", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            sha: "newcommit123456",
            commit: { message: "update", author: { date: "2024-01-15T10:30:00Z" } },
          }),
      });

      const result = await checkUpstream(bundled);

      if (result.bmad) {
        expect(result.bmad.compareUrl).toBe(
          "https://github.com/bmad-code-org/BMAD-METHOD/compare/48881f86...newcommi",
        );
      }
      if (result.ralph) {
        expect(result.ralph.compareUrl).toBe(
          "https://github.com/snarktank/ralph/compare/019b8c73...newcommi",
        );
      }
    });

    it("handles partial failures gracefully", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              sha: "48881f86abcdef12",
              commit: { message: "bmad ok", author: { date: "2024-01-15T10:30:00Z" } },
            }),
        })
        .mockRejectedValueOnce(new Error("Network error for Ralph"));

      const result = await checkUpstream(bundled);

      expect(result.bmad).not.toBeNull();
      expect(result.ralph).toBeNull();
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].repo).toBe("ralph");
      expect(result.errors[0].type).toBe("network");
    });

    it("handles all failures gracefully", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Offline"));

      const result = await checkUpstream(bundled);

      expect(result.bmad).toBeNull();
      expect(result.ralph).toBeNull();
      expect(result.errors).toHaveLength(2);
    });
  });

  describe("error type detection", () => {
    const bmadRepo: RepoInfo = {
      owner: "bmad-code-org",
      repo: "BMAD-METHOD",
      branch: "main",
    };

    it("detects 403 as rate-limit when remaining is 0", async () => {
      const headersMap = new Map([["X-RateLimit-Remaining", "0"]]);
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        headers: {
          get: (key: string) => headersMap.get(key) || null,
        },
        json: () => Promise.resolve({ message: "rate limit" }),
      });

      const result = await fetchLatestCommit(bmadRepo);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("rate-limit");
      }
    });

    it("detects 403 as api-error when not rate-limited", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        headers: {
          get: () => "10", // Has remaining calls
        },
        json: () => Promise.resolve({ message: "Forbidden" }),
      });

      const result = await fetchLatestCommit(bmadRepo);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("api-error");
      }
    });

    it("detects 500+ as api-error", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        headers: { get: () => null },
        json: () => Promise.resolve({ message: "Internal Server Error" }),
      });

      const result = await fetchLatestCommit(bmadRepo);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("api-error");
        expect(result.error.status).toBe(500);
      }
    });
  });
});

describe("GitHubClient class", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  const bmadRepo: RepoInfo = {
    owner: "bmad-code-org",
    repo: "BMAD-METHOD",
    branch: "main",
  };

  const mockSuccessResponse = {
    sha: "abc123def456789",
    commit: {
      message: "feat: test commit",
      author: { date: "2024-01-15T10:30:00Z" },
    },
  };

  describe("instance isolation", () => {
    it("each instance has its own independent cache", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockSuccessResponse),
      });

      const client1 = new GitHubClient();
      const client2 = new GitHubClient();

      // Fetch with client1
      await client1.fetchLatestCommit(bmadRepo);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Client2 should not use client1's cache
      await client2.fetchLatestCommit(bmadRepo);
      expect(global.fetch).toHaveBeenCalledTimes(2);

      // Client1's cache still works
      await client1.fetchLatestCommit(bmadRepo);
      expect(global.fetch).toHaveBeenCalledTimes(2); // No new call
    });

    it("clearing one client cache does not affect another", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockSuccessResponse),
      });

      const client1 = new GitHubClient();
      const client2 = new GitHubClient();

      // Populate both caches
      await client1.fetchLatestCommit(bmadRepo);
      await client2.fetchLatestCommit(bmadRepo);
      expect(global.fetch).toHaveBeenCalledTimes(2);

      // Clear only client1's cache
      client1.clearCache();

      // Client2's cache should still work
      await client2.fetchLatestCommit(bmadRepo);
      expect(global.fetch).toHaveBeenCalledTimes(2); // No new call

      // Client1 should fetch again
      await client1.fetchLatestCommit(bmadRepo);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });
  });

  describe("custom cache TTL", () => {
    it("accepts custom cache TTL in constructor", async () => {
      const client = new GitHubClient({ cacheTtlMs: 100 });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockSuccessResponse),
      });

      // First call
      await client.fetchLatestCommit(bmadRepo);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Immediate second call uses cache
      await client.fetchLatestCommit(bmadRepo);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Wait for cache to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should fetch again after TTL expired
      await client.fetchLatestCommit(bmadRepo);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("fetchLatestCommit", () => {
    it("returns success with commit info", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockSuccessResponse),
      });

      const client = new GitHubClient();
      const result = await client.fetchLatestCommit(bmadRepo);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sha).toBe("abc123def456789");
        expect(result.data.shortSha).toBe("abc123de");
      }
    });

    it("handles network errors", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Connection refused"));

      const client = new GitHubClient();
      const result = await client.fetchLatestCommit(bmadRepo);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("network");
        expect(result.error.message).toContain("Connection refused");
      }
    });
  });

  describe("checkUpstream", () => {
    it("uses instance cache for repeated calls", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockSuccessResponse),
      });

      const bundled: BundledVersions = {
        bmadCommit: "abc123de",
        ralphCommit: "abc123de",
      };

      const client = new GitHubClient();

      // First call
      await client.checkUpstream(bundled);
      expect(global.fetch).toHaveBeenCalledTimes(2); // BMAD + Ralph

      // Second call should use cache
      await client.checkUpstream(bundled);
      expect(global.fetch).toHaveBeenCalledTimes(2); // No additional calls
    });
  });

  describe("getCacheStats", () => {
    it("returns cache size", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockSuccessResponse),
      });

      const client = new GitHubClient();

      expect(client.getCacheStats().size).toBe(0);

      await client.fetchLatestCommit(bmadRepo);

      expect(client.getCacheStats().size).toBe(1);
    });
  });
});
