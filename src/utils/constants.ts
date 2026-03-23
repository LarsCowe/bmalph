/**
 * Centralized constants for bmalph.
 *
 * Path constants define the standard directory names used throughout
 * the bmalph project for BMAD, Ralph, and Claude Code integration.
 *
 * Numeric thresholds are used for validation, file processing, and health checks.
 */

// =============================================================================
// Validation thresholds
// =============================================================================

/** Maximum allowed project name length */
export const MAX_PROJECT_NAME_LENGTH = 100;

// =============================================================================
// File processing thresholds
// =============================================================================

/** File size threshold for "large file" warnings (50 KB) */
export const LARGE_FILE_THRESHOLD_BYTES = 50000;

/** Default max length for extracted content snippets */
export const DEFAULT_SNIPPET_MAX_LENGTH = 60;

/** Max length for section extraction from documents (increased to preserve full BMAD specs) */
export const SECTION_EXTRACT_MAX_LENGTH = 5000;

/** Max characters for diff line preview */
export const DIFF_LINE_PREVIEW_LENGTH = 50;

// =============================================================================
// Health check thresholds
// =============================================================================

/** Session age warning threshold (24 hours in milliseconds) */
export const SESSION_AGE_WARNING_MS = 24 * 60 * 60 * 1000;

/** API call usage warning threshold (percentage) */
export const API_USAGE_WARNING_PERCENT = 90;

// =============================================================================
// Path constants
// =============================================================================

/** Ralph working directory (contains loop, specs, logs) */
export const RALPH_DIR = ".ralph";

/** BMAD agents and workflows directory */
export const BMAD_DIR = "_bmad";

/** bmalph state directory (config, phase tracking) */
export const BMALPH_DIR = "bmalph";

/** BMAD output directory (planning artifacts) */
export const BMAD_OUTPUT_DIR = "_bmad-output";

/** Skills directory used by the Codex platform */
export const CODEX_SKILLS_DIR = ".agents/skills";

/** Skills directory used by the OpenCode platform */
export const OPENCODE_SKILLS_DIR = ".opencode/skills";

/** Prefix for bmalph-managed skill directories */
export const SKILLS_PREFIX = "bmad-";

/** bmalph state subdirectory (inside BMALPH_DIR) */
export const STATE_DIR = "bmalph/state";

/** bmalph config file path */
export const CONFIG_FILE = "bmalph/config.json";

/** BMAD config file path */
export const BMAD_CONFIG_FILE = "_bmad/config.yaml";

/** Ralph status file path */
export const RALPH_STATUS_FILE = ".ralph/status.json";

// =============================================================================
// Ralph status mapping
// =============================================================================

/**
 * Maps raw Ralph bash status strings to normalized status values.
 * Single source of truth — used by both validate.ts and ralph-runtime-state.ts.
 */
export const RALPH_STATUS_MAP = {
  running: "running",
  halted: "blocked",
  stopped: "blocked",
  completed: "completed",
  success: "completed",
  graceful_exit: "completed",
  paused: "blocked",
  error: "blocked",
} as const;

// =============================================================================
// Gitignore entries managed by bmalph
// =============================================================================

/** Entries bmalph adds to .gitignore during init and checks during doctor */
export const GITIGNORE_ENTRIES = [".ralph/logs/", "_bmad-output/"] as const;

// =============================================================================
// Dashboard constants
// =============================================================================

/** Default dashboard refresh interval in milliseconds */
export const DEFAULT_INTERVAL_MS = 2000;

/** Minimum allowed dashboard refresh interval in milliseconds */
export const MIN_INTERVAL_MS = 500;
