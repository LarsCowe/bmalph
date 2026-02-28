import { describe, it, expect } from "vitest";
import {
  RALPH_DIR,
  BMAD_DIR,
  BMALPH_DIR,
  BMAD_OUTPUT_DIR,
  SECTION_EXTRACT_MAX_LENGTH,
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
  });
});
