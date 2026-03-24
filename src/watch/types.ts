export interface LoopInfo {
  loopCount: number;
  status: string;
  lastAction: string;
  callsMadeThisHour: number;
  maxCallsPerHour: number;
}

export interface CircuitBreakerInfo {
  state: "CLOSED" | "HALF_OPEN" | "OPEN";
  consecutiveNoProgress: number;
  totalOpens: number;
  reason?: string;
}

export interface StoryProgress {
  completed: number;
  total: number;
  nextStory: string | null;
}

export interface AnalysisInfo {
  filesModified: number;
  formatConfidence: number;
  confidenceScore: number;
  isTestOnly: boolean;
  isStuck: boolean;
  exitSignal: boolean;
  tasksCompletedThisLoop: number;
  fixPlanCompletedDelta: number;
  hasProgressTrackingMismatch: boolean;
  hasPermissionDenials: boolean;
  permissionDenialCount: number;
}

export interface ExecutionProgress {
  status: "executing" | "idle";
  elapsedSeconds: number;
  indicator: string;
  lastOutput: string;
}

export interface SessionInfo {
  createdAt: string;
  lastUsed?: string;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
}

export interface ReviewInfo {
  issuesFound: number;
  severity: string;
  summary: string;
}

export interface DashboardState {
  loop: LoopInfo | null;
  circuitBreaker: CircuitBreakerInfo | null;
  stories: StoryProgress | null;
  analysis: AnalysisInfo | null;
  execution: ExecutionProgress | null;
  session: SessionInfo | null;
  review: ReviewInfo | null;
  recentLogs: LogEntry[];
  liveLog: string[];
  ralphCompleted: boolean;
  lastUpdated: Date;
}

export interface WatchOptions {
  interval: number;
  projectDir: string;
}
