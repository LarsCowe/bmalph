import { describe, it, expect, afterEach } from "vitest";
import { mkdir, readFile, writeFile } from "node:fs/promises";
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

const BMAD_NATIVE_STORIES = `# Epics and Stories

## Epic 1: Workspace Access

The workspace access flow lets users enter the product safely.

### Story 1.1: Sign in to a workspace

As a member, I want to sign in to my workspace, So that I can continue my work.

**Acceptance Criteria:**

- **Given** the workspace exists
- **When** I submit valid credentials
- **Then** I should reach the dashboard
- **And** I should see the active workspace name

### Story 1.2: Sign out of a workspace

As a member, I want to sign out, So that I can end my session safely.

**Acceptance Criteria:**

* Given I am signed in
* When I click the sign-out action
* Then my session should end

### Story 1.3: Review the audit trail

As an admin, I want to review the audit trail, So that I can verify recent activity.

**Acceptance Criteria:**

- Given audit events exist
- When I open the audit trail
- Then I should see the newest entries first
`;

const BMAD_NATIVE_ARCHITECTURE = `# Architecture Document

## Core Architectural Decisions

- Use Node.js 20 with TypeScript
- Use Vitest for automated tests
- Keep PostgreSQL as the primary datastore
`;

const BMAD_NATIVE_PRD = `# Product Requirements Document

## Functional Requirements

- Support workspace sign-in
- Support workspace sign-out
- Support audit trail review

## Non-Functional Requirements

- Keep audit history durable
- Enforce role-based access control

## Product Scope

- In scope: workspace authentication and audit review
- Out of scope: billing and subscription management
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
    expect(result.stdout).toContain("bmalph run");
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

  it("handles BMAD-native artifacts without false W6/W7/W8 warnings and avoids duplicate warning lines", async () => {
    project = await createTestProject();
    await runInit(project.path);

    const artifactsDir = join(project.path, "_bmad-output/planning-artifacts");
    await mkdir(artifactsDir, { recursive: true });
    await writeFile(join(artifactsDir, "epics-and-stories.md"), BMAD_NATIVE_STORIES);
    await writeFile(join(artifactsDir, "architecture.md"), BMAD_NATIVE_ARCHITECTURE);
    await writeFile(join(artifactsDir, "prd.md"), BMAD_NATIVE_PRD);

    const result = await runImplement(project.path);
    const fixPlan = await readFile(join(project.path, ".ralph/@fix_plan.md"), "utf-8");
    const agent = await readFile(join(project.path, ".ralph/@AGENT.md"), "utf-8");

    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toContain("PRD missing Scope section");
    expect(result.stdout).not.toContain("Architecture missing Tech Stack section");
    expect(result.stdout).not.toContain("has no acceptance criteria");
    expect(result.stdout).toContain("PRD missing Executive Summary or Vision section");
    const warningOccurrences =
      result.stdout.match(/PRD missing Executive Summary or Vision section/g) ?? [];
    expect(warningOccurrences).toHaveLength(1);
    expect(fixPlan).toContain(
      "> AC: Given the workspace exists, When I submit valid credentials, Then I should reach the dashboard, And I should see the active workspace name"
    );
    expect(agent).toContain("npm install");
    expect(agent).toContain("npx vitest run");
  });

  it("aggregates multi-file artifacts and lets sprint-status override stale fix plan progress", async () => {
    project = await createTestProject();
    await runInit(project.path);

    const artifactsDir = join(project.path, "_bmad-output/planning-artifacts");
    const implementationArtifactsDir = join(project.path, "_bmad-output/implementation-artifacts");
    await mkdir(artifactsDir, { recursive: true });
    await mkdir(join(artifactsDir, "epics"), { recursive: true });
    await mkdir(implementationArtifactsDir, { recursive: true });
    await writeFile(
      join(artifactsDir, "prd-login.md"),
      `# PRD

## Resumo Executivo

Fluxo de autenticacao para clientes.

## Requisitos Funcionais

- Login
- Logout

## Requisitos N\u00E3o Funcionais

- Auditoria

## Escopo

- Em escopo: autenticacao
- Fora de escopo: faturamento
`
    );
    await writeFile(
      join(artifactsDir, "prd-billing.md"),
      `# PRD

## Resumen Ejecutivo

Flujo de facturacion para administradores.

## Requisitos Funcionales

- Facturas

## Requisitos No Funcionales

- Registros de auditoria

## Alcance

- En alcance: facturacion
- Fuera de alcance: marketing
`
    );
    await writeFile(
      join(artifactsDir, "architecture.md"),
      `# Architecture

## Pila Tecnol\u00F3gica

- Node.js 20
- TypeScript
- Vitest
`
    );
    await writeFile(
      join(artifactsDir, "epics/epic-1.md"),
      `## Epic 1: Authentication

### Story 1.1: Setup project

Create the project foundation.

**Acceptance Criteria:**
**Given** a fresh repository
**When** setup completes
**Then** the app can boot

### Story 1.2: Create logo SVG

Create the login logo.

**Acceptance Criteria:**
**Given** branding assets
**When** the app renders
**Then** the SVG is visible

### Story 1.3: Login page UI

Render the login page.

**Acceptance Criteria:**
**Given** the login route
**When** the page opens
**Then** the form is visible
`
    );
    await writeFile(
      join(artifactsDir, "epics/epic-2.md"),
      `## Epic 2: Billing

### Story 2.1: Database migration

Create the billing schema.

**Acceptance Criteria:**
**Given** a pending migration
**When** it runs
**Then** the schema is updated

### Story 2.2: API endpoint

Expose the billing endpoint.

**Acceptance Criteria:**
**Given** a valid request
**When** the endpoint is called
**Then** it returns success

### Story 2.3: Full login flow

Complete the sign-in flow.

**Acceptance Criteria:**
**Given** a valid user
**When** authentication completes
**Then** a session starts
`
    );
    await writeFile(
      join(implementationArtifactsDir, "sprint-status.yaml"),
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
    await writeFile(
      join(project.path, ".ralph/@fix_plan.md"),
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

    const result = await runImplement(project.path, true);
    const fixPlan = await readFile(join(project.path, ".ralph/@fix_plan.md"), "utf-8");
    const completed = fixPlan.match(/- \[x\] Story/g) ?? [];

    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toContain("PRD missing Executive Summary or Vision section");
    expect(result.stdout).not.toContain("PRD missing Functional Requirements section");
    expect(result.stdout).not.toContain("PRD missing Non-Functional Requirements section");
    expect(result.stdout).not.toContain("PRD missing Scope section");
    expect(result.stdout).not.toContain("Architecture missing Tech Stack section");
    expect(fixPlan).toContain("- [x] Story 1.1: Setup project");
    expect(fixPlan).toContain("- [ ] Story 1.2: Create logo SVG");
    expect(fixPlan).toContain("- [ ] Story 1.3: Login page UI");
    expect(fixPlan).toContain("- [ ] Story 2.1: Database migration");
    expect(fixPlan).toContain("- [ ] Story 2.2: API endpoint");
    expect(fixPlan).toContain("- [ ] Story 2.3: Full login flow");
    expect(fixPlan).toContain("specs/planning-artifacts/epics/epic-1.md#story-1-1");
    expect(fixPlan).toContain("specs/planning-artifacts/epics/epic-2.md#story-2-1");
    expect(completed).toHaveLength(1);
  });
});
