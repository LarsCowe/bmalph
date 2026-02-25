import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("chalk");

vi.mock("../../src/watch/state-reader.js", () => ({
  readDashboardState: vi.fn(),
}));

vi.mock("../../src/watch/renderer.js", () => ({
  renderDashboard: vi.fn(),
}));

import type { DashboardState } from "../../src/watch/types.js";
import { readDashboardState } from "../../src/watch/state-reader.js";
import { renderDashboard } from "../../src/watch/renderer.js";
import { createRefreshCallback } from "../../src/watch/dashboard.js";

const mockReadState = vi.mocked(readDashboardState);
const mockRenderDashboard = vi.mocked(renderDashboard);

function makeEmptyState(): DashboardState {
  return {
    loop: null,
    circuitBreaker: null,
    stories: null,
    analysis: null,
    execution: null,
    session: null,
    recentLogs: [],
    lastUpdated: new Date("2026-02-25T14:25:15Z"),
  };
}

describe("createRefreshCallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reads state and renders dashboard", async () => {
    const state = makeEmptyState();
    mockReadState.mockResolvedValue(state);
    mockRenderDashboard.mockReturnValue("rendered output");

    const writeSpy = vi.fn();
    const refresh = createRefreshCallback("/test/project", writeSpy);
    await refresh();

    expect(mockReadState).toHaveBeenCalledWith("/test/project");
    expect(mockRenderDashboard).toHaveBeenCalledWith(state);
    expect(writeSpy).toHaveBeenCalledOnce();
    expect(writeSpy.mock.calls[0]![0]).toContain("rendered output");
  });

  it("includes clear screen escape sequence", async () => {
    mockReadState.mockResolvedValue(makeEmptyState());
    mockRenderDashboard.mockReturnValue("output");

    const writeSpy = vi.fn();
    const refresh = createRefreshCallback("/test/project", writeSpy);
    await refresh();

    const written = writeSpy.mock.calls[0]![0] as string;
    expect(written.startsWith("\x1B[2J\x1B[H")).toBe(true);
  });

  it("appends newline after render output", async () => {
    mockReadState.mockResolvedValue(makeEmptyState());
    mockRenderDashboard.mockReturnValue("dashboard");

    const writeSpy = vi.fn();
    const refresh = createRefreshCallback("/test/project", writeSpy);
    await refresh();

    const written = writeSpy.mock.calls[0]![0] as string;
    expect(written).toMatch(/dashboard\n$/);
  });

  it("renders state with loop info", async () => {
    const state = makeEmptyState();
    state.loop = {
      loopCount: 5,
      status: "running",
      lastAction: "analyzing",
      callsMadeThisHour: 10,
      maxCallsPerHour: 100,
    };
    mockReadState.mockResolvedValue(state);
    mockRenderDashboard.mockReturnValue("with loop");

    const writeSpy = vi.fn();
    const refresh = createRefreshCallback("/test/project", writeSpy);
    await refresh();

    expect(mockRenderDashboard).toHaveBeenCalledWith(state);
  });
});
