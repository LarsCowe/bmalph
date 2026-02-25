import { readDashboardState } from "./state-reader.js";
import { renderDashboard } from "./renderer.js";
import { FileWatcher } from "./file-watcher.js";
import type { WatchOptions } from "./types.js";

const CLEAR_SCREEN = "\x1B[2J\x1B[H";
const HIDE_CURSOR = "\x1B[?25l";
const SHOW_CURSOR = "\x1B[?25h";

export function createRefreshCallback(
  projectDir: string,
  write: (s: string) => void
): () => Promise<void> {
  return async (): Promise<void> => {
    const state = await readDashboardState(projectDir);
    const output = renderDashboard(state);
    write(CLEAR_SCREEN + output + "\n");
  };
}

export function setupTerminal(): () => void {
  if (process.stdout.isTTY) {
    process.stdout.write(HIDE_CURSOR);
  }

  return (): void => {
    if (process.stdout.isTTY) {
      process.stdout.write(SHOW_CURSOR);
    }
    if (process.stdin.isTTY && process.stdin.setRawMode) {
      process.stdin.setRawMode(false);
    }
    process.stdin.pause();
  };
}

export async function startDashboard(options: WatchOptions): Promise<void> {
  const { projectDir, interval } = options;

  const cleanup = setupTerminal();
  const refresh = createRefreshCallback(projectDir, (s) => process.stdout.write(s));
  const watcher = new FileWatcher(refresh, interval);

  return new Promise<void>((resolve) => {
    const stop = (): void => {
      watcher.stop();
      cleanup();
      resolve();
    };

    if (process.stdin.isTTY && process.stdin.setRawMode) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding("utf-8");
      process.stdin.on("data", (data: string) => {
        if (data === "q" || data === "\x03") {
          stop();
        }
      });
    }

    const onResize = (): void => {
      void refresh();
    };
    process.stdout.on("resize", onResize);

    const onSignal = (): void => {
      stop();
    };
    process.on("SIGINT", onSignal);
    process.on("SIGTERM", onSignal);

    watcher.start();
  });
}
