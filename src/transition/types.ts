export interface ProjectContext {
  projectGoals: string;
  successMetrics: string;
  architectureConstraints: string;
  technicalRisks: string;
  scopeBoundaries: string;
  targetUsers: string;
  nonFunctionalRequirements: string;
}

export interface Story {
  epic: string;
  epicDescription: string;
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
}

export interface TechStack {
  setup: string;
  test: string;
  build: string;
  dev: string;
}

export interface FixPlanItem {
  id: string;
  completed: boolean;
}

export interface FixPlanItemWithTitle extends FixPlanItem {
  title?: string;
}

export interface TruncationInfo {
  field: string;
  originalLength: number;
  truncatedTo: number;
}

export interface SpecsChange {
  file: string;
  status: "added" | "modified" | "removed";
  summary?: string;
}

export type SpecFileType =
  | "prd"
  | "architecture"
  | "stories"
  | "ux"
  | "test-design"
  | "readiness"
  | "sprint"
  | "brainstorm"
  | "other";

export type Priority = "critical" | "high" | "medium" | "low";

export interface SpecFileMetadata {
  path: string;
  size: number;
  type: SpecFileType;
  priority: Priority;
  description: string;
}

export interface SpecsIndex {
  generatedAt: string;
  totalFiles: number;
  totalSizeKb: number;
  files: SpecFileMetadata[];
}

export interface TransitionResult {
  storiesCount: number;
  warnings: string[];
  fixPlanPreserved: boolean;
}
