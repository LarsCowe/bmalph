# Ralph Live Dashboard

> **Deprecated:** Use `bmalph run` instead, which starts Ralph and shows the live dashboard. The `watch` command will be removed in a future release.

Launch the bmalph live dashboard to monitor Ralph loop progress in real-time.

## How to Run

Execute the CLI command:
    bmalph watch

## What It Does

- Displays a live-updating terminal dashboard for Ralph loop monitoring
- Shows loop count, circuit breaker state, story progress, and session info
- Displays recent log entries and response analysis
- Auto-refreshes every 2 seconds
- Press `q` or `Ctrl+C` to exit

## When to Use

Use this command while the Ralph loop is running to monitor progress without switching windows. It replaces the legacy `ralph_monitor.sh` script with a more capable TypeScript-based dashboard.
