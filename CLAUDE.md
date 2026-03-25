# bmalph

Integration layer between [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) and [Ralph](https://github.com/snarktank/ralph).

## What is bmalph?

bmalph bundles and installs two AI development systems:

- **[BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD)** — Planning agents and workflows (Phases 1-3)
- **[Ralph](https://github.com/snarktank/ralph)** — Autonomous implementation loop (Phase 4)

## Architecture

```
Phases 1-3 (Planning): BMAD agents + workflows (interactive, command-driven)
Phase 4 (Implementation): Ralph loop (autonomous, bash-driven)
bmalph: CLI + transition logic
```

### Directory structure after `bmalph init`

```
project-root/
├── _bmad/              # BMAD agents, workflows, core, lite workflows
├── .ralph/             # Ralph runtime (loop, libs, specs, logs, drivers)
│   ├── drivers/        # Platform driver scripts (claude-code, codex, opencode, copilot, cursor)
│   ├── lib/            # Shell libraries (circuit breaker, response analysis, etc.)
│   └── templates/      # Prompt, agent, fix plan, review, and ralphrc templates
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

## Dev Workflow

- TDD: write tests first, then implement
- When a test fails, analyse the root cause before changing anything. Do not take the easy route of just making the test pass — understand why it fails and fix the actual problem. A failing test is a signal, not an obstacle.
- Tests live in `tests/<module>/` (mirrors `src/` structure), not colocated
- Conventional Commits with SemVer
- Application language: English
- Node 20+ LTS
- Always run `npm run ci` locally before committing to catch formatting, lint, type, and test failures early

`npm run ci` runs (in order):

1. `type-check` — `tsc --noEmit`
2. `lint` — ESLint
3. `fmt:check` — Prettier (check only)
4. `build` — compile TypeScript
5. `test:all` — unit + e2e + bash tests

### Bash tests (BATS)

Ralph's shell scripts and platform drivers are tested with [BATS](https://github.com/bats-core/bats-core):

- Test files: `tests/bash/*.bats` + `tests/bash/drivers/*.bats`
- Fixtures: `tests/bash/fixtures/`
- Helpers: `tests/bash/test_helper/` (bats-assert, bats-support, common-setup.bash)
- Runner: `npm run test:bash` (via `scripts/run-bash-tests.mjs`)
- First-time setup: `scripts/setup-bats.sh` (installs BATS dependencies)

### Updating bundled BMAD assets

`npm run update-bundled` syncs `bmad/` from the upstream BMAD-METHOD repo (tracked as a git checkout in `.refs/bmad/`). It pulls latest from main (or a specific ref with `-- --bmad-ref <ref>`), copies `bmm/` and `core/` into `bmad/`, and updates `bundled-versions.json` with the commit SHA. After running, build + test + review diffs before committing.

Note: `bmad/lite/` is bmalph-owned content (not synced from upstream).

## CI Pipeline

- **Triggers:** push to `main`, PRs targeting `main`
- **Lint job** (ubuntu, Node 22): type-check, lint, fmt:check
- **Test matrix** (3 jobs): ubuntu/Node 22, ubuntu/Node 20, windows/Node 22
- **Test steps:** build, unit tests, e2e tests, bash tests (ubuntu only), coverage, `npm pack --dry-run`
- **Coverage:** Codecov upload on Node 22 + ubuntu only
- **Gate job:** `ci-success` aggregates all jobs — single required check for branch protection

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
