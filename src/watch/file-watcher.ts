import { debug } from "../utils/logger.js";
import { formatError } from "../utils/errors.js";

export class FileWatcher {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private readonly intervalMs: number;
  private readonly callback: () => void | Promise<void>;

  constructor(callback: () => void | Promise<void>, intervalMs: number = 2000) {
    this.callback = callback;
    this.intervalMs = intervalMs;
  }

  start(): void {
    void this.tick();
    this.intervalId = setInterval(() => void this.tick(), this.intervalMs);
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async tick(): Promise<void> {
    try {
      await this.callback();
    } catch (err) {
      debug(`Watcher tick failed: ${formatError(err)}`);
    }
  }
}
