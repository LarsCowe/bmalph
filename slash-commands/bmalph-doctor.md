# Check Project Health

Run diagnostic checks on the bmalph installation and report any issues.

## How to Run

Execute the CLI command:
    bmalph doctor

## What It Does

- Verifies required directories exist (`_bmad/`, `.ralph/`, `bmalph/`)
- Checks that slash commands are installed correctly
- Validates the instructions file contains the BMAD snippet
- Reports version mismatches between installed and bundled assets
- Suggests remediation steps for any issues found
