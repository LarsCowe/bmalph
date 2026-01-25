import { describe, it, expect } from "vitest";
import { validateConfig, validateState } from "../../src/utils/validate.js";

describe("validateConfig", () => {
  it("accepts a valid config", () => {
    const data = {
      name: "my-project",
      description: "A test project",
      createdAt: "2025-01-01T00:00:00.000Z",
    };

    const result = validateConfig(data);
    expect(result).toEqual(data);
  });

  it("throws when name is missing", () => {
    const data = { description: "test", createdAt: "2025-01-01T00:00:00.000Z" };
    expect(() => validateConfig(data)).toThrow(/name/i);
  });

  it("throws when name is not a string", () => {
    const data = { name: 123, description: "test", createdAt: "2025-01-01T00:00:00.000Z" };
    expect(() => validateConfig(data)).toThrow(/name/i);
  });

  it("throws when createdAt is missing", () => {
    const data = { name: "proj", description: "test" };
    expect(() => validateConfig(data)).toThrow(/createdAt/i);
  });

  it("throws when data is null", () => {
    expect(() => validateConfig(null)).toThrow();
  });

  it("throws when data is not an object", () => {
    expect(() => validateConfig("string")).toThrow();
  });

  it("allows empty description", () => {
    const data = { name: "proj", description: "", createdAt: "2025-01-01T00:00:00.000Z" };
    expect(validateConfig(data)).toEqual(data);
  });

  it("allows description to be missing (defaults to empty string)", () => {
    const data = { name: "proj", createdAt: "2025-01-01T00:00:00.000Z" };
    const result = validateConfig(data);
    expect(result.description).toBe("");
  });

  it("accepts upstreamVersions when present", () => {
    const data = {
      name: "proj",
      createdAt: "2025-01-01T00:00:00.000Z",
      upstreamVersions: {
        bmadCommit: "48881f86",
        ralphCommit: "019b8c73",
      },
    };
    const result = validateConfig(data);
    expect(result.upstreamVersions).toEqual({
      bmadCommit: "48881f86",
      ralphCommit: "019b8c73",
    });
  });

  it("allows upstreamVersions to be missing (defaults to undefined)", () => {
    const data = { name: "proj", createdAt: "2025-01-01T00:00:00.000Z" };
    const result = validateConfig(data);
    expect(result.upstreamVersions).toBeUndefined();
  });

  it("throws when upstreamVersions is not an object", () => {
    const data = {
      name: "proj",
      createdAt: "2025-01-01T00:00:00.000Z",
      upstreamVersions: "invalid",
    };
    expect(() => validateConfig(data)).toThrow(/upstreamVersions/i);
  });

  it("throws when upstreamVersions has invalid bmadCommit type", () => {
    const data = {
      name: "proj",
      createdAt: "2025-01-01T00:00:00.000Z",
      upstreamVersions: { bmadCommit: 123 },
    };
    expect(() => validateConfig(data)).toThrow(/bmadCommit/i);
  });

  it("throws when upstreamVersions has invalid ralphCommit type", () => {
    const data = {
      name: "proj",
      createdAt: "2025-01-01T00:00:00.000Z",
      upstreamVersions: { bmadCommit: "abc", ralphCommit: 456 },
    };
    expect(() => validateConfig(data)).toThrow(/ralphCommit/i);
  });
});

describe("validateState", () => {
  it("accepts a valid state", () => {
    const data = {
      currentPhase: 1,
      status: "planning",
      startedAt: "2025-01-01T00:00:00.000Z",
      lastUpdated: "2025-01-01T01:00:00.000Z",
    };

    const result = validateState(data);
    expect(result).toEqual(data);
  });

  it("throws when currentPhase is missing", () => {
    const data = { status: "planning", startedAt: "x", lastUpdated: "y" };
    expect(() => validateState(data)).toThrow(/currentPhase/i);
  });

  it("throws when currentPhase is not a number", () => {
    const data = { currentPhase: "one", status: "planning", startedAt: "x", lastUpdated: "y" };
    expect(() => validateState(data)).toThrow(/currentPhase/i);
  });

  it("throws when status is invalid", () => {
    const data = { currentPhase: 1, status: "invalid", startedAt: "x", lastUpdated: "y" };
    expect(() => validateState(data)).toThrow(/status/i);
  });

  it("throws when startedAt is missing", () => {
    const data = { currentPhase: 1, status: "planning", lastUpdated: "y" };
    expect(() => validateState(data)).toThrow(/startedAt/i);
  });

  it("throws when lastUpdated is missing", () => {
    const data = { currentPhase: 1, status: "planning", startedAt: "x" };
    expect(() => validateState(data)).toThrow(/lastUpdated/i);
  });

  it("throws when data is null", () => {
    expect(() => validateState(null)).toThrow();
  });

  it("accepts all valid statuses", () => {
    for (const status of ["planning", "implementing", "completed"]) {
      const data = { currentPhase: 1, status, startedAt: "x", lastUpdated: "y" };
      expect(validateState(data).status).toBe(status);
    }
  });
});
