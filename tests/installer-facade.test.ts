import { describe, it, expect } from "vitest";
import * as installer from "../src/installer.js";
import type {
  BundledVersions,
  UpgradeResult,
  PreviewInstallResult,
  PreviewUpgradeResult,
  ClassifiedCommand,
} from "../src/installer.js";

describe("installer facade contract", () => {
  it("keeps the current runtime export surface", () => {
    const expectedExports = [
      "getPackageVersion",
      "getBundledVersions",
      "getBundledBmadDir",
      "getBundledRalphDir",
      "getSlashCommandsDir",
      "copyBundledAssets",
      "installProject",
      "generateManifests",
      "mergeInstructionsFile",
      "isInitialized",
      "previewInstall",
      "previewUpgrade",
      "classifyCommands",
      "generateCommandIndex",
      "generateSkills",
    ] as const;

    for (const exportName of expectedExports) {
      expect(installer).toHaveProperty(exportName);
    }
  });

  it("keeps the current type export surface", () => {
    const bundledVersions: BundledVersions = { bmadCommit: "abc12345" };
    const upgradeResult: UpgradeResult = { updatedPaths: ["_bmad/"] };
    const previewInstall: PreviewInstallResult = {
      wouldCreate: ["_bmad/"],
      wouldModify: [".gitignore"],
      wouldSkip: [],
    };
    const previewUpgrade: PreviewUpgradeResult = {
      wouldUpdate: ["_bmad/"],
      wouldCreate: [".ralph/ralph_loop.sh"],
      wouldPreserve: [".ralph/PROMPT.md"],
    };
    const classifiedCommand: ClassifiedCommand = {
      name: "bmalph",
      description: "BMAD master agent",
      invocation: "/bmalph",
      body: "body",
      kind: "bmalph",
      howToRun: "Run `bmalph`",
    };

    expect(bundledVersions.bmadCommit).toBe("abc12345");
    expect(upgradeResult.updatedPaths).toEqual(["_bmad/"]);
    expect(previewInstall.wouldSkip).toEqual([]);
    expect(previewUpgrade.wouldPreserve).toEqual([".ralph/PROMPT.md"]);
    expect(classifiedCommand.kind).toBe("bmalph");
  });
});
