# bmalph

[![npm](https://img.shields.io/npm/v/bmalph)](https://www.npmjs.com/package/bmalph)
[![npm downloads](https://img.shields.io/npm/dm/bmalph)](https://www.npmjs.com/package/bmalph)
[![license](https://img.shields.io/npm/l/bmalph)](LICENSE)
[![node](https://img.shields.io/node/v/bmalph)](https://nodejs.org)
[![CI](https://github.com/LarsCowe/bmalph/actions/workflows/ci.yml/badge.svg)](https://github.com/LarsCowe/bmalph/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/LarsCowe/bmalph/branch/main/graph/badge.svg)](https://codecov.io/gh/LarsCowe/bmalph)

[BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) planning + [Ralph](https://github.com/snarktank/ralph) autonomous implementation, glued by slash commands.

## What is bmalph?

bmalph bundles and installs two AI development systems:

- **[BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD)** — Planning agents and workflows (Phases 1-3)
- **[Ralph](https://github.com/snarktank/ralph)** — Autonomous implementation loop (Phase 4)

bmalph provides:

- `bmalph init` — Install both systems
- `bmalph upgrade` — Update to latest versions
- `bmalph doctor` — Check installation health
- `/bmalph-implement` — Transition from BMAD to Ralph

## Prerequisites

- Node.js 20+
- Bash (WSL or Git Bash on Windows)
- Claude Code (`claude` in PATH) — needed for Ralph loop

## Installation

```bash
npm install -g bmalph
```

## Quick Start

```bash
cd my-project
bmalph init --name my-project
# Use /bmalph slash command in Claude Code to navigate phases
# ... work through BMAD phases 1-3 ...
# Use /bmalph-implement to transition and start Ralph
```

## Workflow

### Step 1: Initialize

```bash
cd my-project
bmalph init
```

This installs:

- `_bmad/` — BMAD agents and workflows
- `.ralph/` — Ralph loop, libs, templates
- `bmalph/` — State management (config.json)
- Updates `CLAUDE.md` with BMAD workflow instructions
- Installs slash commands in `.claude/commands/`

### Step 2: Plan with BMAD (Phases 1-3)

Work interactively in Claude Code with BMAD agents. Use the `/bmalph` slash command to see your current phase, available commands, and advance phases.

| Phase         | Agent            | Commands           |
| ------------- | ---------------- | ------------------ |
| 1 Analysis    | Analyst          | BP, MR, DR, TR, CB |
| 2 Planning    | PM / UX Designer | CP, VP, EP, CU     |
| 3 Solutioning | Architect / PM   | CA, CE, IR         |

Validation commands (`/validate-brief`, `/validate-prd`, `/validate-ux`, `/validate-architecture`, `/validate-epics-stories`) run the same workflow in Validate mode.

**Phase 1 — Analysis**

- `BP` Brainstorm Project — guided facilitation through brainstorming techniques
- `MR` Market Research — market analysis, competitive landscape, customer needs
- `DR` Domain Research — industry domain deep dive
- `TR` Technical Research — technical feasibility, architecture options
- `CB` Create Brief — guided experience to nail down your product idea

**Phase 2 — Planning**

- `CP` Create PRD — expert led facilitation to produce your PRD (required)
- `VP` Validate PRD — validate PRD is comprehensive and cohesive
- `EP` Edit PRD — improve and enhance an existing PRD
- `CU` Create UX — guidance through realizing the plan for your UX

**Phase 3 — Solutioning**

- `CA` Create Architecture — guided workflow to document technical decisions (required)
- `CE` Create Epics and Stories — create the epics and stories listing (required)
- `IR` Implementation Readiness — ensure PRD, UX, architecture, and stories are aligned (required)

**Anytime Commands**

Available in any phase for supporting tasks:

- `QS` Quick Spec — lightweight spec for small tasks without full planning
- `QD` Quick Dev — quick implementation for small tasks
- `DP` Document Project — analyze existing project to produce documentation
- `GPC` Generate Project Context — scan codebase to generate LLM-optimized context
- `CC` Correct Course — navigate significant changes mid-project
- `WD` Write Document — tech writer agent for documentation
- `MG` Mermaid Generate — create Mermaid diagrams
- `VD` Validate Document — review documents against standards
- `BSP` Brainstorming — interactive idea generation techniques (core, distinct from BP)
- `ID` Index Docs — create lightweight doc index for LLM scanning
- `SD` Shard Document — split large documents into smaller files
- `ES` Editorial Review (Structure) — propose document reorganization
- `AR` Adversarial Review — critical content review for QA
- `US` Update Standards — update tech-writer documentation standards
- `EC` Explain Concept — create technical explanations with examples
- `/bmad-help` — list all available commands

> **Note:** `EP` means Edit PRD in the bmm workflow (Phase 2) and Editorial Review — Prose in the core module. `PM` is Party Mode in core. The bmm meanings are the primary workflow codes.

### Step 3: Implement with Ralph (Phase 4)

Use the `/bmalph-implement` slash command in Claude Code.

This transitions your BMAD artifacts into Ralph's format:

1. Reads your stories from BMAD output
2. Generates `.ralph/@fix_plan.md` with ordered tasks
3. Copies specs to `.ralph/specs/` with changelog tracking
4. Instructs you to start the Ralph autonomous loop

Then start Ralph:

```bash
bash .ralph/ralph_loop.sh
```

Ralph picks stories one by one, implements with TDD, and commits. The loop stops when all stories are done or the circuit breaker triggers.

### Incremental Development

bmalph supports iterative development cycles:

```
BMAD (Epic 1) → /bmalph-implement → Ralph works on Epic 1
     ↓
BMAD (add Epic 2) → /bmalph-implement → Ralph sees changes + picks up Epic 2
```

**Smart Merge**: When you run `/bmalph-implement` again after Ralph has made progress:

- Completed stories (`[x]`) are preserved in the new fix_plan
- New stories from BMAD are added as pending (`[ ]`)

**Specs Changelog**: `.ralph/SPECS_CHANGELOG.md` shows what changed in specs since the last run, so Ralph knows what's new or modified.

## CLI Reference

| Command                | Description                                         |
| ---------------------- | --------------------------------------------------- |
| `bmalph init`          | Install BMAD + Ralph into project                   |
| `bmalph upgrade`       | Update bundled assets to current version            |
| `bmalph doctor`        | Check installation health                           |
| `bmalph check-updates` | Check if bundled BMAD/Ralph versions are up to date |
| `bmalph status`        | Show current project status and phase               |

### Global options

| Flag                       | Description                   |
| -------------------------- | ----------------------------- |
| `--verbose`                | Enable debug logging          |
| `--no-color`               | Disable colored output        |
| `--quiet`                  | Suppress non-essential output |
| `-C, --project-dir <path>` | Run in specified directory    |
| `--version`                | Show version                  |
| `--help`                   | Show help                     |

### init options

| Flag                       | Description         | Default        |
| -------------------------- | ------------------- | -------------- |
| `-n, --name <name>`        | Project name        | directory name |
| `-d, --description <desc>` | Project description | (prompted)     |

### upgrade options

| Flag        | Description               |
| ----------- | ------------------------- |
| `--force`   | Skip confirmation prompts |
| `--dry-run` | Preview changes           |

## Slash Commands

bmalph installs 47 BMAD slash commands. Key commands:

| Command                 | Description                         |
| ----------------------- | ----------------------------------- |
| `/bmalph`               | BMAD master agent — navigate phases |
| `/analyst`              | Analyst agent                       |
| `/pm`                   | Product Manager agent               |
| `/architect`            | Architect agent                     |
| `/dev`                  | Developer agent                     |
| `/sm`                   | Scrum Master agent                  |
| `/qa`                   | QA agent                            |
| `/ux-designer`          | UX Designer agent                   |
| `/tech-writer`          | Tech Writer agent                   |
| `/quick-flow-solo-dev`  | Quick Flow solo developer agent     |
| `/create-prd`           | Create PRD workflow                 |
| `/create-architecture`  | Create architecture workflow        |
| `/create-epics-stories` | Create epics and stories            |
| `/bmad-help`            | List all BMAD commands              |

For full list, run `/bmad-help` in Claude Code.

### Transition to Ralph

Use `/bmalph-implement` to transition from BMAD planning to Ralph implementation.

## Project Structure (after init)

```
project/
├── _bmad/                     # BMAD agents, workflows, core
│   ├── _config/               # Generated configuration
│   │   └── config.yaml        # Platform config
│   ├── core/
│   │   ├── agents/            # Master agent
│   │   ├── tasks/             # Workflow tasks
│   │   └── workflows/         # Brainstorming, party-mode, etc.
│   └── bmm/
│       ├── agents/            # Analyst, PM, Architect, Dev, QA, etc.
│       ├── workflows/         # Phase 1-4 workflows
│       └── teams/             # Agent team definitions
├── _bmad-output/              # BMAD planning artifacts (generated)
│   ├── planning-artifacts/    # PRD, architecture, stories
│   ├── implementation-artifacts/ # Sprint plans (optional)
│   └── brainstorming/         # Brainstorm sessions (optional)
├── .ralph/                    # Ralph autonomous loop
│   ├── ralph_loop.sh          # Main loop script
│   ├── ralph_import.sh        # Import requirements into Ralph
│   ├── ralph_monitor.sh       # Monitor loop progress
│   ├── .ralphrc               # Ralph configuration
│   ├── RALPH-REFERENCE.md     # Ralph usage reference
│   ├── lib/                   # Circuit breaker, response analyzer
│   ├── specs/                 # Copied from _bmad-output during transition
│   ├── logs/                  # Loop execution logs
│   ├── PROMPT.md              # Iteration prompt template
│   ├── PROJECT_CONTEXT.md     # Extracted project context (after /bmalph-implement)
│   ├── SPECS_CHANGELOG.md     # Spec diff since last run (after /bmalph-implement)
│   ├── @AGENT.md              # Agent build instructions
│   └── @fix_plan.md           # Generated task list (after /bmalph-implement)
├── bmalph/                    # State management
│   ├── config.json            # Project config (name, description)
│   └── state/                 # Phase tracking data
├── .claude/
│   └── commands/              # Slash commands for Claude Code
└── CLAUDE.md                  # Updated with BMAD instructions
```

## How Ralph Works

Ralph is a bash loop that spawns fresh Claude Code instances:

1. Pick the next unchecked story from `@fix_plan.md`
2. Implement with TDD (tests first, then code)
3. Commit the changes
4. Move to the next story

Safety mechanisms:

- **Circuit breaker** — prevents infinite loops on failing stories
- **Response analyzer** — detects stuck or repeating outputs
- **Completion** — loop exits when all `@fix_plan.md` items are checked off

Press `Ctrl+C` to stop the loop at any time.

## Troubleshooting

### Windows: Bash Not Found

Ralph requires bash to run. On Windows, install one of:

**Git Bash (Recommended)**

```bash
# Install Git for Windows from https://git-scm.com/downloads
# Git Bash is included and works well with bmalph
```

**WSL (Windows Subsystem for Linux)**

```powershell
# In PowerShell as Administrator
wsl --install
# Then restart and run bmalph from WSL terminal
```

### Permission Denied

If you get permission errors:

```bash
# Unix/Mac: Make ralph_loop.sh executable
chmod +x .ralph/ralph_loop.sh

# Check file ownership
ls -la .ralph/
```

### Common Issues

| Scenario                     | Solution                                                  |
| ---------------------------- | --------------------------------------------------------- |
| Commands fail before init    | Run `bmalph init` first                                   |
| Transition finds no stories  | Create stories in Phase 3 with `/create-epics-stories`    |
| Ralph stops mid-loop         | Circuit breaker detected stagnation. Check `.ralph/logs/` |
| Doctor reports version drift | Run `bmalph upgrade` to update bundled assets             |

### Reset Installation

If something goes wrong, you can manually reset:

```bash
# Remove bmalph directories (preserves your project code)
rm -rf _bmad .ralph bmalph .claude/commands/
# Note: manually remove the bmalph section from CLAUDE.md and .gitignore entries

# Reinitialize
bmalph init
```

## Quick Examples

### Initialize a new project

```bash
# Interactive mode (prompts for name/description)
bmalph init

# Non-interactive mode
bmalph init --name my-app --description "My awesome app"

# Preview what would be created
bmalph init --dry-run
```

### Check installation health

```bash
# Human-readable output
bmalph doctor

# JSON output for scripting
bmalph doctor --json
```

### Update bundled assets

```bash
# Update BMAD and Ralph to latest bundled versions
bmalph upgrade

# Preview changes first
bmalph upgrade --dry-run
```

### After init: Next steps

```bash
# 1. Open Claude Code in your project
claude

# 2. Use the /bmalph slash command to start
#    This shows your current phase and available commands

# 3. Follow the BMAD workflow:
#    Phase 1: /analyst → create product brief
#    Phase 2: /pm → create PRD
#    Phase 3: /architect → create architecture and stories

# 4. Transition to Ralph
#    Use /bmalph-implement to generate @fix_plan.md

# 5. Start autonomous implementation
bash .ralph/ralph_loop.sh
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, test workflow, and commit guidelines.

## License

MIT
