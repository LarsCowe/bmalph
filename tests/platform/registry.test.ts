import { describe, it, expect } from "vitest";
import { getPlatform, getAllPlatforms, isPlatformId } from "../../src/platform/registry.js";

describe("registry", () => {
  describe("getPlatform", () => {
    it("returns claude-code platform with correct properties", () => {
      const platform = getPlatform("claude-code");
      expect(platform.id).toBe("claude-code");
      expect(platform.displayName).toBe("Claude Code");
      expect(platform.tier).toBe("full");
    });

    it("returns codex platform with correct properties", () => {
      const platform = getPlatform("codex");
      expect(platform.id).toBe("codex");
      expect(platform.displayName).toBe("OpenAI Codex");
      expect(platform.tier).toBe("full");
    });

    it("returns opencode platform with correct properties", () => {
      const platform = getPlatform("opencode");
      expect(platform.id).toBe("opencode");
      expect(platform.displayName).toBe("OpenCode");
      expect(platform.tier).toBe("full");
    });

    it("throws for unknown platform id", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => getPlatform("unknown" as any)).toThrow("Unknown platform: unknown");
    });
  });

  describe("getAllPlatforms", () => {
    it("returns array of 8 platforms", () => {
      const platforms = getAllPlatforms();
      expect(platforms).toHaveLength(8);
    });
  });

  describe("isPlatformId", () => {
    it("returns true for claude-code", () => {
      expect(isPlatformId("claude-code")).toBe(true);
    });

    it("returns true for codex", () => {
      expect(isPlatformId("codex")).toBe(true);
    });

    it("returns true for opencode", () => {
      expect(isPlatformId("opencode")).toBe(true);
    });

    it("returns false for unknown", () => {
      expect(isPlatformId("unknown")).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(isPlatformId("")).toBe(false);
    });
  });
});
