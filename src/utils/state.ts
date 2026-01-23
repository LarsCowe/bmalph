import { readFile, writeFile } from "fs/promises";
import { join } from "path";

export interface PhaseState {
  currentPhase: number;
  iteration: number;
  status: "running" | "paused" | "completed";
  startedAt: string;
  lastUpdated: string;
}

export interface PhaseTask {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "completed" | "blocked";
  priority: number;
  description?: string;
}

const STATE_DIR = "bmalph/state";

export async function readPhaseState(projectDir: string): Promise<PhaseState | null> {
  try {
    const content = await readFile(join(projectDir, STATE_DIR, "current-phase.json"), "utf-8");
    return JSON.parse(content) as PhaseState;
  } catch {
    return null;
  }
}

export async function writePhaseState(projectDir: string, state: PhaseState): Promise<void> {
  await writeFile(
    join(projectDir, STATE_DIR, "current-phase.json"),
    JSON.stringify(state, null, 2) + "\n"
  );
}

export async function readPhaseTasks(projectDir: string, phase: number): Promise<PhaseTask[]> {
  try {
    const content = await readFile(
      join(projectDir, STATE_DIR, `phase-${phase}-tasks.json`),
      "utf-8"
    );
    return JSON.parse(content) as PhaseTask[];
  } catch {
    return [];
  }
}

export async function writePhaseTasks(
  projectDir: string,
  phase: number,
  tasks: PhaseTask[]
): Promise<void> {
  await writeFile(
    join(projectDir, STATE_DIR, `phase-${phase}-tasks.json`),
    JSON.stringify(tasks, null, 2) + "\n"
  );
}

export function getPhaseLabel(phase: number): string {
  const labels: Record<number, string> = {
    1: "Analysis",
    2: "Planning",
    3: "Design",
    4: "Implementation",
  };
  return labels[phase] ?? "Unknown";
}
