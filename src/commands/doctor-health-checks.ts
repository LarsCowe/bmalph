import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { readConfig } from "../utils/config.js";
import { parseGitignoreLines } from "../utils/file-system.js";
import { getBundledVersions } from "../installer.js";
import { isEnoent, formatError } from "../utils/errors.js";
import type { CheckResult } from "./doctor.js";

export async function checkGitignore(projectDir: string): Promise<CheckResult> {
  const label = ".gitignore has required entries";
  const required = [".ralph/logs/", "_bmad-output/"];
  try {
    const content = await readFile(join(projectDir, ".gitignore"), "utf-8");
    const existingLines = parseGitignoreLines(content);
    const missing = required.filter((e) => !existingLines.has(e));
    if (missing.length === 0) {
      return { label, passed: true };
    }
    return {
      label,
      passed: false,
      detail: `missing: ${missing.join(", ")}`,
      hint: `Add to .gitignore: ${missing.join(" ")}`,
    };
  } catch (err) {
    if (isEnoent(err)) {
      return {
        label,
        passed: false,
        detail: ".gitignore not found",
        hint: "Create .gitignore with: .ralph/logs/ _bmad-output/",
      };
    }
    return {
      label,
      passed: false,
      detail: `error: ${formatError(err)}`,
      hint: "Check file permissions on .gitignore",
    };
  }
}

export async function checkVersionMarker(projectDir: string): Promise<CheckResult> {
  const label = "version marker matches";
  const hint = "Run: bmalph upgrade";
  try {
    const content = await readFile(join(projectDir, ".ralph/ralph_loop.sh"), "utf-8");
    const match = content.match(/# bmalph-version: (.+)/);
    if (!match) {
      return { label, passed: true, detail: "no marker (pre-0.8.0 install)" };
    }
    const { getPackageVersion } = await import("../installer.js");
    const current = await getPackageVersion();
    if (match[1]!.trim() === current) {
      return { label, passed: true, detail: `v${current}` };
    }
    return {
      label,
      passed: false,
      detail: `installed: ${match[1]!.trim()}, current: ${current}`,
      hint,
    };
  } catch (err) {
    if (isEnoent(err)) {
      return { label, passed: true, detail: "no marker found" };
    }
    return { label, passed: false, detail: `error: ${formatError(err)}`, hint };
  }
}

export async function checkUpstreamVersions(projectDir: string): Promise<CheckResult> {
  const label = "upstream versions tracked";
  const hint = "Run: bmalph upgrade";
  try {
    const config = await readConfig(projectDir);
    if (!config) {
      return { label, passed: false, detail: "config not found", hint: "Run: bmalph init" };
    }
    if (!config.upstreamVersions) {
      return { label, passed: true, detail: "not tracked (pre-1.2.0 install)" };
    }
    const bundled = await getBundledVersions();
    const { bmadCommit } = config.upstreamVersions;
    const bmadMatch = bmadCommit === bundled.bmadCommit;
    if (bmadMatch) {
      return {
        label,
        passed: true,
        detail: `BMAD:${bmadCommit.slice(0, 8)}`,
      };
    }
    return {
      label,
      passed: false,
      detail: `outdated: BMAD:${bmadCommit.slice(0, 8)}→${bundled.bmadCommit.slice(0, 8)}`,
      hint,
    };
  } catch (err) {
    return { label, passed: false, detail: `error: ${formatError(err)}`, hint };
  }
}
