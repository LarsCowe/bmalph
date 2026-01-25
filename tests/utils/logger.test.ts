import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("chalk", () => ({
  default: {
    dim: (s: string) => `[dim]${s}[/dim]`,
  },
}));

describe("logger", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    vi.restoreAllMocks();
  });

  describe("setVerbose", () => {
    it("enables debug output when set to true", async () => {
      const { setVerbose, debug } = await import("../../src/utils/logger.js");

      setVerbose(true);
      debug("test message");

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("test message"));
    });

    it("disables debug output when set to false", async () => {
      const { setVerbose, debug } = await import("../../src/utils/logger.js");

      setVerbose(true);
      setVerbose(false);
      debug("test message");

      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe("isVerbose", () => {
    it("returns false by default", async () => {
      const { isVerbose } = await import("../../src/utils/logger.js");

      expect(isVerbose()).toBe(false);
    });

    it("returns true after setVerbose(true)", async () => {
      const { setVerbose, isVerbose } = await import("../../src/utils/logger.js");

      setVerbose(true);

      expect(isVerbose()).toBe(true);
    });

    it("returns false after setVerbose(false)", async () => {
      const { setVerbose, isVerbose } = await import("../../src/utils/logger.js");

      setVerbose(true);
      setVerbose(false);

      expect(isVerbose()).toBe(false);
    });
  });

  describe("debug", () => {
    it("includes [debug] prefix in output", async () => {
      const { setVerbose, debug } = await import("../../src/utils/logger.js");

      setVerbose(true);
      debug("some message");

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("[debug]"));
    });

    it("includes the message in output", async () => {
      const { setVerbose, debug } = await import("../../src/utils/logger.js");

      setVerbose(true);
      debug("specific message here");

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("specific message here"));
    });

    it("does not output when verbose is false", async () => {
      const { setVerbose, debug } = await import("../../src/utils/logger.js");

      setVerbose(false);
      debug("should not appear");

      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });
});
