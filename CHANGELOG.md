# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.7.1](https://github.com/LarsCowe/bmalph/compare/v2.7.0...v2.7.1) (2026-03-04)


### Bug Fixes

* **doctor:** return non-zero exit for failed checks in json mode ([53801bd](https://github.com/LarsCowe/bmalph/commit/53801bd136953ea5c5630b44817640f054673dd1))
* **run:** propagate Ralph exit code ([176350d](https://github.com/LarsCowe/bmalph/commit/176350d141eda413d1948ab38ff0e7b438282794))
* **run:** use bash-safe relative ralph loop spawn path ([abc0627](https://github.com/LarsCowe/bmalph/commit/abc0627f80de6738cb34113fd7c813bc76d0cf79))

## [2.7.0](https://github.com/LarsCowe/bmalph/compare/v2.6.0...v2.7.0) (2026-03-04)


### Features

* add Codex skills delivery, promote Cursor to full tier, and add lite PRD workflow ([36c5c72](https://github.com/LarsCowe/bmalph/commit/36c5c726ae887ff144e6fe464264904c7b1bb578))
* promote Cursor to full tier with experimental flag ([1b3a9e6](https://github.com/LarsCowe/bmalph/commit/1b3a9e69f6c55c5f06e074bc8eb828c1a6490177))


### Bug Fixes

* harden error handling, eliminate injection surfaces, and reduce duplication ([d5e169b](https://github.com/LarsCowe/bmalph/commit/d5e169bb7bcc24a0a01f5eb82ebcd873d0d3e0bf))
* harden process lifecycle, tighten artifact matching, and fill test gaps ([ebf75ac](https://github.com/LarsCowe/bmalph/commit/ebf75ac2afe128eca70324b0bcadfaae71435c83))


### Code Quality

* eliminate duplication, normalize patterns, and expand test coverage ([238a1d8](https://github.com/LarsCowe/bmalph/commit/238a1d8c9f2f97f5dfb8b21e049a345d7aacbf84))

## [2.6.0](https://github.com/LarsCowe/bmalph/compare/v2.5.0...v2.6.0) (2026-02-28)


### Features

* add bmalph run command to start Ralph loop with dashboard ([70bf737](https://github.com/LarsCowe/bmalph/commit/70bf737c791582cef2d8caebf15ba8abe21b1e3d))
* deprecate bmalph watch in favor of bmalph run ([4da6764](https://github.com/LarsCowe/bmalph/commit/4da676466b5cac915d649f07dbf8870c99cd5bf7))
* promote Copilot to full tier with experimental flag ([a776dc3](https://github.com/LarsCowe/bmalph/commit/a776dc38d0fd2e1d3a032aaa9efd60dfc1083665))


### Code Quality

* simplify codebase and extract shared platform logic ([233f4be](https://github.com/LarsCowe/bmalph/commit/233f4be6924e47fa79c7225b3e39041c8897bb73))

## [2.5.0](https://github.com/LarsCowe/bmalph/compare/v2.4.0...v2.5.0) (2026-02-27)


### Features

* **ralph:** add /bmalph-watch slash command ([902376f](https://github.com/LarsCowe/bmalph/commit/902376ff692b54caa2846984499507fb82a7f022))
* **watch:** add live dashboard for Ralph loop monitoring ([be9ec34](https://github.com/LarsCowe/bmalph/commit/be9ec344a11a34ed8112b64909f6e42ffd410a1d))


### Bug Fixes

* **ralph:** deduplicate PRD task extraction in task_sources ([add09fc](https://github.com/LarsCowe/bmalph/commit/add09fcfcbc7fe3e94ad48e4c244329a7f715c23))
* **ralph:** detect completion mismatch and deprecate legacy scripts ([1711aab](https://github.com/LarsCowe/bmalph/commit/1711aabd2daab4616dfcc28b9694435b49fb2b6b))
* **ralph:** prevent set -e leak and CWD pollution in ralph_loop tests ([2d0b98d](https://github.com/LarsCowe/bmalph/commit/2d0b98d166fc6684f8f02a2dfd4d3504a41434cb))
* **ralph:** resolve 3 known bugs in wizard_utils, enable_core, task_sources ([a311aaa](https://github.com/LarsCowe/bmalph/commit/a311aaa461f9dc365bec10d4e6e9a0ce355dc739))
* **ralph:** use jq for JSON generation to prevent injection from special characters ([1270f14](https://github.com/LarsCowe/bmalph/commit/1270f1415fe4079ff297a66d07c3d1f3fd3aa63b))
* **tests:** increase previewUpgrade timeout for Windows CI ([cdcd647](https://github.com/LarsCowe/bmalph/commit/cdcd6471a2512e0b5fb72fe1e4998a0604b5642b))
* **watch:** rename completionMismatch to ralphCompleted, fix status tests ([e679c9f](https://github.com/LarsCowe/bmalph/commit/e679c9f3b7d2d7c9223c6c4593f01fef851ae040))


### Code Quality

* remove deprecated exports and update docs ([ee817d4](https://github.com/LarsCowe/bmalph/commit/ee817d4c71bfc50ec7f2190e39423c6153581c8e))

## [2.4.0](https://github.com/LarsCowe/bmalph/compare/v2.3.0...v2.4.0) (2026-02-23)


### Features

* add bmalph implement CLI command with pre-flight validation ([9932717](https://github.com/LarsCowe/bmalph/commit/99327171e53afd2d0394611835e1d9c19ee1dfb6))
* add slash commands and remove /bmalph-reset reference ([a30d484](https://github.com/LarsCowe/bmalph/commit/a30d484a26f8c29335ac6af97d7a01dc71fe8d4c))
* **doctor:** add jq availability check ([19824dc](https://github.com/LarsCowe/bmalph/commit/19824dc8d80577bc315b75982ee6943b23e8aa39))
* **implement:** add re-run protection and file generation summary ([e53d0d4](https://github.com/LarsCowe/bmalph/commit/e53d0d4597b910014da5631a81f106f2c557f66a))
* **reset:** add bmalph reset command ([3231b6a](https://github.com/LarsCowe/bmalph/commit/3231b6add12135ebde5226cd172c19e2020e85a7))
* **status:** detect phase from BMAD artifacts during phases 1-3 ([67593c4](https://github.com/LarsCowe/bmalph/commit/67593c4dadfcece0b8606fce89c6f5e011e52971))
* **transition:** improve artifact detection and progress preservation ([02709cc](https://github.com/LarsCowe/bmalph/commit/02709ccf37c502fd1af5bf431a2582e563a24696))
* **validate:** read task counts from Ralph status data ([329e8b5](https://github.com/LarsCowe/bmalph/commit/329e8b5f0e86c5b1d404b909cc9c899ac9e32c7a))

## [2.3.0](https://github.com/LarsCowe/bmalph/compare/v2.2.1...v2.3.0) (2026-02-21)


### Features

* add multi-platform support for six AI coding assistants ([#54](https://github.com/LarsCowe/bmalph/issues/54)) ([864316e](https://github.com/LarsCowe/bmalph/commit/864316ed91aa329110bc0859e886b1cbd25f99e1))
* **init:** detect existing BMAD installation during init ([42d0047](https://github.com/LarsCowe/bmalph/commit/42d0047573f69484c84eff09fd0098a53332cec6)), closes [#52](https://github.com/LarsCowe/bmalph/issues/52)


### Bug Fixes

* prevent data loss in atomic _bmad copy with rename-aside pattern ([b728a58](https://github.com/LarsCowe/bmalph/commit/b728a58c96bd9707a04a7d4009fffe0da2b41bf4))
* **transition:** handle unreadable new spec file in changelog generation ([2d3cb9e](https://github.com/LarsCowe/bmalph/commit/2d3cb9e36d3bb04848078c416a0852582789319e))
* **transition:** warn when readiness report is unreadable during NO-GO check ([69fba65](https://github.com/LarsCowe/bmalph/commit/69fba65b53ba80dce3046fc2690fab17343f9fb1))

## [2.2.1](https://github.com/LarsCowe/bmalph/compare/v2.2.0...v2.2.1) (2026-02-21)


### Bug Fixes

* correct 4 Ralph integration bugs ([1fc394a](https://github.com/LarsCowe/bmalph/commit/1fc394ac2d7c5d3bcbdc38abc57fcee69354085b))


### Code Quality

* remove Ralph upstream tracking ([a00a80b](https://github.com/LarsCowe/bmalph/commit/a00a80b7f9db5667ba1914a2a3d40daab72de481))

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
