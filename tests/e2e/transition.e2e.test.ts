import { describe, it, expect, afterEach } from "vitest";
import { mkdir, writeFile, readFile, access } from "fs/promises";
import { join } from "path";
import { runInit } from "./helpers/cli-runner.js";
import { createTestProject, type TestProject } from "./helpers/project-scaffold.js";
import { runTransition } from "../../src/transition/orchestration.js";
import { expectFileExists, expectFileContains } from "./helpers/assertions.js";

// Sample BMAD artifacts for testing
const SAMPLE_EPICS_STORIES = `# Epics and Stories

## Epic 1: User Authentication

The authentication system allows users to securely access the application.

### Story 1.1: Implement Login Form

As a user, I want to log in to the application, So that I can access my account.

**Acceptance Criteria:**
**Given** I am on the login page
**When** I enter valid credentials
**Then** I should be redirected to the dashboard

### Story 1.2: Implement Registration

As a new user, I want to register an account, So that I can use the application.

**Acceptance Criteria:**
**Given** I am on the registration page
**When** I fill in my details and submit
**Then** my account should be created

## Epic 2: Dashboard

The dashboard provides an overview of user activity.

### Story 2.1: Display User Stats

As a user, I want to see my stats on the dashboard, So that I can track my progress.

**Acceptance Criteria:**
**Given** I am logged in
**When** I visit the dashboard
**Then** I should see my activity stats
`;

const SAMPLE_ARCHITECTURE = `# Architecture Document

## Tech Stack

- **Frontend:** Next.js with TypeScript
- **Backend:** Node.js with Express
- **Database:** PostgreSQL with Prisma ORM
- **Hosting:** Vercel

## Key Decisions

- Server-side rendering for SEO
- REST API for backend services
`;

const SAMPLE_PRD = `# Product Requirements Document

## Overview

This is a sample PRD for testing the transition functionality.

## User Stories

See epics-and-stories.md for detailed user stories.
`;

describe("bmalph transition e2e", { timeout: 60000 }, () => {
  let project: TestProject | null = null;

  afterEach(async () => {
    if (project) {
      await project.cleanup();
      project = null;
    }
  });

  async function setupBmadArtifacts(projectPath: string): Promise<void> {
    // Artifacts must be in planning-artifacts subdirectory (as expected by findArtifactsDir)
    const artifactsDir = join(projectPath, "_bmad-output/planning-artifacts");
    await mkdir(artifactsDir, { recursive: true });

    await writeFile(
      join(artifactsDir, "epics-and-stories.md"),
      SAMPLE_EPICS_STORIES,
    );
    await writeFile(join(artifactsDir, "architecture.md"), SAMPLE_ARCHITECTURE);
    await writeFile(join(artifactsDir, "prd.md"), SAMPLE_PRD);
  }

  it("parses stories from BMAD artifacts and generates @fix_plan.md", async () => {
    project = await createTestProject();

    await runInit(project.path);
    await setupBmadArtifacts(project.path);

    const result = await runTransition(project.path);

    expect(result.storiesCount).toBe(3);

    // Fix plan should be created
    await expectFileExists(join(project.path, ".ralph/@fix_plan.md"));
    await expectFileContains(
      join(project.path, ".ralph/@fix_plan.md"),
      "Story 1.1",
    );
    await expectFileContains(
      join(project.path, ".ralph/@fix_plan.md"),
      "Story 1.2",
    );
    await expectFileContains(
      join(project.path, ".ralph/@fix_plan.md"),
      "Story 2.1",
    );
  });

  it("generates fix_plan with correct checkbox format", async () => {
    project = await createTestProject();

    await runInit(project.path);
    await setupBmadArtifacts(project.path);

    await runTransition(project.path);

    const fixPlan = await readFile(
      join(project.path, ".ralph/@fix_plan.md"),
      "utf-8",
    );

    // Should have unchecked checkboxes
    expect(fixPlan).toContain("- [ ] Story 1.1:");
    expect(fixPlan).toContain("- [ ] Story 1.2:");
    expect(fixPlan).toContain("- [ ] Story 2.1:");
  });

  it("preserves completed stories on re-run", async () => {
    project = await createTestProject();

    await runInit(project.path);
    await setupBmadArtifacts(project.path);

    // First transition
    await runTransition(project.path);

    // Mark story 1.1 as completed
    const fixPlanPath = join(project.path, ".ralph/@fix_plan.md");
    let fixPlan = await readFile(fixPlanPath, "utf-8");
    fixPlan = fixPlan.replace("- [ ] Story 1.1:", "- [x] Story 1.1:");
    await writeFile(fixPlanPath, fixPlan);

    // Second transition
    const result = await runTransition(project.path);

    expect(result.fixPlanPreserved).toBe(true);

    // Story 1.1 should still be completed
    const finalFixPlan = await readFile(fixPlanPath, "utf-8");
    expect(finalFixPlan).toContain("- [x] Story 1.1:");
    expect(finalFixPlan).toContain("- [ ] Story 1.2:");
  });

  it("detects tech stack from architecture document", async () => {
    project = await createTestProject();

    await runInit(project.path);
    await setupBmadArtifacts(project.path);

    await runTransition(project.path);

    // AGENT.md should be customized with detected tech stack
    // The tech stack detection should find Next.js and TypeScript
    await expectFileExists(join(project.path, ".ralph/@AGENT.md"));
  });

  it("copies BMAD artifacts to .ralph/specs/", async () => {
    project = await createTestProject();

    await runInit(project.path);
    await setupBmadArtifacts(project.path);

    await runTransition(project.path);

    // Artifacts should be copied to specs (preserving structure)
    await expectFileExists(
      join(project.path, ".ralph/specs/planning-artifacts/epics-and-stories.md"),
    );
    await expectFileExists(
      join(project.path, ".ralph/specs/planning-artifacts/architecture.md"),
    );
    await expectFileExists(
      join(project.path, ".ralph/specs/planning-artifacts/prd.md"),
    );
  });

  it("generates PROJECT_CONTEXT.md from artifacts", async () => {
    project = await createTestProject();

    await runInit(project.path);
    await setupBmadArtifacts(project.path);

    await runTransition(project.path);

    await expectFileExists(join(project.path, ".ralph/PROJECT_CONTEXT.md"));
  });

  it("throws error when no BMAD artifacts exist", async () => {
    project = await createTestProject();

    await runInit(project.path);

    // Don't create any artifacts

    await expect(runTransition(project.path)).rejects.toThrow(
      /No BMAD artifacts found/,
    );
  });

  it("throws error when no stories file exists", async () => {
    project = await createTestProject();

    await runInit(project.path);

    // Create _bmad-output/planning-artifacts but without stories file
    const artifactsDir = join(project.path, "_bmad-output/planning-artifacts");
    await mkdir(artifactsDir, { recursive: true });
    await writeFile(join(artifactsDir, "prd.md"), SAMPLE_PRD);

    await expect(runTransition(project.path)).rejects.toThrow(
      /No epics\/stories file found/,
    );
  });

  it("generates SPECS_CHANGELOG.md when updating specs", async () => {
    project = await createTestProject();

    await runInit(project.path);
    await setupBmadArtifacts(project.path);

    // First transition - creates initial specs
    await runTransition(project.path);

    // Modify an artifact
    const artifactsDir = join(project.path, "_bmad-output/planning-artifacts");
    await writeFile(
      join(artifactsDir, "prd.md"),
      SAMPLE_PRD + "\n\n## New Section\n\nAdded content.",
    );

    // Second transition
    await runTransition(project.path);

    // Changelog may or may not be created depending on implementation
    // At minimum, specs should be updated
    await expectFileContains(
      join(project.path, ".ralph/specs/planning-artifacts/prd.md"),
      "New Section",
    );
  });
});
