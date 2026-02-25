import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { FileWatcher } from "../../src/watch/file-watcher.js";

describe("FileWatcher", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls callback immediately on start", () => {
    const callback = vi.fn();
    const watcher = new FileWatcher(callback);

    watcher.start();
    watcher.stop();

    expect(callback).toHaveBeenCalledOnce();
  });

  it("calls callback on each interval tick", async () => {
    const callback = vi.fn();
    const watcher = new FileWatcher(callback, 2000);

    watcher.start();
    expect(callback).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(2000);
    expect(callback).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(2000);
    expect(callback).toHaveBeenCalledTimes(3);

    watcher.stop();
  });

  it("stops polling on stop()", async () => {
    const callback = vi.fn();
    const watcher = new FileWatcher(callback, 1000);

    watcher.start();
    expect(callback).toHaveBeenCalledTimes(1);

    watcher.stop();

    await vi.advanceTimersByTimeAsync(3000);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("does not call callback after stop even across multiple intervals", async () => {
    const callback = vi.fn();
    const watcher = new FileWatcher(callback, 500);

    watcher.start();
    await vi.advanceTimersByTimeAsync(500);
    expect(callback).toHaveBeenCalledTimes(2);

    watcher.stop();

    await vi.advanceTimersByTimeAsync(500);
    await vi.advanceTimersByTimeAsync(500);
    await vi.advanceTimersByTimeAsync(500);
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("handles callback errors gracefully", async () => {
    let callCount = 0;
    const callback = vi.fn(() => {
      callCount++;
      if (callCount === 2) {
        throw new Error("simulated dashboard read failure");
      }
    });
    const watcher = new FileWatcher(callback, 1000);

    watcher.start();
    expect(callback).toHaveBeenCalledTimes(1);

    // Second tick throws — watcher should survive
    await vi.advanceTimersByTimeAsync(1000);
    expect(callback).toHaveBeenCalledTimes(2);

    // Third tick should still fire
    await vi.advanceTimersByTimeAsync(1000);
    expect(callback).toHaveBeenCalledTimes(3);

    watcher.stop();
  });

  it("handles async callback errors gracefully", async () => {
    let callCount = 0;
    const callback = vi.fn(async () => {
      callCount++;
      if (callCount === 2) {
        throw new Error("simulated async failure");
      }
    });
    const watcher = new FileWatcher(callback, 1000);

    watcher.start();
    expect(callback).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(callback).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1000);
    expect(callback).toHaveBeenCalledTimes(3);

    watcher.stop();
  });

  it("uses custom interval", async () => {
    const callback = vi.fn();
    const watcher = new FileWatcher(callback, 5000);

    watcher.start();
    expect(callback).toHaveBeenCalledTimes(1);

    // Advance less than interval — no additional call
    await vi.advanceTimersByTimeAsync(4999);
    expect(callback).toHaveBeenCalledTimes(1);

    // Cross the interval boundary
    await vi.advanceTimersByTimeAsync(1);
    expect(callback).toHaveBeenCalledTimes(2);

    watcher.stop();
  });

  it("can be restarted after stop", async () => {
    const callback = vi.fn();
    const watcher = new FileWatcher(callback, 1000);

    watcher.start();
    expect(callback).toHaveBeenCalledTimes(1);

    watcher.stop();

    await vi.advanceTimersByTimeAsync(2000);
    expect(callback).toHaveBeenCalledTimes(1);

    watcher.start();
    expect(callback).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1000);
    expect(callback).toHaveBeenCalledTimes(3);

    watcher.stop();
  });

  it("defaults to 2000ms interval", async () => {
    const callback = vi.fn();
    const watcher = new FileWatcher(callback);

    watcher.start();
    expect(callback).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1999);
    expect(callback).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(callback).toHaveBeenCalledTimes(2);

    watcher.stop();
  });

  it("stop is idempotent", () => {
    const callback = vi.fn();
    const watcher = new FileWatcher(callback, 1000);

    watcher.start();
    watcher.stop();
    watcher.stop();
    watcher.stop();

    expect(callback).toHaveBeenCalledOnce();
  });
});
