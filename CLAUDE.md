# bmalph

Integration layer between [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) and [Ralph](https://github.com/snarktank/ralph).

## What is bmalph?

bmalph orchestrates two autonomous systems:

- **BMAD-METHOD** handles structured planning (Analysis → Planning → Solutioning)
- **Ralph** handles autonomous implementation (bash loop, fresh AI instances, fix_plan.md driven)
- **bmalph** provides the glue: CLI for init, slash commands for workflow, state management, phase transitions

## Architecture

```
Phases 1-3 (Planning): BMAD agents + workflows (interactive, command-driven)
Phase 4 (Implementation): Ralph loop (autonomous, bash-driven)
bmalph: CLI (init only) + slash commands (workflow) + state + transition logic
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

| Command | Action |
|---------|--------|
| `bmalph init` | Install BMAD + Ralph, configure project |
| `bmalph upgrade` | Update bundled assets to current version |
| `bmalph doctor` | Check installation health |

## Slash Commands

| Command | Action |
|---------|--------|
| `/bmalph` | Navigate BMAD phases |
| `/bmalph-status` | Show current phase, Ralph progress, version info |
| `/bmalph-implement` | Transition: BMAD artifacts → Ralph inputs |
| `/bmalph-reset` | Reset state (soft or hard with confirmation) |
| `/bmalph-upgrade` | Instructions to run `bmalph upgrade` |
| `/bmalph-doctor` | Instructions to run `bmalph doctor` |

## Key Files

- `src/cli.ts` — Commander.js CLI definition
- `src/installer.ts` — Copies bmad/ and ralph/ into target project
- `src/transition.ts` — Converts BMAD stories → Ralph @fix_plan.md
- `src/commands/init.ts` — CLI init handler
- `src/commands/upgrade.ts` — CLI upgrade handler
- `src/commands/doctor.ts` — CLI doctor handler
- `src/utils/state.ts` — Phase tracking + Ralph status reading
- `src/utils/json.ts` — Safe JSON file reading with error discrimination
- `src/utils/validate.ts` — Runtime config/state validation
- `src/utils/logger.ts` — Debug logging (--verbose)
- `bmad/` — Bundled BMAD agents and workflows
- `ralph/` — Bundled Ralph loop and libraries
- `slash-commands/` — Claude Code slash command templates (including bmalph-*)

## Dev Workflow

- TDD: write tests first, then implement
- Conventional Commits with SemVer
- Application language: English
- Node 20+ LTS
