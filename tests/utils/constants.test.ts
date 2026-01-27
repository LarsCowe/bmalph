import { describe, it, expect } from "vitest";
import { join } from "path";
import {
  RALPH_DIR,
  BMAD_DIR,
  BMALPH_DIR,
  BMAD_OUTPUT_DIR,
  RALPH_LOGS_DIR,
  RALPH_SPECS_DIR,
  CLAUDE_COMMANDS_DIR,
  SECTION_EXTRACT_MAX_LENGTH,
  getRalphDir,
  getBmadDir,
  getBmalphDir,
  getRalphLogsDir,
  getRalphSpecsDir,
  getClaudeCommandsDir,
  getBmadOutputDir,
} from "../../src/utils/constants.js";

describe("constants", () => {
  describe("threshold constants", () => {
    it("defines SECTION_EXTRACT_MAX_LENGTH as 5000 for full context transfer", () => {
      // This limit should be high enough to capture most BMAD spec sections without truncation
      expect(SECTION_EXTRACT_MAX_LENGTH).toBe(5000);
    });
  });

  describe("directory constants", () => {
    it("defines RALPH_DIR as .ralph", () => {
      expect(RALPH_DIR).toBe(".ralph");
    });

    it("defines BMAD_DIR as _bmad", () => {
      expect(BMAD_DIR).toBe("_bmad");
    });

    it("defines BMALPH_DIR as bmalph", () => {
      expect(BMALPH_DIR).toBe("bmalph");
    });

    it("defines BMAD_OUTPUT_DIR as _bmad-output", () => {
      expect(BMAD_OUTPUT_DIR).toBe("_bmad-output");
    });

    it("defines RALPH_LOGS_DIR as .ralph/logs", () => {
      expect(RALPH_LOGS_DIR).toBe(".ralph/logs");
    });

    it("defines RALPH_SPECS_DIR as .ralph/specs", () => {
      expect(RALPH_SPECS_DIR).toBe(".ralph/specs");
    });

    it("defines CLAUDE_COMMANDS_DIR as .claude/commands", () => {
      expect(CLAUDE_COMMANDS_DIR).toBe(".claude/commands");
    });
  });

  describe("path helpers", () => {
    const testProject = "/project";

    it("getRalphDir returns joined path", () => {
      const result = getRalphDir(testProject);
      expect(result).toBe(join(testProject, ".ralph"));
    });

    it("getBmadDir returns joined path", () => {
      const result = getBmadDir(testProject);
      expect(result).toBe(join(testProject, "_bmad"));
    });

    it("getBmalphDir returns joined path", () => {
      const result = getBmalphDir(testProject);
      expect(result).toBe(join(testProject, "bmalph"));
    });

    it("getRalphLogsDir returns joined path", () => {
      const result = getRalphLogsDir(testProject);
      expect(result).toBe(join(testProject, ".ralph/logs"));
    });

    it("getRalphSpecsDir returns joined path", () => {
      const result = getRalphSpecsDir(testProject);
      expect(result).toBe(join(testProject, ".ralph/specs"));
    });

    it("getClaudeCommandsDir returns joined path", () => {
      const result = getClaudeCommandsDir(testProject);
      expect(result).toBe(join(testProject, ".claude/commands"));
    });

    it("getBmadOutputDir returns joined path", () => {
      const result = getBmadOutputDir(testProject);
      expect(result).toBe(join(testProject, "_bmad-output"));
    });

    it("ends with correct directory name", () => {
      const result = getRalphDir("/any/path");
      expect(result).toMatch(/[/\\]\.ralph$/);
    });
  });
});
