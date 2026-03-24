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
- `bmalph check-updates` — Check for upstream updates
- `bmalph status` — Show project installation status
- `bmalph reset` — Remove all bmalph files from the project
- `bmalph run` — Start Ralph loop with live dashboard
- `bmalph watch` — Live dashboard for Ralph loop status (deprecated, use `bmalph run`)

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
├── .ralph/             # Ralph loop, libs, specs, logs (drivers for claude-code, codex, opencode, copilot, and cursor)
│   └── drivers/        # Platform driver scripts (claude-code.sh, codex.sh, opencode.sh, copilot.sh, cursor.sh, cursor-agent-wrapper.sh)
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
| `bmalph run`           | Start Ralph loop with live dashboard      |
| `bmalph reset`         | Remove all bmalph files from the project  |
| `bmalph watch`         | _(deprecated)_ Use `bmalph run` instead   |

## Command Delivery

bmalph bundles 54 BMAD and bmalph command definitions. Delivery varies by platform:

- **Claude Code** — `.claude/commands/` slash commands
- **OpenAI Codex** — `.agents/skills/` Codex Skills
- **OpenCode** — `.opencode/skills/` OpenCode Skills
- **Cursor, Windsurf, Copilot, Aider** — `_bmad/COMMANDS.md` reference index

Key commands in Claude Code syntax:

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

For the full list, run `/bmad-help` in Claude Code or inspect `_bmad/COMMANDS.md` / `.agents/skills/` for the other platforms.

### Transition to Ralph

Use `bmalph implement` (or `/bmalph-implement`) to transition from BMAD planning to Ralph implementation.

## Key Files

- `src/cli.ts` — Commander.js CLI definition
- `src/installer/install.ts` — Main install orchestrator
- `src/installer/bmad-assets.ts` — BMAD asset copying and config generation
- `src/installer/ralph-assets.ts` — Ralph asset copying and template rendering
- `src/installer/commands.ts` — Command delivery (slash commands, skills, index)
- `src/installer/project-files.ts` — Instructions file and .gitignore management
- `src/installer/template-files.ts` — Template customization detection
- `src/installer/metadata.ts` — Lazy platform loading for command classification
- `src/installer/types.ts` — Installer type definitions
- `src/transition/index.ts` — Transition barrel export
- `src/transition/orchestration.ts` — Main transition orchestrator
- `src/transition/story-parsing.ts` — Parse BMAD stories
- `src/transition/story-id.ts` — Story ID extraction and normalization
- `src/transition/fix-plan.ts` — Generate @fix_plan.md
- `src/transition/fix-plan-sync.ts` — Merge progress into updated fix plans
- `src/transition/artifacts.ts` — Locate BMAD artifacts
- `src/transition/artifact-scan.ts` — Artifact scanning
- `src/transition/artifact-collection.ts` — Collect and group artifacts
- `src/transition/artifact-loading.ts` — Load artifact file contents
- `src/transition/context.ts` — Generate PROJECT_CONTEXT.md
- `src/transition/context-output.ts` — Context file output formatting
- `src/transition/preflight.ts` — Pre-flight validation checks
- `src/transition/section-patterns.ts` — Markdown section pattern matching
- `src/transition/specs-changelog.ts` — Track spec changes
- `src/transition/specs-index.ts` — Generate SPECS_INDEX.md
- `src/transition/specs-sync.ts` — Sync specs to .ralph/specs/
- `src/transition/sprint-status.ts` — Sprint status tracking
- `src/transition/tech-stack.ts` — Detect tech stack
- `src/transition/types.ts` — Shared transition types
- `src/commands/init.ts` — CLI init handler
- `src/commands/upgrade.ts` — CLI upgrade handler
- `src/commands/doctor.ts` — CLI doctor command handler + check registry
- `src/commands/doctor-checks.ts` — Core/environment doctor checks
- `src/commands/doctor-health-checks.ts` — Project health doctor checks
- `src/commands/doctor-runtime-checks.ts` — Ralph runtime state doctor checks
- `src/commands/check-updates.ts` — Check for upstream updates
- `src/commands/status.ts` — Show project installation status
- `src/commands/implement.ts` — CLI implement handler
- `src/commands/reset.ts` — CLI reset handler
- `src/commands/run.ts` — CLI run handler (Ralph + dashboard)
- `src/commands/watch.ts` — Launch live dashboard
- `src/run/types.ts` — Run module types (RalphProcessState, RalphProcess)
- `src/run/ralph-process.ts` — Ralph process spawning and lifecycle
- `src/run/run-dashboard.ts` — Dashboard with Ralph status bar and quit prompt
- `src/reset.ts` — Reset plan-build + execute logic
- `src/watch/dashboard.ts` — Live dashboard orchestrator
- `src/watch/renderer.ts` — Terminal UI rendering
- `src/watch/file-watcher.ts` — File system polling
- `src/watch/frame-writer.ts` — Terminal frame output
- `src/watch/state-reader.ts` — Ralph state parsing
- `src/watch/types.ts` — Watch types
- `src/utils/state.ts` — Phase tracking + Ralph status reading
- `src/utils/json.ts` — Safe JSON file reading with error discrimination
- `src/utils/validate.ts` — Runtime config/state validation
- `src/utils/config.ts` — Config file operations
- `src/utils/constants.ts` — Path constants
- `src/utils/dryrun.ts` — Dry-run utilities
- `src/utils/errors.ts` — Error formatting
- `src/utils/file-system.ts` — Atomic file writes, exists helper
- `src/utils/github.ts` — GitHub API client
- `src/utils/logger.ts` — Debug logging (--verbose)
- `src/utils/format-status.ts` — Shared status formatting (Ralph + bmalph phases)
- `src/utils/ralph-runtime-state.ts` — Ralph runtime state reading
- `src/utils/artifact-definitions.ts` — Shared BMAD artifact definitions
- `src/platform/types.ts` — Platform type definitions (PlatformId, PlatformTier, CommandDelivery)
- `src/platform/registry.ts` — Platform registry (getPlatform, getAllPlatforms)
- `src/platform/detect.ts` — Auto-detect platform from project markers
- `src/platform/resolve.ts` — Resolve platform from config with fallback
- `src/platform/doctor-checks.ts` — Shared platform doctor checks
- `src/platform/instructions-snippet.ts` — Generated multi-platform instructions snippets
- `src/platform/claude-code.ts` — Claude Code platform definition
- `src/platform/codex.ts` — OpenAI Codex platform definition
- `src/platform/opencode.ts` — OpenCode platform definition
- `src/platform/guidance.ts` — Platform-specific guidance hints for status/init
- `src/platform/cursor.ts` — Cursor platform definition
- `src/platform/cursor-runtime-checks.ts` — Cursor bash/auth preflight checks for doctor and run
- `src/platform/windsurf.ts` — Windsurf platform definition
- `src/platform/copilot.ts` — GitHub Copilot platform definition
- `src/platform/aider.ts` — Aider platform definition
- `bmad/` — Bundled BMAD agents and workflows
- `ralph/` — Bundled Ralph loop and libraries
- `ralph/drivers/claude-code.sh` — Ralph driver for Claude Code (`claude` CLI)
- `ralph/drivers/codex.sh` — Ralph driver for OpenAI Codex (`codex exec`)
- `ralph/drivers/opencode.sh` — Ralph driver for OpenCode (`opencode run`)
- `ralph/drivers/copilot.sh` — Ralph driver for GitHub Copilot (`copilot --autopilot`, experimental)
- `ralph/drivers/cursor.sh` — Ralph driver for Cursor (`cursor-agent -p --force --output-format json`, experimental)
- `ralph/drivers/cursor-agent-wrapper.sh` — Wrapper for cursor-agent .cmd installs on Windows
- `slash-commands/` — Slash commands (6 bmalph + 48 BMAD)

## Dev Workflow

- TDD: write tests first, then implement
- Tests live in `tests/<module>/` (mirrors `src/` structure), not colocated
- Conventional Commits with SemVer
- Application language: English
- Node 20+ LTS
- Always run `npm run ci` locally before committing to catch formatting, lint, type, and test failures early
- **BATS tests on Windows: use WSL2** — Windows Git Bash is 10-50x slower for bash forks. Run `wsl -- bash -c "cd /mnt/c/Users/Lars/Documents/bmalph && npm run test:bash"` or just push and let CI handle it (BATS only runs on Ubuntu in CI).

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
- **Matrix:** ubuntu (Node 20 + 22) + windows (Node 22 only)
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
