import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("chalk", () => ({
  default: {
    dim: (s: string) => `[dim]${s}[/dim]`,
    blue: (s: string) => `[blue]${s}[/blue]`,
    yellow: (s: string) => `[yellow]${s}[/yellow]`,
    red: (s: string) => `[red]${s}[/red]`,
    green: (s: string) => `[green]${s}[/green]`,
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

  describe("setQuiet", () => {
    it("suppresses info output when quiet is enabled", async () => {
      const { setQuiet, info } = await import("../../src/utils/logger.js");

      setQuiet(true);
      info("should not appear");

      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it("suppresses debug output when quiet is enabled", async () => {
      const { setVerbose, setQuiet, debug } = await import("../../src/utils/logger.js");

      setVerbose(true);
      setQuiet(true);
      debug("should not appear");

      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it("suppresses warn output when quiet is enabled", async () => {
      const { setQuiet, warn } = await import("../../src/utils/logger.js");

      setQuiet(true);
      warn("warning should not appear");

      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it("resumes normal output when quiet is disabled", async () => {
      const { setQuiet, info } = await import("../../src/utils/logger.js");

      setQuiet(true);
      info("suppressed");
      expect(consoleSpy).not.toHaveBeenCalled();

      setQuiet(false);
      info("visible again");
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("visible again"));
    });
  });

  describe("info", () => {
    it("outputs message with blue color", async () => {
      const { info } = await import("../../src/utils/logger.js");

      info("info message");

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("[blue]"));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("info message"));
    });
  });

  describe("warn", () => {
    it("outputs message with yellow color", async () => {
      const { warn } = await import("../../src/utils/logger.js");

      warn("warning message");

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("[yellow]"));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("warning message"));
    });
  });
});
