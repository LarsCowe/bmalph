# bmalph Doctor

Run health checks on the bmalph installation.

## Checks to Perform

### 1. Node.js Version
- Required: Node.js 20+
- Check: Parse `process.versions.node` major version
- Pass: Major version >= 20
- Fail: Show actual version

### 2. Bash Available
- Required: bash command available in PATH
- Check: Run `which bash` (Unix) or `where bash` (Windows)
- Pass: Command succeeds
- Fail: "bash not found in PATH"

### 3. bmalph/config.json
- Required: Valid JSON configuration file
- Check: Read and parse `bmalph/config.json`
- Pass: File exists and is valid JSON
- Fail: "file not found" or parse error

### 4. _bmad/ Directory
- Required: BMAD agents and workflows installed
- Check: `_bmad/` directory exists
- Pass: Directory exists
- Fail: "not found"

### 5. .ralph/ralph_loop.sh
- Required: Ralph loop script present with content
- Check: File exists and is not empty
- Pass: File exists and has content
- Fail: "not found" or "empty file"

### 6. .ralph/lib/ Directory
- Required: Ralph library files installed
- Check: `.ralph/lib/` directory exists
- Pass: Directory exists
- Fail: "not found"

### 7. .claude/commands/bmalph.md
- Required: Main slash command installed
- Check: `.claude/commands/bmalph.md` exists
- Pass: File exists
- Fail: "not found"

### 8. CLAUDE.md BMAD Snippet
- Required: CLAUDE.md contains BMAD integration instructions
- Check: CLAUDE.md contains "BMAD-METHOD Integration"
- Pass: String found in file
- Fail: "CLAUDE.md not found" or "BMAD snippet not found"

### 9. .gitignore Entries
- Required: `.ralph/logs/` and `_bmad-output/` in .gitignore
- Check: Both entries present in .gitignore
- Pass: All entries found
- Fail: "missing: [entries]"

### 10. Version Marker
- Required: Installed version matches current bmalph version
- Check: Parse `# bmalph-version: X.X.X` from `.ralph/ralph_loop.sh`
- Pass: Versions match
- Fail: "installed: X.X.X, current: Y.Y.Y"

## Output Format

```
bmalph doctor

  ✓ Node version >= 20 (v22.0.0)
  ✓ bash available
  ✓ bmalph/config.json exists and valid
  ✓ _bmad/ directory present
  ✗ .ralph/ralph_loop.sh present and has content (not found)
  ✓ .ralph/lib/ directory present
  ✓ .claude/commands/bmalph.md present
  ✓ CLAUDE.md contains BMAD snippet
  ✓ .gitignore has required entries
  ✗ version marker matches (installed: 0.8.15, current: 0.8.17)

8 passed, 2 failed
```

Use:
- ✓ (green) for passed checks
- ✗ (red) for failed checks
- Show details in parentheses when helpful
