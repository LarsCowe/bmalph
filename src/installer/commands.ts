import { cp, mkdir, readFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { atomicWriteFile } from "../utils/file-system.js";
import { isEnoent } from "../utils/errors.js";
import { CODEX_SKILLS_DIR, SKILLS_PREFIX } from "../utils/constants.js";
import type { Platform } from "../platform/types.js";
import type { ClassifiedCommand } from "./types.js";

interface CommandIndexEntry {
  name: string;
  description: string;
  invocation: string;
}

const AGENT_DESCRIPTIONS: Record<string, string> = {
  analyst: "Research, briefs, discovery",
  architect: "Technical design, architecture",
  pm: "PRDs, epics, stories",
  sm: "Sprint planning, status, coordination",
  dev: "Implementation, coding",
  "ux-designer": "User experience, wireframes",
  qa: "Test automation, quality assurance",
  "tech-writer": "Documentation, technical writing",
  "quick-flow-solo-dev": "Quick one-off tasks, small changes",
};

const BMALPH_COMMANDS: Record<string, { description: string; howToRun: string }> = {
  bmalph: {
    description: "BMAD master agent — navigate phases",
    howToRun: "Read and follow the master agent instructions in this file",
  },
  "bmalph-implement": {
    description: "Transition planning artifacts to Ralph format",
    howToRun: "Run `bmalph implement`",
  },
  "bmalph-status": {
    description: "Show current phase, Ralph progress, version info",
    howToRun: "Run `bmalph status`",
  },
  "bmalph-upgrade": {
    description: "Update bundled assets to current version",
    howToRun: "Run `bmalph upgrade`",
  },
  "bmalph-doctor": {
    description: "Check project health and report issues",
    howToRun: "Run `bmalph doctor`",
  },
  "bmalph-watch": {
    description: "Launch Ralph live dashboard",
    howToRun: "Run `bmalph run`",
  },
};

const PHASE_SECTIONS: Array<{ key: string; label: string }> = [
  { key: "1-analysis", label: "Phase 1: Analysis" },
  { key: "2-planning", label: "Phase 2: Planning" },
  { key: "3-solutioning", label: "Phase 3: Solutioning" },
  { key: "4-implementation", label: "Phase 4: Implementation" },
  { key: "anytime", label: "Utilities" },
];

// CSV column indices for bmad-help.csv
const CSV_COL_PHASE = 1;
const CSV_COL_NAME = 2;
const CSV_COL_WORKFLOW_FILE = 5;
const CSV_COL_DESCRIPTION = 10;

const FALLBACK_PHASE = "anytime";

/** CLI-pointer bmalph commands are all bmalph-* except the master "bmalph" command. */
function isCliPointer(cmd: ClassifiedCommand): boolean {
  return cmd.kind === "bmalph" && cmd.name !== "bmalph";
}

/**
 * Parse a CSV row handling double-quoted fields.
 */
function parseCsvRow(row: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const ch = row[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < row.length && row[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

/**
 * Deliver slash commands based on the platform's command delivery strategy.
 *
 * - "directory": Copy command files to a directory (e.g., .claude/commands/)
 * - "skills": No-op — commands are generated as skills by generateSkills()
 * - "index": No-op — commands are discoverable via _bmad/COMMANDS.md
 */
export async function deliverCommands(
  projectDir: string,
  platform: Platform,
  slashCommandsDir: string
): Promise<string[]> {
  const delivery = platform.commandDelivery;

  if (delivery.kind !== "directory") {
    return [];
  }

  const slashFiles = await readdir(slashCommandsDir);
  const bundledCommandNames = new Set(slashFiles.filter((f) => f.endsWith(".md")));

  const commandsDir = join(projectDir, delivery.dir);
  await mkdir(commandsDir, { recursive: true });

  // Clean stale bmalph-owned commands before copying (preserve user-created commands)
  try {
    const existingCommands = await readdir(commandsDir);
    for (const file of existingCommands) {
      if (file.endsWith(".md") && bundledCommandNames.has(file)) {
        await rm(join(commandsDir, file), { force: true });
      }
    }
  } catch (err) {
    if (!isEnoent(err)) throw err;
  }

  for (const file of bundledCommandNames) {
    await cp(join(slashCommandsDir, file), join(commandsDir, file), { dereference: false });
  }

  return [`${delivery.dir}/`];
}

/**
 * Classify all slash commands by reading CSV metadata and file contents.
 * Shared by generateCommandIndex() and generateSkills().
 */
export async function classifyCommands(
  projectDir: string,
  slashCmdsDir: string
): Promise<ClassifiedCommand[]> {
  const helpCsvPath = join(projectDir, "_bmad/_config/bmad-help.csv");
  const helpCsv = await readFile(helpCsvPath, "utf-8");

  // Parse CSV: build workflow-file → {phase, description} lookup
  const csvLines = helpCsv.trimEnd().split(/\r?\n/);
  const workflowLookup = new Map<string, { phase: string; description: string }>();
  for (const line of csvLines.slice(1)) {
    if (!line.trim()) continue;
    const fields = parseCsvRow(line);
    const workflowFile = fields[CSV_COL_WORKFLOW_FILE]?.trim();
    if (workflowFile) {
      workflowLookup.set(workflowFile, {
        phase: fields[CSV_COL_PHASE]?.trim() ?? FALLBACK_PHASE,
        description: fields[CSV_COL_DESCRIPTION]?.trim() ?? fields[CSV_COL_NAME]?.trim() ?? "",
      });
    }
  }

  // Read slash command files
  const slashFiles = (await readdir(slashCmdsDir)).filter((f) => f.endsWith(".md")).sort();
  const results: ClassifiedCommand[] = [];

  for (const file of slashFiles) {
    const name = file.replace(/\.md$/, "");
    const body = (await readFile(join(slashCmdsDir, file), "utf-8")).trim();
    const firstLine = body.split("\n")[0]!.trim();

    // Extract _bmad/ file references from content
    const fileRefs = [...body.matchAll(/`(_bmad\/[^`]+)`/g)].map((m) => m[1]!);
    const agentRef = fileRefs.find((ref) => ref.includes("/agents/"));
    const workflowRef = fileRefs.find(
      (ref) => ref.includes("/workflows/") || ref.includes("/tasks/")
    );

    // Classify: bmalph CLI commands
    if (name.startsWith("bmalph")) {
      const known = BMALPH_COMMANDS[name];
      const desc = known?.description ?? name.replace(/-/g, " ");
      const howToRun = known?.howToRun ?? `Run \`bmalph ${name.replace("bmalph-", "")}\``;
      results.push({
        name,
        description: desc,
        invocation: firstLine,
        body,
        kind: "bmalph",
        howToRun,
      });
      continue;
    }

    // Classify: workflow/task commands (matched via CSV)
    if (workflowRef) {
      // Try direct file-path lookup first
      let csv = workflowLookup.get(workflowRef);

      // Fallback: resolve _bmad/.../skill-name/workflow.md → skill:skill-name
      if (!csv) {
        const match = workflowRef.match(/\/([^/]+)\/workflow\.md$/);
        if (match) {
          csv = workflowLookup.get(`skill:${match[1]}`);
        }
      }

      if (csv) {
        results.push({
          name,
          description: csv.description,
          invocation: firstLine,
          body,
          kind: "workflow",
          phase: csv.phase,
        });
        continue;
      }
    }

    // Classify: pure agent commands
    if (agentRef && !workflowRef) {
      results.push({
        name,
        description: AGENT_DESCRIPTIONS[name] ?? name,
        invocation: firstLine,
        body,
        kind: "agent",
      });
      continue;
    }

    // Fallback: unmatched commands go to utilities
    results.push({
      name,
      description: name.replace(/-/g, " "),
      invocation: firstLine,
      body,
      kind: "utility",
      phase: FALLBACK_PHASE,
    });
  }

  return results;
}

/**
 * Generate _bmad/COMMANDS.md from pre-classified slash commands.
 * Provides command discoverability for platforms without native slash command support.
 */
export async function generateCommandIndex(
  projectDir: string,
  classified: ClassifiedCommand[]
): Promise<void> {
  const agents: CommandIndexEntry[] = [];
  const phaseGroups: Record<string, CommandIndexEntry[]> = {};
  const bmalpEntries: Array<{ name: string; description: string; howToRun: string }> = [];

  for (const cmd of classified) {
    if (cmd.kind === "bmalph") {
      bmalpEntries.push({
        name: cmd.name,
        description: cmd.description,
        howToRun: cmd.howToRun!,
      });
    } else if (cmd.kind === "agent") {
      agents.push({ name: cmd.name, description: cmd.description, invocation: cmd.invocation });
    } else if (cmd.kind === "workflow") {
      const phase = cmd.phase!;
      if (!phaseGroups[phase]) phaseGroups[phase] = [];
      phaseGroups[phase].push({
        name: cmd.name,
        description: cmd.description,
        invocation: cmd.invocation,
      });
    } else {
      const phase = cmd.phase ?? FALLBACK_PHASE;
      if (!phaseGroups[phase]) phaseGroups[phase] = [];
      phaseGroups[phase].push({
        name: cmd.name,
        description: cmd.description,
        invocation: cmd.invocation,
      });
    }
  }

  // Build markdown
  const sections: string[] = ["# BMAD Commands\n\n> Auto-generated by bmalph. Do not edit.\n"];

  if (agents.length > 0) {
    sections.push(formatCommandTable("Agents", agents));
  }

  for (const { key, label } of PHASE_SECTIONS) {
    const entries = phaseGroups[key];
    if (entries && entries.length > 0) {
      sections.push(formatCommandTable(label, entries));
    }
  }

  if (bmalpEntries.length > 0) {
    sections.push(
      formatCommandTable(
        "bmalph CLI",
        bmalpEntries.map((b) => ({
          name: b.name,
          description: b.description,
          invocation: b.howToRun,
        })),
        "How to run"
      )
    );
  }

  await atomicWriteFile(join(projectDir, "_bmad/COMMANDS.md"), sections.join("\n"));
}

/**
 * Generate Codex Skills from pre-classified slash commands.
 * Creates .agents/skills/bmad-<name>/SKILL.md for each non-CLI-pointer command.
 */
export async function generateSkills(
  projectDir: string,
  classified: ClassifiedCommand[],
  platform?: Platform
): Promise<void> {
  const delivery =
    platform?.commandDelivery.kind === "skills"
      ? platform.commandDelivery
      : {
          kind: "skills" as const,
          dir: CODEX_SKILLS_DIR,
          frontmatterName: "command" as const,
        };
  const skillsBaseDir = join(projectDir, delivery.dir);

  // Cleanup: remove existing bmad-* skill directories
  try {
    const existingDirs = await readdir(skillsBaseDir);
    for (const dir of existingDirs) {
      if (dir.startsWith(SKILLS_PREFIX)) {
        await rm(join(skillsBaseDir, dir), { recursive: true, force: true });
      }
    }
  } catch (err) {
    if (!isEnoent(err)) throw err;
  }

  // Generate skills for non-CLI-pointer commands
  for (const cmd of classified) {
    if (isCliPointer(cmd)) continue;

    const skillDir = join(skillsBaseDir, `${SKILLS_PREFIX}${cmd.name}`);
    await mkdir(skillDir, { recursive: true });
    const frontmatterName =
      delivery.frontmatterName === "directory" ? `${SKILLS_PREFIX}${cmd.name}` : cmd.name;

    const skillContent = `---
name: ${frontmatterName}
description: >
  ${cmd.description}. Use when the user asks about ${cmd.name.replace(/-/g, " ")}.
metadata:
  managed-by: bmalph
---

${cmd.body}
`;

    await atomicWriteFile(join(skillDir, "SKILL.md"), skillContent);
  }
}

function formatCommandTable(
  heading: string,
  entries: CommandIndexEntry[],
  thirdCol = "Invocation"
): string {
  const lines = [
    `## ${heading}\n`,
    `| Command | Description | ${thirdCol} |`,
    "|---------|-------------|------------|",
  ];
  for (const e of entries) {
    lines.push(`| ${e.name} | ${e.description} | ${e.invocation} |`);
  }
  return lines.join("\n") + "\n";
}
