import type { FixPlanItemWithTitle } from "../transition/types.js";
import type { RalphProcess, ReviewMode } from "../run/types.js";

// =============================================================================
// Fix plan epic grouping (used by parser and partitioner)
// =============================================================================

export interface FixPlanEpicGroup {
  /** Full markdown block: heading + goal + all story lines with details. Used verbatim in worker fix plans. */
  rawBlock: string;
  /** Epic heading line, e.g. "### Epic 1: User Authentication" */
  epicHeading: string;
  /** Optional goal line, e.g. "Implement secure authentication" */
  epicGoal: string | null;
  /** Parsed story items — used for partitioning logic, not for plan regeneration */
  stories: FixPlanItemWithTitle[];
}

// =============================================================================
// Worker and swarm state
// =============================================================================

export type SwarmWorkerStatus = "pending" | "installing" | "running" | "done" | "error";

export interface SwarmWorker {
  id: number;
  worktreePath: string;
  branchName: string;
  assignedEpics: string[];
  epicGroups: FixPlanEpicGroup[];
  ralph: RalphProcess | null;
  status: SwarmWorkerStatus;
  completedAt: Date | null;
}

export type MergeStatus = "merged" | "conflict";

export interface MergeResult {
  workerId: number;
  status: MergeStatus;
  conflictFiles?: string[];
}

// =============================================================================
// Orchestrator options
// =============================================================================

export interface SwarmRunOptions {
  projectDir: string;
  platformId: string;
  reviewMode: ReviewMode;
  workerCount: number;
  // TODO: dashboard and interval fields deferred to swarm dashboard implementation
}
