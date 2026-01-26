import { describe, it, expect } from "vitest";
import { formatError, formatErrorMessage } from "../../src/utils/errors.js";

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
  });

  describe("formatErrorMessage", () => {
    it("creates formatted error message with prefix", () => {
      const error = new Error("File not found");
      expect(formatErrorMessage("Failed to read file", error)).toBe(
        "Failed to read file: File not found"
      );
    });

    it("works with string errors", () => {
      expect(formatErrorMessage("Operation failed", "timeout")).toBe(
        "Operation failed: timeout"
      );
    });

    it("works with unknown error types", () => {
      expect(formatErrorMessage("Task failed", 500)).toBe(
        "Task failed: 500"
      );
    });
  });
});
