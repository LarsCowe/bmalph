# bmalph Upgrade

Update bundled assets to match installed bmalph version.

## How to Upgrade

Run the following command in the terminal:

```bash
bmalph upgrade
```

Or if bmalph is not installed globally:

```bash
npx bmalph upgrade
```

## What Gets Updated

- `_bmad/` — BMAD agents, workflows, core files
- `.ralph/ralph_loop.sh` — Ralph loop script
- `.ralph/lib/` — Ralph library files
- `.ralph/PROMPT.md` — Ralph prompt template
- `.ralph/@AGENT.md` — Ralph agent template
- `.claude/commands/` — All slash commands

## What Is Preserved

- `bmalph/config.json` — Your project configuration
- `bmalph/state/` — Phase tracking state
- `.ralph/logs/` — Ralph execution logs
- `.ralph/@fix_plan.md` — Implementation progress
- `.ralph/docs/` — Generated documentation
- `.ralph/specs/` — Project specifications
- `_bmad-output/` — All planning artifacts

## When to Upgrade

Run this command after updating bmalph globally:

```bash
npm update -g bmalph
bmalph upgrade
```
