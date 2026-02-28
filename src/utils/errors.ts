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
/**
 * Check if an error is an ENOENT (file not found) filesystem error.
 *
 * @param err - Any caught error value
 * @returns true if the error is an Error with code "ENOENT"
 */
export function isEnoent(err: unknown): boolean {
  return err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT";
}

export function formatError(error: unknown): string {
  if (error instanceof Error) {
    if (error.cause) {
      return `${error.message}: ${formatError(error.cause)}`;
    }
    return error.message;
  }
  return String(error);
}

/**
 * Wrap an async command function with standard error handling.
 *
 * Catches any errors, prints them in red to stderr, and sets process.exitCode to 1.
 * Uses process.exitCode instead of process.exit() to allow graceful cleanup.
 *
 * @param fn - Async function to execute
 * @returns Promise that resolves when the function completes (or error is handled)
 *
 * @example
 * ```ts
 * export async function myCommand(options: MyOptions): Promise<void> {
 *   await withErrorHandling(() => runMyCommand(options));
 * }
 * ```
 */
export async function withErrorHandling(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    const message = formatError(err);
    // Import chalk dynamically to avoid circular dependencies
    const chalk = await import("chalk");
    console.error(chalk.default.red(`Error: ${message}`));
    process.exitCode = 1;
  }
}
