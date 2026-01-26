import { writeFile, mkdir, rename } from "fs/promises";
import { join } from "path";
import { readJsonFile } from "./json.js";
import { validateState, validateRalphLoopStatus } from "./validate.js";

export interface BmalphState {
  currentPhase: number;
  status: "planning" | "implementing" | "completed";
  startedAt: string;
  lastUpdated: string;
}

export interface PhaseCommand {
  code: string;
  name: string;
  agent: string;
  description: string;
  required: boolean;
}

export interface PhaseInfo {
  name: string;
  agent: string;
  commands: PhaseCommand[];
}

const STATE_DIR = "bmalph/state";

export async function readState(projectDir: string): Promise<BmalphState | null> {
  const data = await readJsonFile<unknown>(join(projectDir, STATE_DIR, "current-phase.json"));
  if (data === null) return null;
  return validateState(data);
}

export async function writeState(projectDir: string, state: BmalphState): Promise<void> {
  await mkdir(join(projectDir, STATE_DIR), { recursive: true });
  const target = join(projectDir, STATE_DIR, "current-phase.json");
  // Use randomized tmp name to prevent race conditions during concurrent writes
  const tmp = `${target}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  await writeFile(tmp, JSON.stringify(state, null, 2) + "\n");
  await rename(tmp, target);
}

export function getPhaseLabel(phase: number): string {
  const labels: Record<number, string> = {
    1: "Analysis",
    2: "Planning",
    3: "Solutioning",
    4: "Implementation",
  };
  return labels[phase] ?? "Unknown";
}

export function getPhaseInfo(phase: number): PhaseInfo {
  const info: Record<number, PhaseInfo> = {
    1: {
      name: "Analysis",
      agent: "Analyst",
      commands: [
        { code: "BP", name: "Brainstorm Project", agent: "analyst", description: "Expert guided facilitation through brainstorming techniques", required: false },
        { code: "MR", name: "Market Research", agent: "analyst", description: "Market analysis, competitive landscape, customer needs", required: false },
        { code: "DR", name: "Domain Research", agent: "analyst", description: "Industry domain deep dive, subject matter expertise", required: false },
        { code: "TR", name: "Technical Research", agent: "analyst", description: "Technical feasibility, architecture options", required: false },
        { code: "CB", name: "Create Brief", agent: "analyst", description: "Guided experience to nail down your product idea", required: false },
        { code: "VB", name: "Validate Brief", agent: "analyst", description: "Validates product brief completeness", required: false },
      ],
    },
    2: {
      name: "Planning",
      agent: "PM (John)",
      commands: [
        { code: "CP", name: "Create PRD", agent: "pm", description: "Expert led facilitation to produce your PRD", required: true },
        { code: "VP", name: "Validate PRD", agent: "pm", description: "Validate PRD is comprehensive and cohesive", required: false },
        { code: "CU", name: "Create UX", agent: "ux-designer", description: "Guidance through realizing the plan for your UX", required: false },
        { code: "VU", name: "Validate UX", agent: "ux-designer", description: "Validates UX design deliverables", required: false },
      ],
    },
    3: {
      name: "Solutioning",
      agent: "Architect",
      commands: [
        { code: "CA", name: "Create Architecture", agent: "architect", description: "Guided workflow to document technical decisions", required: true },
        { code: "VA", name: "Validate Architecture", agent: "architect", description: "Validates architecture completeness", required: false },
        { code: "CE", name: "Create Epics and Stories", agent: "pm", description: "Create the epics and stories listing", required: true },
        { code: "VE", name: "Validate Epics and Stories", agent: "pm", description: "Validates epics and stories completeness", required: false },
        { code: "TD", name: "Test Design", agent: "tea", description: "Create comprehensive test scenarios", required: false },
        { code: "IR", name: "Implementation Readiness", agent: "architect", description: "Ensure PRD, UX, architecture, and stories are aligned", required: true },
      ],
    },
    4: {
      name: "Implementation",
      agent: "Developer (Amelia)",
      commands: [],
    },
  };
  return info[phase] ?? { name: "Unknown", agent: "Unknown", commands: [] };
}

export interface RalphStatus {
  loopCount: number;
  status: "running" | "blocked" | "completed" | "not_started";
  tasksCompleted: number;
  tasksTotal: number;
}

const DEFAULT_RALPH_STATUS: RalphStatus = {
  loopCount: 0,
  status: "not_started",
  tasksCompleted: 0,
  tasksTotal: 0,
};

export async function readRalphStatus(projectDir: string): Promise<RalphStatus> {
  const data = await readJsonFile<unknown>(join(projectDir, ".ralph/status.json"));
  if (data === null) {
    return DEFAULT_RALPH_STATUS;
  }
  try {
    return validateRalphLoopStatus(data);
  } catch {
    // Return defaults if validation fails (corrupted/malformed file)
    return DEFAULT_RALPH_STATUS;
  }
}
