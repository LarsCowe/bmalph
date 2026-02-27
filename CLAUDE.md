# bmalph

Integration layer between [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) and [Ralph](https://github.com/snarktank/ralph).

## What is bmalph?

bmalph bundles and installs two AI development systems:

- **[BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD)** — Planning agents and workflows (Phases 1-3)
- **[Ralph](https://github.com/snarktank/ralph)** — Autonomous implementation loop (Phase 4)

bmalph provides:

- `bmalph init` — Install both systems
- `bmalph upgrade` — Update to latest versions
- `bmalph doctor` — Check installation health
- `bmalph implement` / `/bmalph-implement` — Transition from BMAD to Ralph

## Architecture

```
Phases 1-3 (Planning): BMAD agents + workflows (interactive, command-driven)
Phase 4 (Implementation): Ralph loop (autonomous, bash-driven)
bmalph: CLI + transition logic
```

### Directory structure after `bmalph init`

```
project-root/
├── _bmad/              # Actual BMAD agents, workflows, core
├── .ralph/             # Ralph loop, libs, specs, logs (drivers for claude-code and codex only)
│   └── drivers/        # Platform driver scripts (claude-code.sh, codex.sh)
├── bmalph/             # bmalph state (config.json with platform, state/)
└── <instructions file> # Varies by platform (CLAUDE.md, AGENTS.md, etc.)
```

The instructions file depends on the configured platform — see `src/platform/` for the mapping.

## CLI Commands

| Command                | Action                                    |
| ---------------------- | ----------------------------------------- |
| `bmalph init`          | Install BMAD + Ralph, configure project   |
| `bmalph upgrade`       | Update bundled assets to current version  |
| `bmalph doctor`        | Check installation health                 |
| `bmalph check-updates` | Check for upstream updates                |
| `bmalph status`        | Show project installation status          |
| `bmalph implement`     | Transition BMAD artifacts to Ralph format |
| `bmalph reset`         | Remove all bmalph files from the project  |

## Slash Commands

bmalph installs 51 slash commands (45 BMAD + 6 bmalph). Key commands:

| Command                 | Description                         |
| ----------------------- | ----------------------------------- |
| `/bmalph`               | BMAD master agent — navigate phases |
| `/analyst`              | Analyst agent                       |
| `/pm`                   | Product Manager agent               |
| `/architect`            | Architect agent                     |
| `/create-prd`           | Create PRD workflow                 |
| `/create-architecture`  | Create architecture workflow        |
| `/create-epics-stories` | Create epics and stories            |
| `/bmalph-watch`         | Launch Ralph live dashboard         |
| `/bmad-help`            | List all BMAD commands              |

For full list, run `/bmad-help` in Claude Code.

### Transition to Ralph

Use `bmalph implement` (or `/bmalph-implement`) to transition from BMAD planning to Ralph implementation.

## Key Files

- `src/cli.ts` — Commander.js CLI definition
- `src/installer.ts` — Copies bmad/ and ralph/ into target project
- `src/transition/orchestration.ts` — Main transition orchestrator
- `src/transition/story-parsing.ts` — Parse BMAD stories
- `src/transition/fix-plan.ts` — Generate @fix_plan.md
- `src/transition/artifacts.ts` — Locate BMAD artifacts
- `src/transition/context.ts` — Generate PROJECT_CONTEXT.md
- `src/transition/preflight.ts` — Pre-flight validation checks
- `src/transition/specs-changelog.ts` — Track spec changes
- `src/transition/specs-index.ts` — Generate SPECS_INDEX.md
- `src/transition/tech-stack.ts` — Detect tech stack
- `src/transition/types.ts` — Shared transition types
- `src/commands/init.ts` — CLI init handler
- `src/commands/upgrade.ts` — CLI upgrade handler
- `src/commands/doctor.ts` — CLI doctor handler
- `src/commands/implement.ts` — CLI implement handler
- `src/commands/reset.ts` — CLI reset handler
- `src/reset.ts` — Reset plan-build + execute logic
- `src/utils/state.ts` — Phase tracking + Ralph status reading
- `src/utils/json.ts` — Safe JSON file reading with error discrimination
- `src/utils/validate.ts` — Runtime config/state validation
- `src/utils/logger.ts` — Debug logging (--verbose)
- `src/platform/types.ts` — Platform type definitions (PlatformId, PlatformTier, CommandDelivery)
- `src/platform/registry.ts` — Platform registry (getPlatform, getAllPlatforms)
- `src/platform/detect.ts` — Auto-detect platform from project markers
- `src/platform/resolve.ts` — Resolve platform from config with fallback
- `src/platform/claude-code.ts` — Claude Code platform definition
- `src/platform/codex.ts` — OpenAI Codex platform definition
- `src/platform/cursor.ts` — Cursor platform definition
- `src/platform/windsurf.ts` — Windsurf platform definition
- `src/platform/copilot.ts` — GitHub Copilot platform definition
- `src/platform/aider.ts` — Aider platform definition
- `bmad/` — Bundled BMAD agents and workflows
- `ralph/` — Bundled Ralph loop and libraries
- `ralph/drivers/claude-code.sh` — Ralph driver for Claude Code (`claude` CLI)
- `ralph/drivers/codex.sh` — Ralph driver for OpenAI Codex (`codex exec`)
- `slash-commands/` — bmalph and bmalph-implement slash commands

## Dev Workflow

- TDD: write tests first, then implement
- Conventional Commits with SemVer
- Application language: English
- Node 20+ LTS
- Always run `npm run ci` locally before committing to catch formatting, lint, type, and test failures early

`npm run ci` runs (in order):

1. `type-check` — `tsc --noEmit`
2. `lint` — ESLint
3. `fmt:check` — Prettier (check only)
4. `build` — compile TypeScript
5. `test:all` — unit + e2e tests

### Updating bundled BMAD assets

`npm run update-bundled` syncs `bmad/` from the upstream BMAD-METHOD repo (tracked as a git checkout in `.refs/bmad/`). It pulls latest from main (or a specific ref with `-- --bmad-ref <ref>`), copies `bmm/` and `core/` into `bmad/`, and updates `bundled-versions.json` with the commit SHA. After running, build + test + review diffs before committing.

## CI Pipeline

- **Triggers:** push to `main`, PRs targeting `main`
- **Matrix:** ubuntu + windows, Node 20 + 22
- **Steps:** type-check, lint, fmt:check, build, unit tests, e2e tests, coverage, `npm pack --dry-run`
- **Coverage:** Codecov upload on Node 22 + ubuntu only
- **Gate job:** `ci-success` aggregates the matrix — single required check for branch protection

## Release Process

- [release-please](https://github.com/googleapis/release-please) manages changelogs, version bumps, and release PRs
- On release creation: publish job runs build + test + `npm publish` to npm
- Version bumps follow Conventional Commits: `feat` = MINOR, `fix` = PATCH, `BREAKING CHANGE` = MAJOR
- Visible changelog sections: Features, Bug Fixes, Performance, Code Quality
- Hidden changelog sections: docs, tests, chores, CI, build, style

## Dependency Management

- Dependabot opens weekly grouped PRs for minor/patch updates
- Two groups: npm (production + development) and GitHub Actions
- Minor/patch PRs are auto-approved and auto-merged (squash)
- Major updates require manual review
- PR limits: 10 npm, 5 GitHub Actions
