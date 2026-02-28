import type { ChildProcess } from "node:child_process";

export type RalphProcessState = "running" | "stopped" | "detached";

export interface RalphProcess {
  readonly child: ChildProcess;
  state: RalphProcessState;
  exitCode: number | null;
  kill(): void;
  detach(): void;
  onExit(callback: (code: number | null) => void): void;
}
