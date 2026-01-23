import { cp, mkdir, readFile, writeFile, access } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function getScaffoldDir(): string {
  return join(__dirname, "..", "scaffold");
}

export async function scaffoldProject(projectDir: string): Promise<void> {
  const scaffoldDir = getScaffoldDir();

  // Create bmalph directory structure
  const dirs = [
    "bmalph/state",
    "bmalph/artifacts/analysis",
    "bmalph/artifacts/planning",
    "bmalph/artifacts/design",
    "bmalph/artifacts/implementation",
  ];

  for (const dir of dirs) {
    await mkdir(join(projectDir, dir), { recursive: true });
  }

  // Copy scaffold files
  await cp(join(scaffoldDir, "agents"), join(projectDir, "bmalph/agents"), { recursive: true });
  await cp(join(scaffoldDir, "prompts"), join(projectDir, "bmalph/prompts"), { recursive: true });
  await cp(join(scaffoldDir, "templates"), join(projectDir, "bmalph/templates"), {
    recursive: true,
  });
  await cp(join(scaffoldDir, "bmalph.sh"), join(projectDir, "bmalph/bmalph.sh"));

  // Copy skills
  const skillDirs = [
    "bmalph",
    "bmalph-analyze",
    "bmalph-plan",
    "bmalph-design",
    "bmalph-implement",
    "bmalph-quick",
  ];

  await mkdir(join(projectDir, ".claude/skills"), { recursive: true });
  for (const skill of skillDirs) {
    await cp(
      join(scaffoldDir, "skills", skill),
      join(projectDir, `.claude/skills/${skill}`),
      { recursive: true }
    );
  }
}

export async function mergeClaudeMd(projectDir: string): Promise<void> {
  const claudeMdPath = join(projectDir, "CLAUDE.md");
  const snippet = `
## BMALPH Framework

This project uses the BMALPH framework for structured AI development.

- Use \`/bmalph\` to interact with the framework
- Use \`bmalph start\` to run the autonomous loop
- Use \`bmalph status\` to check progress
- State is stored in \`bmalph/state/\`
- Artifacts are stored in \`bmalph/artifacts/\`
`;

  let existing = "";
  try {
    existing = await readFile(claudeMdPath, "utf-8");
  } catch {
    // File doesn't exist, that's fine
  }

  if (existing.includes("## BMALPH Framework")) {
    return; // Already merged
  }

  await writeFile(claudeMdPath, existing + snippet);
}

export async function isInitialized(projectDir: string): Promise<boolean> {
  try {
    await access(join(projectDir, "bmalph/config.json"));
    return true;
  } catch {
    return false;
  }
}
