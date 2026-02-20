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
- `/bmalph-implement` — Transition from BMAD to Ralph

## Architecture

```
Phases 1-3 (Planning): BMAD agents + workflows (interactive, command-driven)
Phase 4 (Implementation): Ralph loop (autonomous, bash-driven)
bmalph: CLI + transition logic
```

### Directory structure after `bmalph init`

```
project-root/
├── _bmad/           # Actual BMAD agents, workflows, core
├── .ralph/          # Ralph loop, libs, specs, logs
├── bmalph/          # bmalph state (config.json, state/)
└── CLAUDE.md        # Updated with BMAD workflow instructions
```

## CLI Commands

| Command                | Action                                   |
| ---------------------- | ---------------------------------------- |
| `bmalph init`          | Install BMAD + Ralph, configure project  |
| `bmalph upgrade`       | Update bundled assets to current version |
| `bmalph doctor`        | Check installation health                |
| `bmalph check-updates` | Check for upstream updates               |
| `bmalph status`        | Show project installation status         |

## Slash Commands

bmalph installs 47 BMAD slash commands. Key commands:

| Command                 | Description                         |
| ----------------------- | ----------------------------------- |
| `/bmalph`               | BMAD master agent — navigate phases |
| `/analyst`              | Analyst agent                       |
| `/pm`                   | Product Manager agent               |
| `/architect`            | Architect agent                     |
| `/create-prd`           | Create PRD workflow                 |
| `/create-architecture`  | Create architecture workflow        |
| `/create-epics-stories` | Create epics and stories            |
| `/bmad-help`            | List all BMAD commands              |

For full list, run `/bmad-help` in Claude Code.

### Transition to Ralph

Use `/bmalph-implement` to transition from BMAD planning to Ralph implementation.

## Key Files

- `src/cli.ts` — Commander.js CLI definition
- `src/installer.ts` — Copies bmad/ and ralph/ into target project
- `src/transition/orchestration.ts` — Main transition orchestrator
- `src/transition/story-parsing.ts` — Parse BMAD stories
- `src/transition/fix-plan.ts` — Generate @fix_plan.md
- `src/transition/artifacts.ts` — Locate BMAD artifacts
- `src/transition/context.ts` — Generate PROJECT_CONTEXT.md
- `src/transition/specs-changelog.ts` — Track spec changes
- `src/transition/specs-index.ts` — Generate SPECS_INDEX.md
- `src/transition/tech-stack.ts` — Detect tech stack
- `src/transition/types.ts` — Shared transition types
- `src/commands/init.ts` — CLI init handler
- `src/commands/upgrade.ts` — CLI upgrade handler
- `src/commands/doctor.ts` — CLI doctor handler
- `src/utils/state.ts` — Phase tracking + Ralph status reading
- `src/utils/json.ts` — Safe JSON file reading with error discrimination
- `src/utils/validate.ts` — Runtime config/state validation
- `src/utils/logger.ts` — Debug logging (--verbose)
- `bmad/` — Bundled BMAD agents and workflows
- `ralph/` — Bundled Ralph loop and libraries
- `slash-commands/` — bmalph and bmalph-implement slash commands

## Dev Workflow

- TDD: write tests first, then implement
- Conventional Commits with SemVer
- Application language: English
- Node 20+ LTS
