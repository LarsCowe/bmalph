# bmalph Upgrade

Update bundled assets to match installed bmalph version.

## Prerequisites

- bmalph must be initialized (`bmalph/config.json` must exist)

## Steps

### 1. Check Versions

1. Get installed bmalph version from the global npm package
2. Get bundled version from `.ralph/ralph_loop.sh` version marker (`# bmalph-version: X.X.X`)
3. If versions match, report "Already up to date" and exit

### 2. Backup Current State (Mental Note)

The following will be preserved (not overwritten):
- `bmalph/config.json` - User configuration
- `bmalph/state/` - Phase tracking state
- `.ralph/logs/` - Ralph execution logs
- `.ralph/@fix_plan.md` - Implementation progress
- `.ralph/docs/` - Generated documentation
- `.ralph/specs/` - Project specifications
- `_bmad-output/` - Planning artifacts

### 3. Update Bundled Assets

Copy new versions of:

**From bundled `_bmad/`:**
- All agent files (`_bmad/agents/`)
- All workflow files (`_bmad/workflows/`)
- Core files (`_bmad/core/`)
- Module files (`_bmad/bmm/`)
- Regenerate manifests (`_bmad/_config/`)

**From bundled `ralph/`:**
- `.ralph/ralph_loop.sh` (with new version marker)
- `.ralph/lib/` (library files)
- `.ralph/PROMPT.md` (template)
- `.ralph/@AGENT.md` (template)

**From bundled `slash-commands/`:**
- All slash commands to `.claude/commands/`

### 4. Update CLAUDE.md

Check if CLAUDE.md contains the BMAD integration section:
- If missing, append the integration snippet
- If present, leave unchanged (don't overwrite user customizations)

### 5. Report Results

Display:
```
Upgrading bundled assets...

Updated:
  _bmad/
  .ralph/ralph_loop.sh
  .ralph/lib/
  .ralph/PROMPT.md
  .ralph/@AGENT.md
  .claude/commands/

Preserved:
  bmalph/config.json
  bmalph/state/
  .ralph/logs/
  .ralph/@fix_plan.md
  .ralph/docs/
  .ralph/specs/

Upgrade complete.
```

## Safety Guarantees

- **Never overwrite user artifacts** (`_bmad-output/`)
- **Preserve Ralph logs and state** (`.ralph/logs/`, `.ralph/specs/`)
- **Keep user configuration** (`bmalph/config.json`, `_bmad/config.yaml`)
- **Merge CLAUDE.md** (append new sections, keep user additions)

## When to Use

Run this command after updating bmalph globally:

```bash
npm update -g bmalph
```

Then run `/bmalph-upgrade` to update project assets.
