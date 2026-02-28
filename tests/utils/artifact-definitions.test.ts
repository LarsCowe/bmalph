import { describe, it, expect } from "vitest";
import { ARTIFACT_DEFINITIONS } from "../../src/utils/artifact-definitions.js";

describe("ARTIFACT_DEFINITIONS", () => {
  it("contains exactly 9 definitions", () => {
    expect(ARTIFACT_DEFINITIONS).toHaveLength(9);
  });

  it("groups phase 1 artifacts correctly", () => {
    const phase1 = ARTIFACT_DEFINITIONS.filter((d) => d.phase === 1);
    const names = phase1.map((d) => d.name);
    expect(names).toEqual([
      "Product Brief",
      "Market Research",
      "Domain Research",
      "Technical Research",
    ]);
  });

  it("groups phase 2 artifacts correctly", () => {
    const phase2 = ARTIFACT_DEFINITIONS.filter((d) => d.phase === 2);
    const names = phase2.map((d) => d.name);
    expect(names).toEqual(["PRD", "UX Design"]);
  });

  it("groups phase 3 artifacts correctly", () => {
    const phase3 = ARTIFACT_DEFINITIONS.filter((d) => d.phase === 3);
    const names = phase3.map((d) => d.name);
    expect(names).toEqual(["Architecture", "Epics & Stories", "Readiness Report"]);
  });

  it("marks PRD as required", () => {
    const prd = ARTIFACT_DEFINITIONS.find((d) => d.name === "PRD");
    expect(prd?.required).toBe(true);
  });

  it("marks all phase 3 artifacts as required", () => {
    const phase3 = ARTIFACT_DEFINITIONS.filter((d) => d.phase === 3);
    for (const def of phase3) {
      expect(def.required).toBe(true);
    }
  });

  it("marks all phase 1 artifacts as not required", () => {
    const phase1 = ARTIFACT_DEFINITIONS.filter((d) => d.phase === 1);
    for (const def of phase1) {
      expect(def.required).toBe(false);
    }
  });

  it("has a RegExp pattern on every definition", () => {
    for (const def of ARTIFACT_DEFINITIONS) {
      expect(def.pattern).toBeInstanceOf(RegExp);
    }
  });

  it("has patterns that match expected filenames", () => {
    const expectations: [string, string][] = [
      ["product-brief.md", "Product Brief"],
      ["market-research.md", "Market Research"],
      ["domain-research.md", "Domain Research"],
      ["tech-research.md", "Technical Research"],
      ["prd.md", "PRD"],
      ["ux-design.md", "UX Design"],
      ["architecture.md", "Architecture"],
      ["epics-and-stories.md", "Epics & Stories"],
      ["readiness-report.md", "Readiness Report"],
    ];
    for (const [filename, expectedName] of expectations) {
      const match = ARTIFACT_DEFINITIONS.find((d) => d.pattern.test(filename));
      expect(match?.name).toBe(expectedName);
    }
  });

  it("does not match unrelated filenames", () => {
    const unrelatedFiles = [
      "random.md",
      "todo-list.txt",
      "changelog.md",
      "config.json",
      "README.md",
    ];
    for (const filename of unrelatedFiles) {
      const match = ARTIFACT_DEFINITIONS.find((d) => d.pattern.test(filename));
      expect(match).toBeUndefined();
    }
  });
});
