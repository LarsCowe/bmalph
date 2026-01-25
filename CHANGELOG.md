# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
