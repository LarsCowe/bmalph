import { describe, it, expect, afterEach } from "vitest";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runInit, runImplement } from "./helpers/cli-runner.js";
import { createTestProject, type TestProject } from "./helpers/project-scaffold.js";
import { expectFileExists } from "./helpers/assertions.js";

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

describe("bmalph implement CLI", { timeout: 60000 }, () => {
  let project: TestProject | null = null;

  afterEach(async () => {
    if (project) {
      await project.cleanup();
      project = null;
    }
  });

  async function setupBmadArtifacts(projectPath: string): Promise<void> {
    const artifactsDir = join(projectPath, "_bmad-output/planning-artifacts");
    await mkdir(artifactsDir, { recursive: true });

    await writeFile(join(artifactsDir, "epics-and-stories.md"), SAMPLE_EPICS_STORIES);
    await writeFile(join(artifactsDir, "architecture.md"), SAMPLE_ARCHITECTURE);
    await writeFile(join(artifactsDir, "prd.md"), SAMPLE_PRD);
  }

  it("transitions BMAD artifacts to Ralph format via CLI", async () => {
    project = await createTestProject();
    await runInit(project.path);
    await setupBmadArtifacts(project.path);

    const result = await runImplement(project.path);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Transition complete");
    expect(result.stdout).toMatch(/3 stories/);
    await expectFileExists(join(project.path, ".ralph/@fix_plan.md"));
  });

  it("shows driver instructions for full-tier platform", async () => {
    project = await createTestProject();
    await runInit(project.path);
    await setupBmadArtifacts(project.path);

    const result = await runImplement(project.path);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("bash .ralph/drivers/");
  });

  it("succeeds with --force when readiness report says NO-GO", async () => {
    project = await createTestProject();
    await runInit(project.path);
    await setupBmadArtifacts(project.path);

    const artifactsDir = join(project.path, "_bmad-output/planning-artifacts");
    await writeFile(
      join(artifactsDir, "readiness-report.md"),
      `# Readiness Report\n\n## Status\n\n**NO-GO** - Missing test coverage requirements.\n`
    );

    const result = await runImplement(project.path, true);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Transition complete");
  });

  it("fails with exit code 1 when no BMAD artifacts exist", async () => {
    project = await createTestProject();
    await runInit(project.path);

    const result = await runImplement(project.path);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("No BMAD artifacts found");
  });

  it("fails with exit code 1 when preflight validation fails without --force", async () => {
    project = await createTestProject();
    await runInit(project.path);
    await setupBmadArtifacts(project.path);

    const artifactsDir = join(project.path, "_bmad-output/planning-artifacts");
    await writeFile(
      join(artifactsDir, "readiness-report.md"),
      `# Readiness Report\n\n## Status\n\n**NO-GO** - Missing test coverage requirements.\n`
    );

    const result = await runImplement(project.path);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Pre-flight validation failed");
  });

  it("fails with exit code 1 when no stories file exists", async () => {
    project = await createTestProject();
    await runInit(project.path);

    const artifactsDir = join(project.path, "_bmad-output/planning-artifacts");
    await mkdir(artifactsDir, { recursive: true });
    await writeFile(join(artifactsDir, "prd.md"), SAMPLE_PRD);

    const result = await runImplement(project.path);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("No epics/stories file found");
  });
});
