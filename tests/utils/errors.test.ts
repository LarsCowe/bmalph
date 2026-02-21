import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  formatError,
  formatErrorMessage,
  isEnoent,
  withErrorHandling,
} from "../../src/utils/errors.js";

describe("errors", () => {
  describe("formatError", () => {
    it("returns message from Error instance", () => {
      const error = new Error("Something went wrong");
      expect(formatError(error)).toBe("Something went wrong");
    });

    it("returns string for non-Error values", () => {
      expect(formatError("string error")).toBe("string error");
    });

    it("converts numbers to string", () => {
      expect(formatError(404)).toBe("404");
    });

    it("converts objects to string", () => {
      expect(formatError({ code: "ERR" })).toBe("[object Object]");
    });

    it("handles null", () => {
      expect(formatError(null)).toBe("null");
    });

    it("handles undefined", () => {
      expect(formatError(undefined)).toBe("undefined");
    });

    it("extracts message from Error subclasses", () => {
      const error = new TypeError("Type mismatch");
      expect(formatError(error)).toBe("Type mismatch");
    });

    it("includes cause chain in formatted message", () => {
      const cause = new Error("disk full");
      const error = new Error("Failed to write config", { cause });
      expect(formatError(error)).toBe("Failed to write config: disk full");
    });

    it("includes nested cause chain in formatted message", () => {
      const root = new Error("EACCES");
      const mid = new Error("write failed", { cause: root });
      const outer = new Error("Config save failed", { cause: mid });
      expect(formatError(outer)).toBe("Config save failed: write failed: EACCES");
    });

    it("includes non-Error cause in formatted message", () => {
      const error = new Error("Operation failed", { cause: "timeout" });
      expect(formatError(error)).toBe("Operation failed: timeout");
    });
  });

  describe("isEnoent", () => {
    it("returns true for ENOENT error", () => {
      const err = Object.assign(new Error("ENOENT: no such file"), { code: "ENOENT" });
      expect(isEnoent(err)).toBe(true);
    });

    it("returns false for EACCES error", () => {
      const err = Object.assign(new Error("EACCES: permission denied"), { code: "EACCES" });
      expect(isEnoent(err)).toBe(false);
    });

    it("returns false for Error without code", () => {
      expect(isEnoent(new Error("generic error"))).toBe(false);
    });

    it("returns false for non-Error values", () => {
      expect(isEnoent("not an error")).toBe(false);
      expect(isEnoent(null)).toBe(false);
      expect(isEnoent(undefined)).toBe(false);
      expect(isEnoent(42)).toBe(false);
    });

    it("returns false for plain object with code ENOENT", () => {
      expect(isEnoent({ code: "ENOENT" })).toBe(false);
    });
  });

  describe("formatErrorMessage", () => {
    it("creates formatted error message with prefix", () => {
      const error = new Error("File not found");
      expect(formatErrorMessage("Failed to read file", error)).toBe(
        "Failed to read file: File not found"
      );
    });

    it("works with string errors", () => {
      expect(formatErrorMessage("Operation failed", "timeout")).toBe("Operation failed: timeout");
    });

    it("works with unknown error types", () => {
      expect(formatErrorMessage("Task failed", 500)).toBe("Task failed: 500");
    });
  });

  describe("withErrorHandling", () => {
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      process.exitCode = undefined;
    });

    afterEach(() => {
      consoleSpy.mockRestore();
      process.exitCode = undefined;
    });

    it("executes the async function successfully", async () => {
      const fn = vi.fn().mockResolvedValue(undefined);

      await withErrorHandling(fn);

      expect(fn).toHaveBeenCalled();
      expect(consoleSpy).not.toHaveBeenCalled();
      expect(process.exitCode).toBeUndefined();
    });

    it("catches errors and prints formatted message", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("Something failed"));

      await withErrorHandling(fn);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Something failed"));
      expect(process.exitCode).toBe(1);
    });

    it("handles non-Error thrown values", async () => {
      const fn = vi.fn().mockRejectedValue("string error");

      await withErrorHandling(fn);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("string error"));
      expect(process.exitCode).toBe(1);
    });

    it("returns a promise that resolves", async () => {
      const fn = vi.fn().mockResolvedValue(undefined);

      const result = withErrorHandling(fn);

      // Should return a promise
      expect(result).toBeInstanceOf(Promise);
      await result;
      expect(fn).toHaveBeenCalled();
    });
  });
});
