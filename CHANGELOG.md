# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.2.0](https://github.com/LarsCowe/bmalph/compare/v2.1.0...v2.2.0) (2026-02-20)


### Features

* **ts:** enable noUncheckedIndexedAccess for stricter type safety ([bd6d8dd](https://github.com/LarsCowe/bmalph/commit/bd6d8dd65afb70efe6fb0f8b02f4e42dfa44cb27))


### Bug Fixes

* **doctor:** use withErrorHandling for consistency with other commands ([edffd81](https://github.com/LarsCowe/bmalph/commit/edffd81ad364911510ec1af9da1dbf8dc8014e37))
* **installer:** escape project names in YAML config ([6e10ad3](https://github.com/LarsCowe/bmalph/commit/6e10ad3de9e1f07cc95bc442931ac18025290c98))
* **installer:** guard against empty CSV files in manifest generation ([3229d3e](https://github.com/LarsCowe/bmalph/commit/3229d3ee3368e2d2ae4fe63d03fc9e96476fa60a))
* **state:** warn when Ralph status file is corrupted ([4016b17](https://github.com/LarsCowe/bmalph/commit/4016b170226d13238589631fdfc7e6c1da1649a8))
* **transition:** surface non-ENOENT errors instead of silently swallowing ([786c659](https://github.com/LarsCowe/bmalph/commit/786c65984ae145cb9397f03ad9e018b3e984b4c0))


### Code Quality

* consolidate transition barrel exports into index.ts ([a8c2362](https://github.com/LarsCowe/bmalph/commit/a8c2362f3756cd0fbd452c3502b8bebae09b2814))
* extract exists() helper to reduce try/access/catch boilerplate ([b0d043f](https://github.com/LarsCowe/bmalph/commit/b0d043fe9f7c53f442921de2a78d9b30086d559f))
* **github:** extract SHA comparison and status building helpers ([b18c04f](https://github.com/LarsCowe/bmalph/commit/b18c04fbbcb3e7a2c1b1a1971773a19802907f90))
* harden error handling, file operations, and input validation ([029ab22](https://github.com/LarsCowe/bmalph/commit/029ab2294295b243144f9209287eb8b120414bf6))
* **installer:** use warn() instead of console.error for CSV mismatch ([c390be5](https://github.com/LarsCowe/bmalph/commit/c390be5a7204b32cd1702b37415d78d6772294c4))
* move getSkipReason to github utility for reuse ([d7d9cd5](https://github.com/LarsCowe/bmalph/commit/d7d9cd5d918fb443ccfa764c01185be506355d2d))
* resolve projectDir in CLI and make it required in commands ([51d576a](https://github.com/LarsCowe/bmalph/commit/51d576a849362b66c5e25f0af5eca03670f23bab))
* **transition:** add progress logging to orchestration ([d156d87](https://github.com/LarsCowe/bmalph/commit/d156d876c5e3bdbbbeec1fb6780a3be7d5cb7429))

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
