---
paths:
  - "src/cli.ts"
  - "src/commands/**"
  - "src/run/**"
---

# CLI Reference

## Global options

`--verbose`, `--quiet`, `--no-color`, `-C/--project-dir <path>`

## Per-command flags

| Command         | Flags                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------- |
| `init`          | `-n/--name`, `-d/--description`, `--platform <id>`, `--dry-run`                              |
| `upgrade`       | `--dry-run`, `--force`                                                                       |
| `doctor`        | `--json`                                                                                     |
| `check-updates` | `--json`                                                                                     |
| `status`        | `--json`                                                                                     |
| `implement`     | `--force`                                                                                    |
| `reset`         | `--dry-run`, `--force`                                                                       |
| `run`           | `--driver <platform>`, `--interval <ms>`, `--no-dashboard`, `--review [mode]`, `--no-review` |
| `watch`         | `--interval <ms>` _(deprecated)_                                                             |

## `bmalph run` features

- **Periodic code review** — runs between implementation loops. Modes: `enhanced` (~10-14% extra tokens) or `ultimate` (~20-30%). Disable with `--no-review`.
- **Task injection** — injects the next unchecked task into each loop's context
- **Git diff injection** — summarizes staged/unstaged changes into inter-loop context
- **Error resilience** — captures stderr, logs exit reason on driver crash/timeout, detects missing git repos
