import chalk from "chalk";
import { withErrorHandling } from "../utils/errors.js";
import { resolveProjectPlatform } from "../platform/resolve.js";
import type { Platform } from "../platform/types.js";
import {
  checkNodeVersion,
  checkBash,
  checkGitRepo,
  checkJq,
  checkConfig,
  checkBmadDir,
  checkRalphLoop,
  checkRalphLib,
} from "./doctor-checks.js";
import {
  checkGitignore,
  checkVersionMarker,
  checkUpstreamVersions,
} from "./doctor-health-checks.js";
import {
  checkCircuitBreaker,
  checkRalphSession,
  checkApiCalls,
  checkUpstreamGitHubStatus,
} from "./doctor-runtime-checks.js";

export interface CheckResult {
  label: string;
  passed: boolean;
  detail?: string;
  hint?: string;
}

export type CheckFunction = (projectDir: string) => CheckResult | Promise<CheckResult>;

export interface CheckDefinition {
  id: string;
  run: CheckFunction;
}

interface DoctorOptions {
  json?: boolean;
  projectDir: string;
}

interface DoctorResult {
  passed: number;
  failed: number;
}

export async function doctorCommand(options: DoctorOptions): Promise<void> {
  await withErrorHandling(async () => {
    const { failed } = await runDoctor(options);
    if (failed > 0) {
      process.exitCode = 1;
    }
  });
}

export async function runDoctor(
  options: DoctorOptions,
  checksOverride?: CheckDefinition[]
): Promise<DoctorResult> {
  const projectDir = options.projectDir;
  let checks: CheckDefinition[];
  if (checksOverride) {
    checks = checksOverride;
  } else {
    const platform = await resolveProjectPlatform(projectDir);
    checks = buildCheckRegistry(platform);
  }
  const results: CheckResult[] = [];

  for (const check of checks) {
    results.push(await check.run(projectDir));
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  if (options.json) {
    const output = {
      results: results.map((r) => ({
        label: r.label,
        passed: r.passed,
        ...(r.detail && { detail: r.detail }),
        ...(r.hint && { hint: r.hint }),
      })),
      summary: { passed, failed, total: results.length },
    };
    console.log(JSON.stringify(output, null, 2));
    return { passed, failed };
  }

  console.log(chalk.bold("bmalph doctor\n"));

  for (const r of results) {
    const icon = r.passed ? chalk.green("\u2713") : chalk.red("\u2717");
    const detail = r.detail ? chalk.dim(` (${r.detail})`) : "";
    console.log(`  ${icon} ${r.label}${detail}`);
    if (!r.passed && r.hint) {
      console.log(chalk.yellow(`     → ${r.hint}`));
    }
  }

  console.log("");

  if (failed === 0) {
    console.log(chalk.green(`${passed} passed, all checks OK`));
  } else {
    console.log(`${chalk.green(`${passed} passed`)}, ${chalk.red(`${failed} failed`)}`);
  }

  return { passed, failed };
}

const CORE_CHECKS: CheckDefinition[] = [
  { id: "node-version", run: checkNodeVersion },
  { id: "bash-available", run: checkBash },
  { id: "git-repo", run: checkGitRepo },
  { id: "jq-available", run: checkJq },
  { id: "config-valid", run: checkConfig },
  { id: "bmad-dir", run: checkBmadDir },
  { id: "ralph-loop", run: checkRalphLoop },
  { id: "ralph-lib", run: checkRalphLib },
];

const TRAILING_CHECKS: CheckDefinition[] = [
  { id: "gitignore", run: checkGitignore },
  { id: "version-marker", run: checkVersionMarker },
  { id: "upstream-versions", run: checkUpstreamVersions },
  { id: "circuit-breaker", run: checkCircuitBreaker },
  { id: "ralph-session", run: checkRalphSession },
  { id: "api-calls", run: checkApiCalls },
  { id: "upstream-github", run: checkUpstreamGitHubStatus },
];

export function buildCheckRegistry(platform: Platform): CheckDefinition[] {
  const platformChecks: CheckDefinition[] = platform.getDoctorChecks().map((pc) => ({
    id: pc.id,
    run: async (projectDir: string) => {
      const result = await pc.check(projectDir);
      return {
        label: pc.label,
        passed: result.passed,
        detail: result.detail,
        hint: result.hint,
      };
    },
  }));

  return [...CORE_CHECKS, ...platformChecks, ...TRAILING_CHECKS];
}
