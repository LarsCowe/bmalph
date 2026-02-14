# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-02-14

### Breaking Changes

- Update bundled BMAD to v6.0.0-Beta.8 and Ralph to v0.11.4

### Added

- `status` command for project state overview
- `check-updates` command for upstream version checking
- `update-bundled` script for upstream asset updates
- `--dry-run` flag for init and upgrade commands
- `--no-color` flag and `--quiet` mode for CLI output control
- `--project-dir` flag wired through all commands
- `doctor --json` output with remediation hints
- Upgrade confirmation prompt with TTY detection and dynamic preview
- SPECS_INDEX.md generation for smart spec reading during transition
- Full BMAD spec preservation during Ralph transition
- Enhanced Ralph integration with documentation and health checks
- Windows CI runner in GitHub Actions matrix
- Comprehensive CLI end-to-end tests
- CONTRIBUTING.md with development guidelines

### Fixed

- mergeClaudeMd no longer truncates content after BMAD section
- Stale specs cleaned before copying fresh artifacts during transition
- Critical bugs in BMAD to Ralph transition flow
- fix_plan.md references aligned with `@` prefix convention
- Trailing comma normalization in CSV header comparison
- Debug logging added to previously silent catch blocks
- 10+ bugs across validation, parsing, and error handling
- Cache cleanup and race condition handling improvements
- Go detection regex and magic number replacement
- `@types/node` pinned to ^20 for LTS compatibility
- LF line endings enforced for Windows CI compatibility

### Changed

- Bundled dir getters renamed and path constants centralized
- RalphStatus type consolidated, unsafe cast removed
- Error handling consolidated with isEnoent helper and formatError
- Shared error handling wrapper extracted for commands
- GitHub cache converted to class pattern for testability
- Transition logic split into modular architecture

## [1.0.0] - 2025-01-25

### Added

- Full test coverage for all CLI commands (doctor, upgrade, init)
- Logger utility tests
- CLI integration tests
- CHANGELOG.md for tracking releases

### Fixed

- Version display in CLI now matches package.json (was hardcoded to 0.8.4)

### Changed

- Simplified slash commands (removed redundant bmalph-status, bmalph-reset, etc.)
- CLI reads version dynamically from package.json

## [0.8.x] - Previous releases

### Added

- Initial BMAD + Ralph integration
- CLI commands: init, upgrade, doctor
- Transition workflow: /bmalph-implement
- 50+ BMAD slash commands
- Ralph loop and lib installation
- Automatic CLAUDE.md snippet merging
- Version marker in ralph_loop.sh for upgrade tracking

[2.0.0]: https://github.com/LarsCowe/bmalph/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/LarsCowe/bmalph/releases/tag/v1.0.0
