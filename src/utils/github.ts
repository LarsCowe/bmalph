import type { BundledVersions } from "../installer.js";

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

export type FetchResult<T> =
  | { success: true; data: T }
  | { success: false; error: GitHubError };

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
}

interface GitHubClientOptions {
  cacheTtlMs?: number;
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

interface GitHubCommitResponse {
  sha: string;
  commit: {
    message: string;
    author: {
      date: string;
    };
  };
}

function classifyError(
  status: number,
  headers: Headers,
): GitHubErrorType {
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

function generateCompareUrl(
  repo: RepoInfo,
  bundledSha: string,
  latestSha: string,
): string {
  return `https://github.com/${repo.owner}/${repo.repo}/compare/${bundledSha}...${latestSha}`;
}

/**
 * GitHub API client with instance-level caching.
 * Each instance maintains its own cache, improving testability.
 */
export class GitHubClient {
  private cache = new Map<string, CacheEntry>();
  private cacheTtlMs: number;

  constructor(options: GitHubClientOptions = {}) {
    this.cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
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
    if (entry && Date.now() - entry.timestamp < this.cacheTtlMs) {
      return entry.data;
    }
    return null;
  }

  private setCachedResult(repo: RepoInfo, data: CommitInfo): void {
    const key = this.getCacheKey(repo);
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  async fetchLatestCommit(
    repo: RepoInfo,
    options: FetchOptions = {},
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

      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: {
          type: "network",
          message: `Network error: ${message}`,
        },
      };
    }
  }

  async checkUpstream(
    bundled: BundledVersions,
  ): Promise<CheckUpstreamResult> {
    const errors: GitHubError[] = [];
    let bmadStatus: UpstreamStatus | null = null;
    let ralphStatus: UpstreamStatus | null = null;

    // Fetch both in parallel
    const [bmadResult, ralphResult] = await Promise.all([
      this.fetchLatestCommit(BMAD_REPO),
      this.fetchLatestCommit(RALPH_REPO),
    ]);

    if (bmadResult.success) {
      // Compare normalized 8-char SHAs for exact equality
      const latestNormalized = bmadResult.data.shortSha.slice(0, 8);
      const bundledNormalized = bundled.bmadCommit.slice(0, 8);
      const isUpToDate = latestNormalized === bundledNormalized;
      bmadStatus = {
        bundledSha: bundled.bmadCommit,
        latestSha: bmadResult.data.shortSha,
        isUpToDate,
        compareUrl: generateCompareUrl(BMAD_REPO, bundled.bmadCommit, bmadResult.data.shortSha),
      };
    } else {
      errors.push({ ...bmadResult.error, repo: "bmad" });
    }

    if (ralphResult.success) {
      // Compare normalized 8-char SHAs for exact equality
      const latestNormalized = ralphResult.data.shortSha.slice(0, 8);
      const bundledNormalized = bundled.ralphCommit.slice(0, 8);
      const isUpToDate = latestNormalized === bundledNormalized;
      ralphStatus = {
        bundledSha: bundled.ralphCommit,
        latestSha: ralphResult.data.shortSha,
        isUpToDate,
        compareUrl: generateCompareUrl(RALPH_REPO, bundled.ralphCommit, ralphResult.data.shortSha),
      };
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
  options: FetchOptions = {},
): Promise<FetchResult<CommitInfo>> {
  return defaultClient.fetchLatestCommit(repo, options);
}

/**
 * Check upstream repositories for updates.
 * Uses the default shared client instance.
 */
export async function checkUpstream(
  bundled: BundledVersions,
): Promise<CheckUpstreamResult> {
  return defaultClient.checkUpstream(bundled);
}
