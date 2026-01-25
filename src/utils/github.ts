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
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const cache = new Map<string, CacheEntry>();

function getCacheKey(repo: RepoInfo): string {
  return `${repo.owner}/${repo.repo}/${repo.branch}`;
}

export function clearCache(): void {
  cache.clear();
}

function getCachedResult(repo: RepoInfo): CommitInfo | null {
  const key = getCacheKey(repo);
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
    return entry.data;
  }
  return null;
}

function setCachedResult(repo: RepoInfo, data: CommitInfo): void {
  const key = getCacheKey(repo);
  cache.set(key, { data, timestamp: Date.now() });
}

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
  headers: { get: (key: string) => string | null },
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

export async function fetchLatestCommit(
  repo: RepoInfo,
  options: FetchOptions = {},
): Promise<FetchResult<CommitInfo>> {
  // Check cache first
  const cached = getCachedResult(repo);
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

    const data = (await response.json()) as GitHubCommitResponse;
    const commitInfo: CommitInfo = {
      sha: data.sha,
      shortSha: data.sha.slice(0, 8),
      message: data.commit.message,
      date: data.commit.author.date,
    };

    // Cache successful result
    setCachedResult(repo, commitInfo);

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

function generateCompareUrl(
  repo: RepoInfo,
  bundledSha: string,
  latestSha: string,
): string {
  return `https://github.com/${repo.owner}/${repo.repo}/compare/${bundledSha}...${latestSha}`;
}

export async function checkUpstream(
  bundled: BundledVersions,
): Promise<CheckUpstreamResult> {
  const errors: GitHubError[] = [];
  let bmadStatus: UpstreamStatus | null = null;
  let ralphStatus: UpstreamStatus | null = null;

  // Fetch both in parallel
  const [bmadResult, ralphResult] = await Promise.all([
    fetchLatestCommit(BMAD_REPO),
    fetchLatestCommit(RALPH_REPO),
  ]);

  if (bmadResult.success) {
    const isUpToDate = bmadResult.data.shortSha.startsWith(bundled.bmadCommit) ||
      bundled.bmadCommit.startsWith(bmadResult.data.shortSha);
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
    const isUpToDate = ralphResult.data.shortSha.startsWith(bundled.ralphCommit) ||
      bundled.ralphCommit.startsWith(ralphResult.data.shortSha);
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
