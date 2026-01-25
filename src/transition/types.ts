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

export interface SpecsChange {
  file: string;
  status: "added" | "modified" | "removed";
  summary?: string;
}

export interface TransitionResult {
  storiesCount: number;
  warnings: string[];
  fixPlanPreserved: boolean;
}
