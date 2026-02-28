import chalk from "chalk";
import { readConfig } from "../utils/config.js";
import { readState, readRalphStatus, getPhaseLabel, getPhaseInfo } from "../utils/state.js";
import { withErrorHandling } from "../utils/errors.js";
import { resolveProjectPlatform } from "../platform/resolve.js";
import { scanProjectArtifacts } from "../transition/artifact-scan.js";
import type { Platform } from "../platform/types.js";
import type { ProjectArtifactScan, ScannedArtifact } from "../transition/artifact-scan.js";

interface StatusOptions {
  json?: boolean;
  projectDir: string;
}

interface StatusOutput {
  phase: number;
  phaseName: string;
  status: string;
  ralph?: {
    loopCount: number;
    status: string;
    tasksCompleted: number;
    tasksTotal: number;
  };
  artifacts?: {
    directory: string;
    found: string[];
    detectedPhase: number;
    missing: string[];
  };
  nextAction?: string;
  completionMismatch?: boolean;
}

export async function statusCommand(options: StatusOptions): Promise<void> {
  await withErrorHandling(() => runStatus(options));
}

export async function runStatus(options: StatusOptions): Promise<void> {
  const projectDir = options.projectDir;

  // Check if project is initialized
  const config = await readConfig(projectDir);
  if (!config) {
    console.log(chalk.red("Project not initialized. Run: bmalph init"));
    return;
  }

  // Read current state
  const state = await readState(projectDir);
  const storedPhase = state?.currentPhase ?? 1;
  const status = state?.status ?? "planning";

  // Read Ralph status if in implementation phase
  let ralphStatus = null;
  if (storedPhase === 4) {
    ralphStatus = await readRalphStatus(projectDir);
  }

  // Scan artifacts for phases 1-3 to detect actual progress
  let artifactScan: ProjectArtifactScan | null = null;
  let phase = storedPhase;
  let phaseDetected = false;

  if (phase < 4) {
    artifactScan = await scanProjectArtifacts(projectDir);
    if (artifactScan && artifactScan.detectedPhase > phase) {
      phase = artifactScan.detectedPhase;
      phaseDetected = true;
    }
  }

  const phaseName = getPhaseLabel(phase);
  const phaseInfo = getPhaseInfo(phase);

  // Resolve platform for next action hints
  const platform = await resolveProjectPlatform(projectDir);

  // Determine next action — use artifact-based suggestion when available
  const nextAction =
    artifactScan && phaseDetected
      ? artifactScan.nextAction
      : getNextAction(phase, status, ralphStatus, platform);

  // Detect when Ralph completed but bmalph state hasn't caught up
  const completionMismatch =
    phase === 4 &&
    status === "implementing" &&
    ralphStatus !== null &&
    ralphStatus.status === "completed";

  if (options.json) {
    const output: StatusOutput = {
      phase,
      phaseName,
      status,
    };

    if (ralphStatus) {
      output.ralph = {
        loopCount: ralphStatus.loopCount,
        status: ralphStatus.status,
        tasksCompleted: ralphStatus.tasksCompleted,
        tasksTotal: ralphStatus.tasksTotal,
      };
    }

    if (artifactScan) {
      output.artifacts = {
        directory: artifactScan.directory,
        found: artifactScan.found,
        detectedPhase: artifactScan.detectedPhase,
        missing: artifactScan.missing,
      };
    }

    if (nextAction) {
      output.nextAction = nextAction;
    }

    if (completionMismatch) {
      output.completionMismatch = true;
    }

    console.log(JSON.stringify(output, null, 2));
    return;
  }

  // Human-readable output
  console.log(chalk.bold("bmalph status\n"));

  const phaseLabel = phaseDetected
    ? `${phase} - ${phaseName} (detected from artifacts)`
    : `${phase} - ${phaseName}`;
  console.log(`  ${chalk.cyan("Phase:")} ${phaseLabel}`);
  console.log(`  ${chalk.cyan("Agent:")} ${phaseInfo.agent}`);
  console.log(`  ${chalk.cyan("Status:")} ${formatStatus(status)}`);

  // Show artifact checklist for phases 1-3
  if (artifactScan) {
    console.log("");
    console.log(chalk.bold(`  Artifacts (${artifactScan.directory})`));
    printArtifactChecklist(artifactScan);
  }

  if (phase === 4 && ralphStatus) {
    console.log("");
    console.log(chalk.bold("  Ralph Loop"));
    console.log(`    ${chalk.cyan("Status:")} ${formatRalphStatus(ralphStatus.status)}`);
    console.log(`    ${chalk.cyan("Loop count:")} ${ralphStatus.loopCount}`);
    console.log(
      `    ${chalk.cyan("Tasks:")} ${ralphStatus.tasksCompleted}/${ralphStatus.tasksTotal}`
    );
  } else if (phase === 4) {
    console.log("");
    console.log(chalk.bold("  Ralph Loop"));
    console.log(`    ${chalk.cyan("Status:")} ${chalk.dim("not started")}`);
  }

  if (completionMismatch) {
    console.log("");
    console.log(chalk.green("  Ralph has completed all tasks."));
    console.log(`  ${chalk.cyan("Next:")} Review changes and update project phase`);
  } else if (nextAction) {
    console.log("");
    console.log(`  ${chalk.cyan("Next:")} ${nextAction}`);
  }
}

const ARTIFACT_DEFINITIONS: { phase: number; name: string; required: boolean }[] = [
  { phase: 1, name: "Product Brief", required: false },
  { phase: 1, name: "Market Research", required: false },
  { phase: 1, name: "Domain Research", required: false },
  { phase: 1, name: "Technical Research", required: false },
  { phase: 2, name: "PRD", required: true },
  { phase: 2, name: "UX Design", required: false },
  { phase: 3, name: "Architecture", required: true },
  { phase: 3, name: "Epics & Stories", required: true },
  { phase: 3, name: "Readiness Report", required: true },
];

const PHASE_LABELS: Record<number, string> = {
  1: "Phase 1 - Analysis",
  2: "Phase 2 - Planning",
  3: "Phase 3 - Solutioning",
};

function printArtifactChecklist(scan: ProjectArtifactScan): void {
  const foundByName = new Map<string, ScannedArtifact>();
  for (const artifacts of [scan.phases[1], scan.phases[2], scan.phases[3]]) {
    for (const artifact of artifacts) {
      foundByName.set(artifact.name, artifact);
    }
  }

  let currentPhase = 0;
  for (const def of ARTIFACT_DEFINITIONS) {
    if (def.phase !== currentPhase) {
      currentPhase = def.phase;
      console.log(`    ${PHASE_LABELS[currentPhase]}`);
    }

    const found = foundByName.get(def.name);
    if (found) {
      console.log(`      ${chalk.green("*")} ${def.name} (${found.filename})`);
    } else {
      const suffix = def.required ? " (required)" : "";
      console.log(`      ${chalk.dim("-")} ${def.name}${suffix}`);
    }
  }
}

function formatStatus(status: string): string {
  switch (status) {
    case "planning":
      return chalk.blue("planning");
    case "implementing":
      return chalk.yellow("implementing");
    case "completed":
      return chalk.green("completed");
    default:
      return status;
  }
}

function formatRalphStatus(status: string): string {
  switch (status) {
    case "running":
      return chalk.yellow("running");
    case "blocked":
      return chalk.red("blocked");
    case "completed":
      return chalk.green("completed");
    case "not_started":
      return chalk.dim("not started");
    default:
      return status;
  }
}

function getNextAction(
  phase: number,
  status: string,
  ralphStatus: { status: string } | null,
  platform: Platform
): string | null {
  if (status === "completed") {
    return null;
  }

  switch (phase) {
    case 1:
      return "Run /analyst to start analysis";
    case 2:
      return "Run /pm to create PRD";
    case 3:
      return "Run: bmalph implement";
    case 4:
      if (!ralphStatus || ralphStatus.status === "not_started") {
        if (platform.tier === "full") {
          return "Start Ralph loop with: bmalph run";
        }
        return "Ralph requires a full-tier platform (Claude Code or Codex)";
      }
      if (ralphStatus.status === "blocked") {
        return "Review Ralph logs: bmalph doctor";
      }
      if (ralphStatus.status === "running") {
        return "Ralph is running. Check logs in .ralph/logs/";
      }
      return null;
    default:
      return null;
  }
}
