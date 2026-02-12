import { vi } from "vitest";

const identity = (s: string): string => s;

const chalk = {
  red: vi.fn(identity),
  green: vi.fn(identity),
  blue: vi.fn(identity),
  yellow: vi.fn(identity),
  cyan: vi.fn(identity),
  white: vi.fn(identity),
  bold: vi.fn(identity),
  dim: vi.fn(identity),
};

export default chalk;
