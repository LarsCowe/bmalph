# bmalph Reset

Reset bmalph state. **Ask user which mode before proceeding.**

## Reset Modes

### Soft Reset (default)

Clears state only, keeps all artifacts and configuration:

**What gets deleted:**
- `bmalph/state/` directory (resets to Phase 1)

**What is preserved:**
- `bmalph/config.json` - Project configuration
- `_bmad/` - BMAD agents and workflows
- `_bmad-output/` - Planning artifacts
- `.ralph/` - All Ralph files including logs, specs, fix_plan
- `.claude/commands/` - Slash commands
- `CLAUDE.md` - Project instructions

**Effect:** Resets phase tracking to Phase 1 (Analysis). All planning work is preserved.

### Hard Reset

⚠️ **Destructive - requires explicit user confirmation!**

**What gets deleted:**
- `_bmad/` - BMAD agents and workflows
- `.ralph/` - Ralph loop, logs, specs, fix_plan
- `_bmad-output/` - All planning artifacts
- `bmalph/` - Configuration and state

**What is preserved:**
- Source code
- CLAUDE.md (but BMAD section will be stale)
- .gitignore entries

**Effect:** Completely removes bmalph from the project. User must run `bmalph init` to reinitialize.

## Confirmation Flow

### For Soft Reset

```
Are you sure you want to reset bmalph state?
This will reset to Phase 1 but keep all artifacts.

[Yes, reset state] [Cancel]
```

If confirmed:
```
State reset. Phase reset to 1 (Analysis).
Use `/bmalph-status` to see current state.
```

### For Hard Reset

```
⚠️ HARD RESET WARNING

This will permanently delete:
- _bmad/ (BMAD agents and workflows)
- .ralph/ (Ralph loop, logs, specs)
- _bmad-output/ (all planning artifacts)
- bmalph/ (configuration and state)

This action cannot be undone!

Type "DELETE" to confirm:
```

If confirmed:
```
Hard reset complete. All bmalph files removed.
Run 'bmalph init' to reinitialize.
```

## Implementation Steps

1. **Check initialization**
   - If `bmalph/config.json` doesn't exist, report "bmalph is not initialized"

2. **Ask for mode**
   - Present options: "Soft reset (keeps artifacts)" vs "Hard reset (deletes everything)"

3. **Confirm action**
   - Soft: Simple confirmation
   - Hard: Require typing "DELETE"

4. **Execute reset**
   - Soft: Delete only `bmalph/state/` directory
   - Hard: Delete `_bmad/`, `.ralph/`, `_bmad-output/`, `bmalph/`

5. **Report result**
   - Confirm what was deleted
   - Suggest next steps
