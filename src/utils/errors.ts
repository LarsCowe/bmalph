/**
 * Error formatting utilities for consistent error handling.
 *
 * Provides helper functions to safely extract error messages from
 * unknown error types (catch blocks receive `unknown` in TypeScript).
 */

/**
 * Extract error message from an unknown error value.
 *
 * @param error - Any caught error (Error instance, string, or other)
 * @returns The error message as a string
 *
 * @example
 * ```ts
 * try {
 *   await riskyOperation();
 * } catch (err) {
 *   console.error(formatError(err));
 * }
 * ```
 */
export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Create a formatted error message with a prefix.
 *
 * @param prefix - Context for the error (e.g., "Failed to read file")
 * @param error - The caught error
 * @returns Formatted message like "Failed to read file: <error message>"
 *
 * @example
 * ```ts
 * try {
 *   await readFile(path);
 * } catch (err) {
 *   throw new Error(formatErrorMessage("Failed to read config", err));
 * }
 * ```
 */
export function formatErrorMessage(prefix: string, error: unknown): string {
  return `${prefix}: ${formatError(error)}`;
}
