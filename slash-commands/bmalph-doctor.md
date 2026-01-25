# bmalph Doctor

Run health checks on the bmalph installation.

## How to Run

Run the following command in the terminal:

```bash
bmalph doctor
```

Or if bmalph is not installed globally:

```bash
npx bmalph doctor
```

## Checks Performed

| # | Check | Description |
|---|-------|-------------|
| 1 | Node version >= 20 | Node.js 20+ is required |
| 2 | bash available | Required for Ralph loop |
| 3 | bmalph/config.json | Valid project configuration |
| 4 | _bmad/ directory | BMAD agents and workflows |
| 5 | .ralph/ralph_loop.sh | Ralph loop script present |
| 6 | .ralph/lib/ directory | Ralph library files |
| 7 | .claude/commands/bmalph.md | Main slash command |
| 8 | CLAUDE.md BMAD snippet | Integration instructions |
| 9 | .gitignore entries | Required ignore patterns |
| 10 | Version marker | Installed vs bundled version |

## Example Output

```
bmalph doctor

  ✓ Node version >= 20 (v22.0.0)
  ✓ bash available
  ✓ bmalph/config.json exists and valid
  ✓ _bmad/ directory present
  ✓ ralph_loop.sh present and has content
  ✓ .ralph/lib/ directory present
  ✓ .claude/commands/bmalph.md present
  ✓ CLAUDE.md contains BMAD snippet
  ✓ .gitignore has required entries
  ✗ version marker matches (installed: 0.8.15, current: 0.8.19)

9 passed, 1 failed
```

## Fixing Issues

- **Version mismatch**: Run `bmalph upgrade`
- **Missing directories**: Run `bmalph init` or `bmalph upgrade`
- **bash not found**: Install Git Bash (Windows) or ensure bash is in PATH
