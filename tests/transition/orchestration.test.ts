import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm, writeFile, readFile, access } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runTransition } from "../../src/transition/orchestration.js";
import { PreflightValidationError } from "../../src/transition/preflight.js";
import { readState } from "../../src/utils/state.js";

describe("orchestration", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(
      tmpdir(),
      `bmalph-orchestration-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await mkdir(join(testDir, "bmalph"), { recursive: true });
    await mkdir(join(testDir, ".ralph/specs"), { recursive: true });
    await writeFile(
      join(testDir, "bmalph/config.json"),
      JSON.stringify({ name: "test-project", createdAt: "2025-01-01T00:00:00.000Z" })
    );
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {
      // Windows file locking
    }
  });

  describe("phase state update (Bug #1)", () => {
    it("updates phase to 4 after successful transition", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: Core\n\n### Story 1.1: Feature\n\nDo something.\n`
      );

      await runTransition(testDir);

      const state = await readState(testDir);
      expect(state).not.toBeNull();
      expect(state!.currentPhase).toBe(4);
      expect(state!.status).toBe("implementing");
    });

    it("updates lastUpdated timestamp after transition", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: Core\n\n### Story 1.1: Feature\n\nDo something.\n`
      );

      const beforeTransition = new Date().toISOString();
      await runTransition(testDir);

      const state = await readState(testDir);
      expect(state).not.toBeNull();
      expect(new Date(state!.lastUpdated).getTime()).toBeGreaterThanOrEqual(
        new Date(beforeTransition).getTime()
      );
    });
  });

  describe("deleted story detection (Bug #2)", () => {
    it("warns when a completed story is removed from BMAD output", async () => {
      // Setup: existing fix_plan with completed story 1.1
      await writeFile(
        join(testDir, ".ralph/@fix_plan.md"),
        `# Fix Plan\n- [x] Story 1.1: Old Feature\n- [ ] Story 1.2: Other Feature\n`
      );

      // New BMAD output WITHOUT story 1.1
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: Core\n\n### Story 1.2: Other Feature\n\nDo something.\n`
      );

      const result = await runTransition(testDir);

      // Should warn about orphaned completed story
      expect(result.warnings).toContainEqual(
        expect.stringMatching(/completed.*story.*1\.1.*removed|orphan/i)
      );
    });

    it("does not warn when uncompleted stories are removed", async () => {
      // Setup: existing fix_plan with uncompleted story 1.1
      await writeFile(
        join(testDir, ".ralph/@fix_plan.md"),
        `# Fix Plan\n- [ ] Story 1.1: Old Feature\n- [ ] Story 1.2: Other Feature\n`
      );

      // New BMAD output WITHOUT story 1.1
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: Core\n\n### Story 1.2: Other Feature\n\nDo something.\n`
      );

      const result = await runTransition(testDir);

      // Should NOT warn about uncompleted stories
      expect(result.warnings).not.toContainEqual(
        expect.stringMatching(/completed.*story.*1\.1.*removed|orphan/i)
      );
    });
  });

  describe("story ID change detection (Bug #3)", () => {
    it("warns when completed story ID appears to have been renumbered", async () => {
      // Setup: story 1.1 completed with title "Login Feature"
      await writeFile(
        join(testDir, ".ralph/@fix_plan.md"),
        `# Fix Plan\n- [x] Story 1.1: Login Feature\n- [ ] Story 1.2: Signup\n`
      );

      // New BMAD output with same title but different ID (1.2 instead of 1.1)
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: Auth\n\n### Story 1.2: Login Feature\n\nUser login.\n\n### Story 1.3: Signup\n\nUser signup.\n`
      );

      const result = await runTransition(testDir);

      // Should warn about potential renumbering
      expect(result.warnings).toContainEqual(
        expect.stringMatching(/story.*1\.1.*renumber|id.*change|Login Feature.*moved/i)
      );
    });
  });

  describe("fix-plan spec links use detected stories filename (Bug #2b)", () => {
    it("uses detected stories filename in fix plan spec links", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/epics-and-stories.md"),
        `## Epic 1: Core\n\n### Story 1.1: Feature\n\nDo something.\n`
      );

      await runTransition(testDir);

      const fixPlan = await readFile(join(testDir, ".ralph/@fix_plan.md"), "utf-8");
      expect(fixPlan).toContain("specs/planning-artifacts/epics-and-stories.md#story-1-1");
      expect(fixPlan).not.toContain("planning-artifacts/stories.md#story");
    });

    it("uses stories.md in links when file is named stories.md", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: Core\n\n### Story 1.1: Feature\n\nDo something.\n`
      );

      await runTransition(testDir);

      const fixPlan = await readFile(join(testDir, ".ralph/@fix_plan.md"), "utf-8");
      expect(fixPlan).toContain("specs/planning-artifacts/stories.md#story-1-1");
    });
  });

  describe("canonical artifact aggregation", () => {
    it("aggregates stories from multiple epic files and preserves per-story source links", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/epics-login.md"),
        `## Epic 1: Auth

### Story 1.1: Sign in

User can sign in.

**Acceptance Criteria:**
**Given** a valid account
**When** credentials are submitted
**Then** access is granted
`
      );
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/epics-billing.md"),
        `## Epic 2: Billing

### Story 2.1: Sync invoices

Invoices can be synced.

**Acceptance Criteria:**
**Given** a connected gateway
**When** sync runs
**Then** invoices are imported
`
      );

      const result = await runTransition(testDir);
      const fixPlan = await readFile(join(testDir, ".ralph/@fix_plan.md"), "utf-8");

      expect(result.storiesCount).toBe(2);
      expect(fixPlan).toContain("specs/planning-artifacts/epics-login.md#story-1-1");
      expect(fixPlan).toContain("specs/planning-artifacts/epics-billing.md#story-2-1");
      expect(fixPlan.indexOf("Story 1.1")).toBeLessThan(fixPlan.indexOf("Story 2.1"));
    });

    it("discovers stories from sharded epic directories", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts/epics"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/epics/epic-1.md"),
        `## Epic 1: Auth

### Story 1.1: Sign in

User can sign in.

**Acceptance Criteria:**
**Given** a valid account
**When** credentials are submitted
**Then** access is granted
`
      );
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/epics/epic-2.md"),
        `## Epic 2: Billing

### Story 2.1: Sync invoices

Invoices can be synced.

**Acceptance Criteria:**
**Given** a connected gateway
**When** sync runs
**Then** invoices are imported
`
      );

      const result = await runTransition(testDir);
      const fixPlan = await readFile(join(testDir, ".ralph/@fix_plan.md"), "utf-8");

      expect(result.storiesCount).toBe(2);
      expect(fixPlan).toContain("specs/planning-artifacts/epics/epic-1.md#story-1-1");
      expect(fixPlan).toContain("specs/planning-artifacts/epics/epic-2.md#story-2-1");
    });

    it("fails when duplicate story IDs are present across epic files", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/epics-login.md"),
        `## Epic 1: Auth

### Story 1.1: Sign in

User can sign in.

**Acceptance Criteria:**
**Given** a valid account
**When** credentials are submitted
**Then** access is granted
`
      );
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/epics-billing.md"),
        `## Epic 2: Billing

### Story 1.1: Sync invoices

Invoices can be synced.

**Acceptance Criteria:**
**Given** a connected gateway
**When** sync runs
**Then** invoices are imported
`
      );

      await expect(runTransition(testDir)).rejects.toThrow(/duplicate story id/i);
    });

    it("uses sprint-status as the source of truth over stale fix plan progress", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, ".ralph/@fix_plan.md"),
        `# Ralph Fix Plan

## Stories to Implement

- [x] Story 1.1: Setup project
- [x] Story 1.2: Create logo SVG
- [x] Story 1.3: Login page UI
- [x] Story 2.1: Database migration
- [x] Story 2.2: API endpoint
- [x] Story 2.3: Full login flow
`
      );
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/epics-and-stories.md"),
        `## Epic 1: Auth

### Story 1.1: Setup project

Description.

**Acceptance Criteria:**
**Given** setup exists
**When** install runs
**Then** the project builds

### Story 1.2: Create logo SVG

Description.

**Acceptance Criteria:**
**Given** assets exist
**When** the app renders
**Then** the logo is visible

### Story 1.3: Login page UI

Description.

**Acceptance Criteria:**
**Given** a login route
**When** the page opens
**Then** the form renders

## Epic 2: Backend

### Story 2.1: Database migration

Description.

**Acceptance Criteria:**
**Given** a schema change
**When** migrations run
**Then** the schema is updated

### Story 2.2: API endpoint

Description.

**Acceptance Criteria:**
**Given** a request
**When** the endpoint is called
**Then** it returns success

### Story 2.3: Full login flow

Description.

**Acceptance Criteria:**
**Given** a valid user
**When** authentication runs
**Then** a session starts
`
      );
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/sprint-status.yaml"),
        `generated: 2026-03-07
project: Example
project_key: EX
tracking_system: file-system
story_location: stories

development_status:
  epic-1: backlog
  1-1-setup-project: done
  1-2-create-logo-svg: backlog
  1-3-login-page-ui: backlog
  epic-1-retrospective: optional

  epic-2: backlog
  2-1-database-migration: backlog
  2-2-api-endpoint: backlog
  2-3-full-login-flow: backlog
  epic-2-retrospective: optional
`
      );

      await runTransition(testDir, { force: true });

      const fixPlan = await readFile(join(testDir, ".ralph/@fix_plan.md"), "utf-8");
      const completed = fixPlan.match(/- \[x\] Story/g) ?? [];

      expect(completed).toHaveLength(1);
      expect(fixPlan).toContain("- [x] Story 1.1: Setup project");
      expect(fixPlan).toContain("- [ ] Story 1.2: Create logo SVG");
      expect(fixPlan).toContain("- [ ] Story 2.3: Full login flow");
    });

    it("uses sprint-status from implementation-artifacts over stale fix plan progress", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await mkdir(join(testDir, "_bmad-output/implementation-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, ".ralph/@fix_plan.md"),
        `# Ralph Fix Plan

## Stories to Implement

- [x] Story 1.1: Setup project
- [x] Story 1.2: Create logo SVG
`
      );
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/epics-and-stories.md"),
        `## Epic 1: Auth

### Story 1.1: Setup project

Description.

**Acceptance Criteria:**
**Given** setup exists
**When** install runs
**Then** the project builds

### Story 1.2: Create logo SVG

Description.

**Acceptance Criteria:**
**Given** assets exist
**When** the app renders
**Then** the logo is visible
`
      );
      await writeFile(
        join(testDir, "_bmad-output/implementation-artifacts/sprint-status.yaml"),
        `generated: 2026-03-07
project: Example
project_key: EX
tracking_system: file-system
story_location: stories

development_status:
  epic-1: backlog
  1-1-setup-project: done
  1-2-create-logo-svg: backlog
  epic-1-retrospective: optional
`
      );

      await runTransition(testDir, { force: true });

      const fixPlan = await readFile(join(testDir, ".ralph/@fix_plan.md"), "utf-8");
      const completed = fixPlan.match(/- \[x\] Story/g) ?? [];

      expect(completed).toHaveLength(1);
      expect(fixPlan).toContain("- [x] Story 1.1: Setup project");
      expect(fixPlan).toContain("- [ ] Story 1.2: Create logo SVG");
    });
  });

  describe("generated files tracking", () => {
    it("returns generatedFiles with correct actions", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: Core\n\n### Story 1.1: Feature\n\nDo something.\n`
      );

      const result = await runTransition(testDir);

      expect(result.generatedFiles).toBeDefined();
      expect(result.generatedFiles.length).toBeGreaterThan(0);
      const paths = result.generatedFiles.map((f) => f.path);
      expect(paths).toContain(".ralph/@fix_plan.md");
      expect(paths).toContain(".ralph/PROMPT.md");
      expect(paths).toContain(".ralph/specs/");
    });

    it("marks files as created on first run", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: Core\n\n### Story 1.1: Feature\n\nDo something.\n`
      );

      const result = await runTransition(testDir);

      const fixPlanEntry = result.generatedFiles.find((f) => f.path === ".ralph/@fix_plan.md");
      expect(fixPlanEntry).toBeDefined();
      expect(fixPlanEntry!.action).toBe("created");

      const projectContextEntry = result.generatedFiles.find(
        (f) => f.path === ".ralph/PROJECT_CONTEXT.md"
      );
      expect(projectContextEntry).toBeDefined();
      expect(projectContextEntry!.action).toBe("created");

      const promptEntry = result.generatedFiles.find((f) => f.path === ".ralph/PROMPT.md");
      expect(promptEntry).toBeDefined();
      expect(promptEntry!.action).toBe("created");
    });

    it("marks fix_plan as updated on re-run", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: Core\n\n### Story 1.1: Feature\n\nDo something.\n`
      );

      // First run creates the fix_plan
      await runTransition(testDir);

      // Second run should mark it as updated
      const result = await runTransition(testDir);

      const fixPlanEntry = result.generatedFiles.find((f) => f.path === ".ralph/@fix_plan.md");
      expect(fixPlanEntry).toBeDefined();
      expect(fixPlanEntry!.action).toBe("updated");
    });
  });

  describe("stale file cleanup", () => {
    it("removes stale files from .ralph/specs/ on re-transition", async () => {
      // First transition: copy artifact to specs
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: Core\n\n### Story 1.1: Feature\n\nDo something.\n`
      );
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/old-artifact.md"),
        `# Old Artifact\nThis will be removed.\n`
      );
      await runTransition(testDir);

      // Verify old-artifact.md was copied
      await expect(
        access(join(testDir, ".ralph/specs/planning-artifacts/old-artifact.md"))
      ).resolves.toBeUndefined();

      // Second transition: old-artifact.md removed from source
      await rm(join(testDir, "_bmad-output/planning-artifacts/old-artifact.md"));
      await runTransition(testDir);

      // Stale file should be gone from specs
      await expect(
        access(join(testDir, ".ralph/specs/planning-artifacts/old-artifact.md"))
      ).rejects.toThrow();
    });
  });

  describe("truncation warnings (Bug #9)", () => {
    it("warns when PRD goals are truncated", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      // Create PRD with very long Executive Summary (>5000 chars)
      const longContent = "A".repeat(6000);
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/prd.md"),
        `# PRD\n\n## Executive Summary\n\n${longContent}\n\n## Other Section\n`
      );
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: Core\n\n### Story 1.1: Feature\n\nDo something.\n`
      );

      const result = await runTransition(testDir);

      // Should warn about truncation
      expect(result.warnings).toContainEqual(expect.stringMatching(/truncat/i));
    });
  });

  describe("no stories file error path", () => {
    it("throws when no file matches the stories pattern", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      // Create files that do NOT match the stories pattern
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/prd.md"),
        `# PRD\n\nSome content.\n`
      );
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/architecture.md"),
        `# Architecture\n\nSome content.\n`
      );

      await expect(runTransition(testDir)).rejects.toThrow(/no epics\/stories file found/i);
    });
  });

  describe("zero parsed stories error path", () => {
    it("throws when stories file parses to zero stories", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      // File matches stories pattern but has no parseable stories
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `# Stories\n\nThis file has no properly formatted stories.\n\nJust some text.\n`
      );

      await expect(runTransition(testDir)).rejects.toThrow(/no stories parsed/i);
    });
  });

  describe("PROMPT.md placeholder replacement", () => {
    it("replaces [YOUR PROJECT NAME] with actual project name", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: Core\n\n### Story 1.1: Feature\n\nDo something.\n`
      );
      // Create existing PROMPT.md with placeholder
      await writeFile(
        join(testDir, ".ralph/PROMPT.md"),
        `# Ralph Instructions for [YOUR PROJECT NAME]\n\nYou are working on [YOUR PROJECT NAME].\n`
      );

      await runTransition(testDir);

      const prompt = await readFile(join(testDir, ".ralph/PROMPT.md"), "utf-8");
      expect(prompt).not.toContain("[YOUR PROJECT NAME]");
      expect(prompt).toContain("test-project");
    });

    it("generates new PROMPT.md when no placeholder present", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: Core\n\n### Story 1.1: Feature\n\nDo something.\n`
      );
      // Existing PROMPT.md without the placeholder
      await writeFile(
        join(testDir, ".ralph/PROMPT.md"),
        `# Old prompt content\n\nNo placeholder here.\n`
      );

      await runTransition(testDir);

      const prompt = await readFile(join(testDir, ".ralph/PROMPT.md"), "utf-8");
      // Should be regenerated from template (contains Ralph Development Instructions)
      expect(prompt).toContain("Ralph Development Instructions");
      expect(prompt).toContain("test-project");
    });
  });

  describe("tech stack + @AGENT.md customization", () => {
    it("customizes @AGENT.md when architecture has tech stack", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: Core\n\n### Story 1.1: Feature\n\nDo something.\n`
      );
      // Architecture with tech stack section mentioning Node.js + vitest
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/architecture.md"),
        `# Architecture\n\n## Tech Stack\n\n- Node.js\n- TypeScript\n- vitest\n\n## Other\n`
      );
      // Template @AGENT.md with placeholder bash blocks
      await writeFile(
        join(testDir, ".ralph/@AGENT.md"),
        [
          "# Agent",
          "",
          "## Project Setup",
          "```bash",
          "echo setup",
          "```",
          "",
          "## Running Tests",
          "```bash",
          "echo test",
          "```",
          "",
          "## Build Commands",
          "```bash",
          "echo build",
          "```",
          "",
          "## Development Server",
          "```bash",
          "echo dev",
          "```",
        ].join("\n")
      );

      await runTransition(testDir);

      const agent = await readFile(join(testDir, ".ralph/@AGENT.md"), "utf-8");
      expect(agent).toContain("npm install");
      expect(agent).toContain("npx vitest run");
    });

    it("warns but does not fail when @AGENT.md is missing", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: Core\n\n### Story 1.1: Feature\n\nDo something.\n`
      );
      // Architecture with tech stack
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/architecture.md"),
        `# Architecture\n\n## Tech Stack\n\n- Node.js\n- TypeScript\n\n## Other\n`
      );
      // No @AGENT.md file exists - should warn, not crash

      const result = await runTransition(testDir);

      // Should succeed without crashing
      expect(result.storiesCount).toBe(1);
    });

    it("customizes @AGENT.md when stack is documented in Core Architectural Decisions", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: Core\n\n### Story 1.1: Feature\n\nDo something.\n\n**Acceptance Criteria:**\n\n- Given something\n- When action happens\n- Then result happens\n`
      );
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/architecture.md"),
        `# Architecture\n\n## Core Architectural Decisions\n\n- Use Node.js 20 with TypeScript\n- Use Vitest for automated tests\n\n## Other\n`
      );
      await writeFile(
        join(testDir, ".ralph/@AGENT.md"),
        [
          "# Agent",
          "",
          "## Project Setup",
          "```bash",
          "echo setup",
          "```",
          "",
          "## Running Tests",
          "```bash",
          "echo test",
          "```",
          "",
          "## Build Commands",
          "```bash",
          "echo build",
          "```",
          "",
          "## Development Server",
          "```bash",
          "echo dev",
          "```",
        ].join("\n")
      );

      await runTransition(testDir);

      const agent = await readFile(join(testDir, ".ralph/@AGENT.md"), "utf-8");
      expect(agent).toContain("npm install");
      expect(agent).toContain("npx vitest run");
    });
  });

  describe("atomic specs copy", () => {
    it("preserves specs if cp fails mid-operation", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: Core\n\n### Story 1.1: Feature\n\nDo something.\n`
      );

      // First transition to populate specs
      await runTransition(testDir);

      // Verify specs exist after first transition
      await expect(
        access(join(testDir, ".ralph/specs/planning-artifacts/stories.md"))
      ).resolves.toBeUndefined();
    });

    it("uses temp directory for atomic copy", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: Core\n\n### Story 1.1: Feature\n\nDo something.\n`
      );

      await runTransition(testDir);

      // After successful transition, temp dir should be cleaned up
      await expect(access(join(testDir, ".ralph/specs.new"))).rejects.toThrow();

      // But specs should exist
      await expect(
        access(join(testDir, ".ralph/specs/planning-artifacts/stories.md"))
      ).resolves.toBeUndefined();
    });
  });

  describe("atomicWriteFile for generated files", () => {
    it("writes @fix_plan.md atomically", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: Core\n\n### Story 1.1: Feature\n\nDo something.\n`
      );

      await runTransition(testDir);

      // Verify fix_plan was written
      const content = await readFile(join(testDir, ".ralph/@fix_plan.md"), "utf-8");
      expect(content).toContain("Story 1.1");
    });

    it("writes PROMPT.md atomically", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: Core\n\n### Story 1.1: Feature\n\nDo something.\n`
      );

      await runTransition(testDir);

      const content = await readFile(join(testDir, ".ralph/PROMPT.md"), "utf-8");
      expect(content).toContain("Ralph");
    });
  });

  describe("pre-flight validation", () => {
    it("halts transition on NO-GO readiness report", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: Core\n\n### Story 1.1: Feature\n\nDo something.\n`
      );
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/readiness.md"),
        `# Readiness Report\n\n**NO-GO** - Missing test coverage.\n`
      );

      await expect(runTransition(testDir)).rejects.toThrow(/pre-flight validation failed/i);
    });

    it("exposes structured preflight issues on blocking failure", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: Core\n\n### Story 1.1: Feature\n\nDo something.\n`
      );
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/readiness.md"),
        `# Readiness Report\n\n**NO-GO** - Missing test coverage.\n`
      );

      const error = await runTransition(testDir).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(PreflightValidationError);
      expect((error as PreflightValidationError).issues.map((issue) => issue.id)).toContain("E1");
    });

    it("proceeds with warnings for missing PRD sections", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: Core\n\n### Story 1.1: Feature\n\nDo something.\n`
      );
      // PRD without proper sections
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/prd.md"),
        `# PRD\n\nJust some text.\n`
      );

      const result = await runTransition(testDir);

      // Should succeed but have warnings for missing sections
      expect(result.storiesCount).toBe(1);
      expect(result.warnings).toContainEqual(expect.stringMatching(/prd missing/i));
    });

    it("reports filename-specific warnings when one of multiple PRDs is malformed", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: Core

### Story 1.1: Feature

Do something.

**Acceptance Criteria:**
**Given** a valid request
**When** the feature runs
**Then** it succeeds
`
      );
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/prd-login.md"),
        `# PRD

## Resumo Executivo

Context.

## Requisitos Funcionais

Reqs.

## Requisitos N\u00E3o Funcionais

NFRs.

## Escopo

Scope.
`
      );
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/prd-billing.md"),
        `# PRD

## Executive Summary

Context.

## Scope

Scope.
`
      );

      const result = await runTransition(testDir);

      expect(result.preflightIssues).toContainEqual(
        expect.objectContaining({
          id: "W4",
          message: expect.stringMatching(/prd-billing\.md/i),
        })
      );
      expect(result.preflightIssues).toContainEqual(
        expect.objectContaining({
          id: "W5",
          message: expect.stringMatching(/prd-billing\.md/i),
        })
      );
    });

    it("respects force option to downgrade E1 to warning", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: Core\n\n### Story 1.1: Feature\n\nDo something.\n`
      );
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/readiness.md"),
        `# Readiness Report\n\n**NO-GO** - Missing test coverage.\n`
      );

      const result = await runTransition(testDir, { force: true });

      // Should succeed with force
      expect(result.storiesCount).toBe(1);
      // NO-GO should appear as a warning
      expect(result.warnings).toContainEqual(expect.stringMatching(/no-go/i));
    });

    it("includes preflight warnings in TransitionResult.warnings", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: Core\n\n### Story 1.1: Feature\n\nDo something.\n`
      );

      const result = await runTransition(testDir);

      // Should have W1 (no PRD) and W2 (no arch) in warnings
      expect(result.warnings).toContainEqual(expect.stringMatching(/no prd/i));
      expect(result.warnings).toContainEqual(expect.stringMatching(/no architecture/i));
    });

    it("returns preflightIssues in TransitionResult", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: Core\n\n### Story 1.1: Feature\n\nDo something.\n`
      );

      const result = await runTransition(testDir);

      expect(result.preflightIssues).toBeDefined();
      expect(result.preflightIssues!.length).toBeGreaterThan(0);
      const ids = result.preflightIssues!.map((i) => i.id);
      expect(ids).toContain("W1");
      expect(ids).toContain("W2");
    });

    it("does not duplicate parse warnings in result", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      // Story without acceptance criteria
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/stories.md"),
        `## Epic 1: Core\n\n### Story 1.1: Feature\n\nDo something.\n`
      );

      const result = await runTransition(testDir);

      // "has no acceptance criteria" should appear only once
      const acWarnings = result.warnings.filter((w) => /has no acceptance criteria/i.test(w));
      expect(acWarnings).toHaveLength(1);
    });

    it("accepts BMAD-native scope, architecture, and acceptance criteria formats", async () => {
      await mkdir(join(testDir, "_bmad-output/planning-artifacts"), { recursive: true });
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/prd.md"),
        `# PRD

## Executive Summary

Summary.

## Functional Requirements

- Support workspace sign-in

## Non-Functional Requirements

- Keep audit trails

## Product Scope

- In scope: workspace onboarding
- Out of scope: billing
`
      );
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/architecture.md"),
        `# Architecture

## Starter Template Evaluation

- Use a Next.js starter with TypeScript and Vitest
`
      );
      await writeFile(
        join(testDir, "_bmad-output/planning-artifacts/epics-and-stories.md"),
        `## Epic 1: Core

### Story 1.1: Sign in

As a user, I want to sign in.

**Acceptance Criteria:**

- **Given** the workspace exists
- **When** I submit valid credentials
- **Then** I reach the dashboard
- **And** my workspace name is visible

### Story 1.2: Sign out

As a user, I want to sign out.

**Acceptance Criteria:**

* Given I am signed in
* When I click sign out
* Then my session ends

### Story 1.3: View audit trail

As an admin, I want to view audit history.

**Acceptance Criteria:**

- Given audit events exist
- When I open the audit trail
- Then I see the newest events first
`
      );
      await writeFile(
        join(testDir, ".ralph/@AGENT.md"),
        [
          "# Agent",
          "",
          "## Project Setup",
          "```bash",
          "echo setup",
          "```",
          "",
          "## Running Tests",
          "```bash",
          "echo test",
          "```",
          "",
          "## Build Commands",
          "```bash",
          "echo build",
          "```",
          "",
          "## Development Server",
          "```bash",
          "echo dev",
          "```",
        ].join("\n")
      );

      const result = await runTransition(testDir);
      const fixPlan = await readFile(join(testDir, ".ralph/@fix_plan.md"), "utf-8");
      const agent = await readFile(join(testDir, ".ralph/@AGENT.md"), "utf-8");

      expect(result.preflightIssues.map((issue) => issue.id)).not.toContain("W6");
      expect(result.preflightIssues.map((issue) => issue.id)).not.toContain("W7");
      expect(result.preflightIssues.map((issue) => issue.id)).not.toContain("W8");
      expect(fixPlan).toContain(
        "> AC: Given the workspace exists, When I submit valid credentials, Then I reach the dashboard, And my workspace name is visible"
      );
      expect(agent).toContain("npm install");
      expect(agent).toContain("npx vitest run");
    });
  });
});
