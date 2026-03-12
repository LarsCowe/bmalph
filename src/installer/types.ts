export interface BundledVersions {
  bmadCommit: string;
}

export interface UpgradeResult {
  updatedPaths: string[];
}

export interface PreviewInstallResult {
  wouldCreate: string[];
  wouldModify: string[];
  wouldSkip: string[];
}

export interface PreviewUpgradeResult {
  wouldUpdate: string[];
  wouldCreate: string[];
  wouldPreserve: string[];
}

/** Classification result for a single slash command. */
export interface ClassifiedCommand {
  name: string;
  description: string;
  /** First line of the slash command file (used for invocation column). */
  invocation: string;
  /** Full body content from the slash command file. */
  body: string;
  kind: "agent" | "workflow" | "bmalph" | "utility";
  /** Phase key for workflow commands (e.g. "1-analysis"). */
  phase?: string;
  /** For bmalph commands: how to run them. */
  howToRun?: string;
}
