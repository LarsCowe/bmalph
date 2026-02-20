import type { BundledVersions } from "../installer.js";
import { formatError } from "./errors.js";

export interface RepoInfo {
  owner: string;
  repo: string;
  branch: string;
}

export interface CommitInfo {
  sha: string;
  shortSha: string;
  message: string;
  date: string;
}

export type GitHubErrorType = "network" | "timeout" | "rate-limit" | "not-found" | "api-error";

export interface GitHubError {
  type: GitHubErrorType;
  message: string;
  repo?: string;
  status?: number;
}

export type FetchResult<T> = { success: true; data: T } | { success: false; error: GitHubError };

export interface UpstreamStatus {
  bundledSha: string;
  latestSha: string;
  isUpToDate: boolean;
  compareUrl: string;
}

export interface CheckUpstreamResult {
  bmad: UpstreamStatus | null;
  ralph: UpstreamStatus | null;
  errors: GitHubError[];
}

interface FetchOptions {
  timeoutMs?: number;
}

interface CacheEntry {
  data: CommitInfo;
  timestamp: number;
  lastAccessed: number;
}

interface GitHubClientOptions {
  cacheTtlMs?: number;
  maxCacheSize?: number;
}

interface CacheStats {
  size: number;
}

const BMAD_REPO: RepoInfo = {
  owner: "bmad-code-org",
  repo: "BMAD-METHOD",
  branch: "main",
};

const RALPH_REPO: RepoInfo = {
  owner: "snarktank",
  repo: "ralph",
  branch: "main",
};

const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_MAX_CACHE_SIZE = 100;

interface GitHubCommitResponse {
  sha: string;
  commit: {
    message: string;
    author: {
      date: string;
    };
  };
}

function classifyError(status: number, headers: Headers): GitHubErrorType {
  if (status === 404) {
    return "not-found";
  }
  if (status === 403) {
    const remaining = headers.get("X-RateLimit-Remaining");
    if (remaining === "0") {
      return "rate-limit";
    }
  }
  return "api-error";
}

function generateCompareUrl(repo: RepoInfo, bundledSha: string, latestSha: string): string {
  return `https://github.com/${repo.owner}/${repo.repo}/compare/${bundledSha}...${latestSha}`;
}

function compareShas(bundledSha: string, latestShortSha: string): boolean {
  return latestShortSha.slice(0, 8) === bundledSha.slice(0, 8);
}

function buildUpstreamStatus(
  repo: RepoInfo,
  bundledSha: string,
  latestShortSha: string
): UpstreamStatus {
  return {
    bundledSha,
    latestSha: latestShortSha,
    isUpToDate: compareShas(bundledSha, latestShortSha),
    compareUrl: generateCompareUrl(repo, bundledSha, latestShortSha),
  };
}

/**
 * GitHub API client with instance-level caching.
 * Each instance maintains its own cache, improving testability.
 */
export class GitHubClient {
  private cache = new Map<string, CacheEntry>();
  private cacheTtlMs: number;
  private maxCacheSize: number;

  constructor(options: GitHubClientOptions = {}) {
    this.cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
    this.maxCacheSize = options.maxCacheSize ?? DEFAULT_MAX_CACHE_SIZE;
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheStats(): CacheStats {
    return { size: this.cache.size };
  }

  private getCacheKey(repo: RepoInfo): string {
    return `${repo.owner}/${repo.repo}/${repo.branch}`;
  }

  private getCachedResult(repo: RepoInfo): CommitInfo | null {
    const key = this.getCacheKey(repo);
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }
    // Remove stale entry immediately instead of leaving it in cache
    if (Date.now() - entry.timestamp >= this.cacheTtlMs) {
      this.cache.delete(key);
      return null;
    }
    // Update lastAccessed for LRU tracking
    entry.lastAccessed = Date.now();
    return entry.data;
  }

  private setCachedResult(repo: RepoInfo, data: CommitInfo): void {
    const key = this.getCacheKey(repo);
    const now = Date.now();

    // Clean up expired entries before checking size (prevents stale entries from occupying space)
    for (const [k, v] of this.cache.entries()) {
      if (now - v.timestamp >= this.cacheTtlMs) {
        this.cache.delete(k);
      }
    }

    // Evict oldest entry if cache is still at max size after cleanup (LRU eviction)
    if (this.cache.size >= this.maxCacheSize && !this.cache.has(key)) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;

      for (const [k, v] of this.cache.entries()) {
        if (v.lastAccessed < oldestTime) {
          oldestTime = v.lastAccessed;
          oldestKey = k;
        }
      }

      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, { data, timestamp: now, lastAccessed: now });
  }

  async fetchLatestCommit(
    repo: RepoInfo,
    options: FetchOptions = {}
  ): Promise<FetchResult<CommitInfo>> {
    // Check cache first
    const cached = this.getCachedResult(repo);
    if (cached) {
      return { success: true, data: cached };
    }

    const url = `https://api.github.com/repos/${repo.owner}/${repo.repo}/commits/${repo.branch}`;
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "bmalph-cli",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorType = classifyError(response.status, response.headers);
        return {
          success: false,
          error: {
            type: errorType,
            message: `GitHub API error: ${response.status}`,
            status: response.status,
          },
        };
      }

      const data = (await response.json()) as unknown;

      // Validate response structure before accessing nested properties
      if (
        !data ||
        typeof data !== "object" ||
        !("sha" in data) ||
        typeof (data as GitHubCommitResponse).sha !== "string" ||
        !("commit" in data) ||
        !(data as GitHubCommitResponse).commit ||
        typeof (data as GitHubCommitResponse).commit?.message !== "string" ||
        !(data as GitHubCommitResponse).commit?.author ||
        typeof (data as GitHubCommitResponse).commit?.author?.date !== "string"
      ) {
        return {
          success: false,
          error: {
            type: "api-error",
            message: "Invalid response structure from GitHub API",
          },
        };
      }

      const validData = data as GitHubCommitResponse;
      const commitInfo: CommitInfo = {
        sha: validData.sha,
        shortSha: validData.sha.slice(0, 8),
        message: validData.commit.message,
        date: validData.commit.author.date,
      };

      // Cache successful result
      this.setCachedResult(repo, commitInfo);

      return { success: true, data: commitInfo };
    } catch (err) {
      clearTimeout(timeoutId);

      if (err instanceof DOMException && err.name === "AbortError") {
        return {
          success: false,
          error: {
            type: "timeout",
            message: `Request timed out after ${timeoutMs}ms`,
          },
        };
      }

      return {
        success: false,
        error: {
          type: "network",
          message: `Network error: ${formatError(err)}`,
        },
      };
    }
  }

  async checkUpstream(bundled: BundledVersions): Promise<CheckUpstreamResult> {
    const errors: GitHubError[] = [];
    let bmadStatus: UpstreamStatus | null = null;
    let ralphStatus: UpstreamStatus | null = null;

    // Fetch both in parallel
    const [bmadResult, ralphResult] = await Promise.all([
      this.fetchLatestCommit(BMAD_REPO),
      this.fetchLatestCommit(RALPH_REPO),
    ]);

    if (bmadResult.success) {
      bmadStatus = buildUpstreamStatus(BMAD_REPO, bundled.bmadCommit, bmadResult.data.shortSha);
    } else {
      errors.push({ ...bmadResult.error, repo: "bmad" });
    }

    if (ralphResult.success) {
      ralphStatus = buildUpstreamStatus(RALPH_REPO, bundled.ralphCommit, ralphResult.data.shortSha);
    } else {
      errors.push({ ...ralphResult.error, repo: "ralph" });
    }

    return {
      bmad: bmadStatus,
      ralph: ralphStatus,
      errors,
    };
  }
}

/**
 * Determines why upstream checks were skipped based on error types.
 */
export function getSkipReason(errors: GitHubError[]): string {
  if (errors.length === 0) return "unknown";
  const types = new Set(errors.map((e) => e.type));
  if (types.has("rate-limit")) return "rate limited";
  if (types.has("network")) return "offline";
  if (types.has("timeout")) return "timeout";
  return "error";
}

// Default client instance for backward compatibility
const defaultClient = new GitHubClient();

/**
 * Clear the default client's cache.
 * For testing, prefer creating a new GitHubClient instance instead.
 */
export function clearCache(): void {
  defaultClient.clearCache();
}

/**
 * Fetch the latest commit from a GitHub repository.
 * Uses the default shared client instance.
 */
export async function fetchLatestCommit(
  repo: RepoInfo,
  options: FetchOptions = {}
): Promise<FetchResult<CommitInfo>> {
  return defaultClient.fetchLatestCommit(repo, options);
}

/**
 * Check upstream repositories for updates.
 * Uses the default shared client instance.
 */
export async function checkUpstream(bundled: BundledVersions): Promise<CheckUpstreamResult> {
  return defaultClient.checkUpstream(bundled);
}
