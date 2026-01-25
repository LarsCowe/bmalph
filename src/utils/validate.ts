import type { BmalphConfig, UpstreamVersions } from "./config.js";
import type { BmalphState } from "./state.js";

const VALID_STATUSES = ["planning", "implementing", "completed"] as const;

function assertObject(data: unknown, label: string): asserts data is Record<string, unknown> {
  if (data === null || data === undefined || typeof data !== "object" || Array.isArray(data)) {
    throw new Error(`${label}: expected an object`);
  }
}

function validateUpstreamVersions(data: unknown): UpstreamVersions {
  assertObject(data, "upstreamVersions");

  if (typeof data.bmadCommit !== "string") {
    throw new Error("upstreamVersions.bmadCommit must be a string");
  }

  if (typeof data.ralphCommit !== "string") {
    throw new Error("upstreamVersions.ralphCommit must be a string");
  }

  return {
    bmadCommit: data.bmadCommit,
    ralphCommit: data.ralphCommit,
  };
}

export function validateConfig(data: unknown): BmalphConfig {
  assertObject(data, "config");

  if (typeof data.name !== "string") {
    throw new Error("config.name must be a string");
  }

  if (typeof data.createdAt !== "string") {
    throw new Error("config.createdAt must be a string");
  }

  const description = typeof data.description === "string" ? data.description : "";

  const upstreamVersions =
    data.upstreamVersions !== undefined ? validateUpstreamVersions(data.upstreamVersions) : undefined;

  return {
    name: data.name,
    description,
    createdAt: data.createdAt,
    upstreamVersions,
  };
}

export function validateState(data: unknown): BmalphState {
  assertObject(data, "state");

  if (typeof data.currentPhase !== "number") {
    throw new Error("state.currentPhase must be a number");
  }

  if (typeof data.status !== "string" || !VALID_STATUSES.includes(data.status as typeof VALID_STATUSES[number])) {
    throw new Error(`state.status must be one of: ${VALID_STATUSES.join(", ")}`);
  }

  if (typeof data.startedAt !== "string") {
    throw new Error("state.startedAt must be a string");
  }

  if (typeof data.lastUpdated !== "string") {
    throw new Error("state.lastUpdated must be a string");
  }

  return {
    currentPhase: data.currentPhase,
    status: data.status as BmalphState["status"],
    startedAt: data.startedAt,
    lastUpdated: data.lastUpdated,
  };
}
