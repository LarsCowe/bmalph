# BMALPH

Unified AI Development Framework - BMAD phases with Ralph execution loop for Claude Code.

## Quick Start

```bash
# Install globally
npm install -g bmalph

# Initialize in your project
cd my-project
bmalph init

# Start the autonomous loop
bmalph start

# Or use interactively in Claude Code
/bmalph
```

## What It Does

BMALPH structures AI-driven development into 4 phases, each with the appropriate agent persona:

1. **Analysis** (Analyst) - Gather requirements, identify constraints and risks
2. **Planning** (PM) - Create PRD, user stories, prioritized backlog
3. **Design** (Architect) - Technology choices, architecture, data models
4. **Implementation** (Developer) - TDD-driven code implementation

Each phase runs a Ralph-style iteration loop (fresh context per iteration) and requires human approval before transitioning to the next phase.

## Scale Levels

| Level | Label | Behavior |
|-------|-------|----------|
| 0 | Trivial | Single-shot, no loop |
| 1 | Simple | Quick flow (brief spec + implement) |
| 2 | Moderate | All 4 phases, standard depth |
| 3 | Complex | All 4 phases + extra review |
| 4 | Enterprise | Full formal process |

## Dual-Mode Operation

**Autonomous** (`bmalph start`): Fire-and-forget loop that spawns fresh Claude instances.

**Interactive** (Claude Code skills): Collaborate with agent personas directly via `/bmalph-analyze`, `/bmalph-plan`, `/bmalph-design`, `/bmalph-implement`.

Both modes share the same state files.

## CLI Commands

```bash
bmalph init              # Initialize in current project
bmalph start             # Start execution loop
bmalph start --phase 3   # Start from specific phase
bmalph resume            # Resume from checkpoint
bmalph status            # Show progress
bmalph reset             # Reset state (keeps artifacts)
bmalph reset --hard      # Reset state and artifacts
```

## Project Structure (after init)

```
your-project/
├── .claude/skills/bmalph*/  # Interactive skills
├── bmalph/
│   ├── bmalph.sh            # Execution loop
│   ├── config.json          # Project config
│   ├── agents/              # Agent personas
│   ├── prompts/             # Iteration templates
│   ├── templates/           # Output templates
│   ├── state/               # Runtime state
│   └── artifacts/           # Phase outputs
└── CLAUDE.md                # Enhanced with bmalph section
```

## Requirements

- Node.js 20+
- Claude Code CLI (`claude`)
- bash (for autonomous loop)
