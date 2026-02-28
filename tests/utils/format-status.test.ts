import { describe, it, expect } from "vitest";
import { formatStatus } from "../../src/utils/format-status.js";

describe("formatStatus", () => {
  it("returns styled string for 'planning'", () => {
    const result = formatStatus("planning");
    expect(result).toContain("planning");
  });

  it("returns styled string for 'implementing'", () => {
    const result = formatStatus("implementing");
    expect(result).toContain("implementing");
  });

  it("returns styled string for 'running'", () => {
    const result = formatStatus("running");
    expect(result).toContain("running");
  });

  it("returns styled string for 'completed'", () => {
    const result = formatStatus("completed");
    expect(result).toContain("completed");
  });

  it("returns styled string for 'success'", () => {
    const result = formatStatus("success");
    expect(result).toContain("success");
  });

  it("returns styled string for 'halted'", () => {
    const result = formatStatus("halted");
    expect(result).toContain("halted");
  });

  it("returns styled string for 'stopped'", () => {
    const result = formatStatus("stopped");
    expect(result).toContain("stopped");
  });

  it("returns styled string for 'blocked'", () => {
    const result = formatStatus("blocked");
    expect(result).toContain("blocked");
  });

  it("transforms not_started to human-readable form", () => {
    const result = formatStatus("not_started");
    expect(result).toContain("not started");
  });

  it("passes through unknown status values unchanged", () => {
    const result = formatStatus("unknown-status");
    expect(result).toBe("unknown-status");
  });
});
