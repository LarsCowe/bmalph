# Contributing to bmalph

## Development Setup

```bash
# Clone the repository
git clone https://github.com/LarsCowe/bmalph.git
cd bmalph

# Install dependencies
npm install

# Build TypeScript
npm run build

# Run the full local test matrix
npm run test:all

# Run the full local gate
npm run ci
```

### Requirements

- Node.js 20+ (LTS)
- npm 10+
- Bash for bundled Ralph and Bats coverage

## Project Structure

```text
bmalph/
├── src/                           # TypeScript source
│   ├── cli.ts                     # Commander.js CLI entry point
│   ├── installer/                 # Asset copying, command delivery, skills generation
│   ├── commands/                  # init, upgrade, doctor, status, implement, run, watch, reset
│   ├── platform/                  # Platform registry, detection, snippets, runtime checks
│   │   ├── cursor-runtime-checks.ts
│   │   ├── doctor-checks.ts
│   │   └── instructions-snippet.ts
│   ├── run/                       # Bash discovery, Ralph spawn, live dashboard
│   ├── transition/                # BMAD -> Ralph transition pipeline
│   ├── watch/                     # Deprecated standalone dashboard path
│   ├── reset.ts                   # Reset planner/executor
│   └── utils/                     # Shared utilities
├── tests/                         # Vitest suites
│   ├── bash/                      # Bats coverage for bundled shell assets
│   ├── commands/                  # Command unit tests
│   ├── e2e/                       # CLI workflow smoke tests
│   ├── platform/                  # Platform and detection tests
│   ├── run/                       # Run/dashboard process tests
│   ├── transition/                # Transition tests
│   └── watch/                     # Dashboard/watch tests
├── bmad/                          # Bundled BMAD-METHOD assets
├── ralph/                         # Bundled Ralph assets and templates
│   ├── drivers/                   # claude-code.sh, codex.sh, opencode.sh, copilot.sh, cursor.sh, cursor-agent-wrapper.sh
│   ├── lib/                       # Shared shell libraries
│   ├── templates/                 # PROMPT, AGENT, ralphrc templates
│   └── RALPH-REFERENCE.md         # Bundled loop/runtime reference
├── slash-commands/                # Claude Code command sources
├── scripts/                       # Maintenance and test runner scripts
├── bin/                           # CLI entry point
└── dist/                          # Compiled JavaScript (generated)
```

High-signal files for the current multi-platform runtime path:

- `src/platform/cursor-runtime-checks.ts`
- `src/run/ralph-process.ts`
- `tests/bash/`

## Test Workflow

### Unit Tests

```bash
# Run all Vitest suites except the dedicated E2E config
npm test

# Run a specific test file
npm test -- --run tests/platform/cursor-runtime-checks.test.ts

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

### Bash Tests

**Prerequisites:**

- [bats-core](https://github.com/bats-core/bats-core) must be installed
  (`brew install bats-core` on macOS, `sudo apt-get install bats` on Ubuntu).

Bundled shell assets are covered by Bats tests under `tests/bash/`.

Test helpers (`bats-support`, `bats-assert`) are installed automatically by
the script below.

```bash
# Install bats-core test helpers (one-time setup)
bash scripts/setup-bats.sh

# Run bash/driver/response-analyzer coverage
npm run test:bash
```

`npm run test:bash` uses system-installed `bats` if available, falling back to `npx bats`
when bats-core is not in PATH.

### End-to-End Tests

E2E tests verify complete workflows in isolated temp directories.

```bash
# Run E2E tests only
npm run test:e2e

# Run all tests (Vitest + E2E + Bats)
npm run test:all
```

### Test Philosophy

- **TDD**: Write tests first, then implement
- Unit tests mock external dependencies at system boundaries
- E2E tests run actual CLI commands in real directories
- Bash tests protect the bundled Ralph loop, drivers, and response analyzer

## Updating Bundled Assets

bmalph bundles BMAD-METHOD from its upstream repository. Ralph is maintained in-tree in this repo.

### Check for Updates

```bash
# Check if bundled versions are up to date
bmalph check-updates
```

### Update Process

```bash
# Sync bundled BMAD assets
npm run update-bundled

# This script:
# 1. Syncs bmad/ from the tracked checkout in .refs/bmad/
# 2. Copies bmm/ and core/ into bmad/
# 3. Updates bundled-versions.json with the upstream BMAD commit

# After updating:
npm run build
npm run test:all
```

### What Gets Bundled

| Source                     | Destination | Contents                             |
| -------------------------- | ----------- | ------------------------------------ |
| `.refs/bmad/bmm` + `core/` | `bmad/`     | Agents, workflows, templates, config |

## Commit Guidelines

We use [Conventional Commits](https://www.conventionalcommits.org/) with SemVer versioning.

### Commit Types

| Type       | SemVer | Description           |
| ---------- | ------ | --------------------- |
| `feat`     | MINOR  | New feature           |
| `fix`      | PATCH  | Bug fix               |
| `docs`     | PATCH  | Documentation only    |
| `refactor` | PATCH  | Code restructuring    |
| `test`     | PATCH  | Adding/updating tests |
| `chore`    | PATCH  | Maintenance tasks     |

### Version Bumping

Versions are managed automatically by [release-please](https://github.com/googleapis/release-please). Do **not** manually edit `package.json` version.

On every push to `main`, release-please analyzes commit messages and opens (or updates) a release PR with the correct version bump and changelog. Merging that PR triggers npm publish.

### Breaking Changes

Use `!` after type or add `BREAKING CHANGE:` footer:

```bash
git commit -m "feat(api)!: change response format"
```

## Code Style

- TypeScript strict mode
- ESLint for linting
- Prettier for formatting

```bash
# Check lint
npm run lint

# Format code
npm run fmt:fix

# Full check (types + lint + format + build + tests)
npm run ci
```

## Pull Request Process

1. Create a feature branch from `main`.
2. Write tests first.
3. Implement the change.
4. Ensure `npm run ci` passes locally.
5. Open a PR with a clear description.

## Questions?

Open an issue at [github.com/LarsCowe/bmalph/issues](https://github.com/LarsCowe/bmalph/issues)
