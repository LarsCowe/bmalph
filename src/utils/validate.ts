import type { BmalphConfig } from "./config.js";
import type { BmalphState } from "./state.js";

const VALID_STATUSES = ["planning", "implementing", "completed"] as const;

function assertObject(data: unknown, label: string): asserts data is Record<string, unknown> {
  if (data === null || data === undefined || typeof data !== "object" || Array.isArray(data)) {
    throw new Error(`${label}: expected an object`);
  }
}

export function validateConfig(data: unknown): BmalphConfig {
  assertObject(data, "config");

  if (typeof data.name !== "string") {
    throw new Error("config.name must be a string");
  }

  if (data.level === undefined || typeof data.level !== "number") {
    throw new Error("config.level must be a number");
  }

  if (data.level < 0 || data.level > 4) {
    throw new Error("config.level must be between 0 and 4");
  }

  if (typeof data.createdAt !== "string") {
    throw new Error("config.createdAt must be a string");
  }

  const description = typeof data.description === "string" ? data.description : "";

  return {
    name: data.name,
    description,
    level: data.level,
    createdAt: data.createdAt,
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
