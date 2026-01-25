# bmalph

[BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) planning + [Ralph](https://github.com/snarktank/ralph) autonomous implementation, glued by slash commands.

## What is bmalph?

bmalph orchestrates two autonomous AI development systems:

- **[BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD)** — Structured planning through Analysis, Planning, and Solutioning phases
- **[Ralph](https://github.com/snarktank/ralph)** — Autonomous implementation loop (bash-driven, fresh AI instances, TDD methodology)
- **bmalph** — The glue: slash commands, state management, artifact transition

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

| Phase | Agent | Commands |
|-------|-------|----------|
| 1 Analysis | Analyst | BP, MR, DR, TR, CB, VB |
| 2 Planning | PM (John) | CP, VP, CU, VU |
| 3 Solutioning | Architect | CA, VA, CE, VE, TD, IR |

**Phase 1 — Analysis**
- `BP` Brainstorm Project — guided facilitation through brainstorming techniques
- `MR` Market Research — market analysis, competitive landscape, customer needs
- `DR` Domain Research — industry domain deep dive
- `TR` Technical Research — technical feasibility, architecture options
- `CB` Create Brief — guided experience to nail down your product idea
- `VB` Validate Brief — validates product brief completeness

**Phase 2 — Planning**
- `CP` Create PRD — expert led facilitation to produce your PRD (required)
- `VP` Validate PRD — validate PRD is comprehensive and cohesive
- `CU` Create UX — guidance through realizing the plan for your UX
- `VU` Validate UX — validates UX design deliverables

**Phase 3 — Solutioning**
- `CA` Create Architecture — guided workflow to document technical decisions (required)
- `VA` Validate Architecture — validates architecture completeness
- `CE` Create Epics and Stories — create the epics and stories listing (required)
- `VE` Validate Epics and Stories — validates epics and stories completeness
- `TD` Test Design — create comprehensive test scenarios
- `IR` Implementation Readiness — ensure PRD, UX, architecture, and stories are aligned (required)

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

| Command | Description |
|---------|-------------|
| `bmalph init` | Install BMAD + Ralph into project |

### Global options

| Flag | Description |
|------|-------------|
| `--verbose` | Enable debug logging |
| `--version` | Show version |
| `--help` | Show help |

### init options

| Flag | Description | Default |
|------|-------------|---------|
| `-n, --name <name>` | Project name | directory name |
| `-d, --description <desc>` | Project description | (prompted) |

## Slash Commands

All workflow functionality is provided via Claude Code slash commands:

| Command | Description |
|---------|-------------|
| `/bmalph` | Navigate BMAD phases |
| `/bmalph-status` | Show current phase, Ralph progress, version info |
| `/bmalph-implement` | Transition planning artifacts → prepare Ralph loop |
| `/bmalph-upgrade` | Update bundled assets to match current bmalph version |
| `/bmalph-doctor` | Check project health and report issues |
| `/bmalph-reset` | Reset state (soft or hard reset with confirmation) |

## Project Structure (after init)

```
project/
├── _bmad/                  # BMAD agents, workflows, core
│   ├── config.yaml         # Generated platform config
│   ├── core/
│   │   ├── agents/         # Master agent
│   │   ├── tasks/          # Workflow tasks
│   │   └── workflows/      # Brainstorming, party-mode, etc.
│   └── bmm/
│       ├── workflows/      # Phase 1-3 workflows
│       └── teams/          # Agent team definitions
├── _bmad-output/           # BMAD planning artifacts (generated)
│   ├── planning-artifacts/ # PRD, architecture, stories
│   ├── implementation-artifacts/ # Sprint plans (optional)
│   └── brainstorming/      # Brainstorm sessions (optional)
├── .ralph/                 # Ralph autonomous loop
│   ├── ralph_loop.sh       # Main loop script
│   ├── lib/                # Circuit breaker, response analyzer
│   ├── specs/              # Copied from _bmad-output during transition
│   ├── logs/               # Loop execution logs
│   ├── PROMPT.md           # Iteration prompt template
│   ├── PROJECT_CONTEXT.md  # Extracted goals, constraints, scope
│   ├── SPECS_CHANGELOG.md  # What changed since last run
│   ├── @AGENT.md           # Agent build instructions
│   └── @fix_plan.md        # Generated task list with progress
├── bmalph/                 # State only
│   └── config.json         # Project config (name, description)
├── .claude/
│   └── commands/           # Slash commands for Claude Code
└── CLAUDE.md               # Updated with BMAD instructions
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

## License

MIT
