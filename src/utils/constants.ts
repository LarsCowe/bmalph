/**
 * Centralized path constants for bmalph directory structure.
 *
 * These constants define the standard directory names used throughout
 * the bmalph project for BMAD, Ralph, and Claude Code integration.
 */

import { join } from "path";

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
