export type {
  BundledVersions,
  UpgradeResult,
  PreviewInstallResult,
  PreviewUpgradeResult,
  ClassifiedCommand,
} from "./installer/types.js";

export {
  getPackageVersion,
  getBundledVersions,
  getBundledBmadDir,
  getBundledRalphDir,
  getSlashCommandsDir,
} from "./installer/metadata.js";

export { classifyCommands, generateCommandIndex, generateSkills } from "./installer/commands.js";

export { generateManifests } from "./installer/bmad-assets.js";

export {
  mergeInstructionsFile,
  isInitialized,
  previewInstall,
  previewUpgrade,
} from "./installer/project-files.js";

export { copyBundledAssets, installProject } from "./installer/install.js";
