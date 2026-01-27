/**
 * Centralized constants for bmalph.
 *
 * Path constants define the standard directory names used throughout
 * the bmalph project for BMAD, Ralph, and Claude Code integration.
 *
 * Numeric thresholds are used for validation, file processing, and health checks.
 */

import { join } from "path";

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

/** Max length for section extraction from documents */
export const SECTION_EXTRACT_MAX_LENGTH = 500;

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

/** Ralph logs directory */
export const RALPH_LOGS_DIR = ".ralph/logs";

/** Ralph specs directory (copied from _bmad-output) */
export const RALPH_SPECS_DIR = ".ralph/specs";

/** Claude Code slash commands directory */
export const CLAUDE_COMMANDS_DIR = ".claude/commands";

/**
 * Get absolute path to Ralph directory for a project.
 */
export function getRalphDir(projectDir: string): string {
  return join(projectDir, RALPH_DIR);
}

/**
 * Get absolute path to BMAD directory for a project.
 */
export function getBmadDir(projectDir: string): string {
  return join(projectDir, BMAD_DIR);
}

/**
 * Get absolute path to bmalph state directory for a project.
 */
export function getBmalphDir(projectDir: string): string {
  return join(projectDir, BMALPH_DIR);
}

/**
 * Get absolute path to BMAD output directory for a project.
 */
export function getBmadOutputDir(projectDir: string): string {
  return join(projectDir, BMAD_OUTPUT_DIR);
}

/**
 * Get absolute path to Ralph logs directory for a project.
 */
export function getRalphLogsDir(projectDir: string): string {
  return join(projectDir, RALPH_LOGS_DIR);
}

/**
 * Get absolute path to Ralph specs directory for a project.
 */
export function getRalphSpecsDir(projectDir: string): string {
  return join(projectDir, RALPH_SPECS_DIR);
}

/**
 * Get absolute path to Claude commands directory for a project.
 */
export function getClaudeCommandsDir(projectDir: string): string {
  return join(projectDir, CLAUDE_COMMANDS_DIR);
}
