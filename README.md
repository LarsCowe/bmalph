# bmalph

BMAD-METHOD planning + Ralph autonomous implementation, glued by a CLI.

## Prerequisites

- Node.js 20+
- Bash (WSL or Git Bash on Windows)
- Claude Code CLI (`claude` in PATH) — needed for Ralph loop

## Installation

```bash
npm install -g bmalph
```

## Quick Start

```bash
bmalph init --name my-project --level 2
bmalph plan --phase 1
# ... work through BMAD phases ...
bmalph implement
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
- `bmalph/` — State management (config.json, state/)
- Updates `CLAUDE.md` with BMAD workflow instructions

### Step 2: Plan with BMAD (Phases 1-3)

Work interactively in Claude Code with BMAD agents. Load the master agent:

```
Read and follow the instructions in _bmad/core/agents/bmad-master.agent.yaml
```

Then use `bmalph plan` to set each phase:

| Phase | Agent | Commands |
|-------|-------|----------|
| `--phase 1` Analysis | Analyst | BP, MR, DR, TR, CB, VB |
| `--phase 2` Planning | PM (John) | CP, VP, CU, VU |
| `--phase 3` Solutioning | Architect | CA, VA, CE, VE, TD, IR |

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

```bash
bmalph implement
```

This transitions your BMAD artifacts into Ralph's format:
1. Reads your stories from BMAD output
2. Generates `.ralph/@fix_plan.md` with ordered tasks
3. Starts the Ralph autonomous loop

Ralph picks stories one by one, implements with TDD, and commits. The loop stops when all stories are done or the circuit breaker triggers.

## CLI Reference

| Command | Description |
|---------|-------------|
| `bmalph init` | Install BMAD + Ralph into project |
| `bmalph plan [--phase N]` | Set active phase (1-3), show available commands |
| `bmalph implement` | Transition planning artifacts → start Ralph loop |
| `bmalph status` | Show current phase and progress |
| `bmalph reset [--hard]` | Reset state (--hard removes `_bmad/`, `.ralph/`, artifacts) |

### init options

| Flag | Description | Default |
|------|-------------|---------|
| `-n, --name <name>` | Project name | directory name |
| `-d, --description <desc>` | Project description | (prompted) |
| `-l, --level <level>` | Complexity level (0-4) | 2 |

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
├── .ralph/                 # Ralph autonomous loop
│   ├── ralph_loop.sh       # Main loop script
│   ├── lib/                # Circuit breaker, response analyzer
│   ├── specs/              # Populated during transition
│   ├── logs/               # Loop execution logs
│   ├── PROMPT.md           # Iteration prompt template
│   ├── @AGENT.md           # Agent instructions
│   └── @fix_plan.md        # Generated task list
├── bmalph/                 # State only
│   ├── config.json         # Project config (name, level)
│   └── state/              # Phase tracking
└── CLAUDE.md               # Updated with BMAD instructions
```

## Scale Levels

| Level | Label | Behavior |
|-------|-------|----------|
| 0 | Trivial | Single-shot, no loop |
| 1 | Simple | Quick flow (brief spec + implement) |
| 2 | Moderate | All 4 phases, standard depth |
| 3 | Complex | All 4 phases + extra review iterations |
| 4 | Enterprise | Full formal process |

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
