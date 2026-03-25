import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = process.cwd();

function readDoc(path: string): string {
  return readFileSync(join(REPO_ROOT, path), "utf-8");
}

describe("documentation", () => {
  it("documents the current Cursor runtime contract in README", () => {
    const readme = readDoc("README.md");

    expect(readme).toContain("`cursor-agent -p --force --output-format json`");
    expect(readme).toContain("switches to `stream-json` only for live output");
    expect(readme).toContain(
      "Read `_bmad/COMMANDS.md` and ask Cursor to run the BMAD master agent"
    );
  });

  it("documents Cursor preflight and live-output behavior in the Ralph reference", () => {
    const reference = readDoc("ralph/RALPH-REFERENCE.md");

    expect(reference).toContain("background loop execution stays on `json` output");
    expect(reference).toContain("switches to `stream-json` for live display");
    expect(reference).toContain("`command -v jq`");
    expect(reference).toContain("`cursor-agent status`");
  });

  it("documents Cursor-specific code paths in contributor docs", () => {
    const contributing = readDoc("CONTRIBUTING.md");

    expect(contributing).toContain("src/platform/cursor-runtime-checks.ts");
    expect(contributing).toContain("tests/bash/");
  });
});
