import { createRefreshCallback } from "../watch/dashboard.js";
import { createTerminalFrameWriter } from "../watch/frame-writer.js";
import { FileWatcher } from "../watch/file-watcher.js";
import { renderFooterLine } from "../watch/renderer.js";
import type { RalphProcess, ReviewMode } from "./types.js";

export interface RunDashboardOptions {
  projectDir: string;
  interval: number;
  ralph: RalphProcess;
  reviewMode?: ReviewMode;
}

export function renderStatusBar(ralph: RalphProcess, reviewMode?: ReviewMode): string {
  const pid = ralph.child.pid ?? "?";
  const badge =
    reviewMode === "ultimate" ? " [ultimate]" : reviewMode === "enhanced" ? " [review]" : "";
  switch (ralph.state) {
    case "running":
      return `Ralph: running (PID ${pid})${badge} | q: stop/detach`;
    case "stopped":
      return `Ralph: stopped (exit ${ralph.exitCode ?? "?"}) | q: quit`;
    case "detached":
      return `Ralph: detached (PID ${pid})`;
  }
}

export function renderQuitPrompt(): string {
  return "Stop (s) | Detach (d) | Cancel (c)";
}

export async function startRunDashboard(options: RunDashboardOptions): Promise<void> {
  const { projectDir, interval, ralph, reviewMode } = options;

  const frameWriter = createTerminalFrameWriter();
  let showingPrompt = false;
  let stopped = false;
  const footerRenderer = (lastUpdated: Date, cols: number): string => {
    const leftText = showingPrompt ? renderQuitPrompt() : renderStatusBar(ralph, reviewMode);
    return renderFooterLine(leftText, `Updated: ${lastUpdated.toISOString().slice(11, 19)}`, cols);
  };

  const refresh = createRefreshCallback(
    projectDir,
    (frame) => {
      if (stopped) {
        return;
      }
      frameWriter.write(frame);
    },
    { footerRenderer }
  );
  const watcher = new FileWatcher(refresh, interval);

  ralph.onExit(() => {
    if (stopped) {
      return;
    }
    void refresh();
  });

  return new Promise<void>((resolve) => {
    let rawModeEnabled = false;

    const restoreStdin = (): void => {
      if (rawModeEnabled && process.stdin.isTTY && process.stdin.setRawMode) {
        process.stdin.setRawMode(false);
      }
      rawModeEnabled = false;
    };

    const onResize = (): void => {
      void refresh();
    };
    process.stdout.on("resize", onResize);

    const onSignal = (): void => {
      if (ralph.state === "running") {
        ralph.kill();
      }
      stop();
    };
    process.on("SIGINT", onSignal);
    process.on("SIGTERM", onSignal);
    process.on("exit", restoreStdin);

    const handleKey = (data: string): void => {
      if (showingPrompt) {
        handlePromptKey(data);
        return;
      }

      if (data === "q" || data === "\x03") {
        if (ralph.state === "running") {
          showingPrompt = true;
          void refresh();
        } else {
          stop();
        }
      }
    };

    const handlePromptKey = (data: string): void => {
      showingPrompt = false;
      if (data === "s") {
        if (ralph.state === "stopped") {
          stop();
        } else {
          ralph.onExit(() => stop());
          ralph.kill();
        }
      } else if (data === "d") {
        ralph.detach();
        stop();
      } else {
        void refresh();
      }
    };

    const stop = (): void => {
      if (stopped) {
        return;
      }
      stopped = true;
      watcher.stop();
      frameWriter.cleanup();
      process.removeListener("SIGINT", onSignal);
      process.removeListener("SIGTERM", onSignal);
      process.removeListener("exit", restoreStdin);
      process.stdout.removeListener("resize", onResize);
      if (process.stdin.isTTY) {
        process.stdin.removeListener("data", handleKey);
      }
      restoreStdin();
      resolve();
    };

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- setRawMode absent in pseudo-TTY
    if (process.stdin.isTTY && process.stdin.setRawMode) {
      process.stdin.setRawMode(true);
      rawModeEnabled = true;
      process.stdin.resume();
      process.stdin.setEncoding("utf-8");
      process.stdin.on("data", handleKey);
    } else {
      ralph.onExit(() => stop());
      if (ralph.state === "stopped") stop();
    }

    watcher.start();
  });
}
