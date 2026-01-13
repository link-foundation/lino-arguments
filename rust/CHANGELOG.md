# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!-- changelog-insert-here -->

## [0.1.0] - 2026-01-13

### Changed

- Updated Rust CI/CD workflow to match best practices from rust-ai-driven-development-pipeline-template
- Added `detect-changes` job for conditional job execution based on file changes
- Added `version-check` job to prevent manual version modification in PRs
- Added crates.io publishing support with `CARGO_REGISTRY_TOKEN` or `CARGO_TOKEN`
- Added `changelog-pr` manual release mode for review-based releases
- Added multi-language repository support via `rust-paths.mjs` utility
- Improved job conditions using `always() && !cancelled()` pattern for proper dependency handling

### Added

- `scripts/rust-paths.mjs` - Core utility for auto-detecting Rust package root in multi-language repos
- `scripts/detect-code-changes.mjs` - File change detection for conditional CI/CD job execution
- `scripts/check-version-modification.mjs` - Prevents manual version changes in PRs
- `scripts/check-changelog-fragment.mjs` - Validates changelog fragments in pull requests
- `scripts/git-config.mjs` - Git user configuration utility for CI/CD
- `scripts/get-bump-type.mjs` - Determines version bump type from changelog fragment frontmatter
- `scripts/check-release-needed.mjs` - Checks if a release should proceed
- `scripts/get-version.mjs` - Extracts version from Cargo.toml
- `scripts/collect-changelog.mjs` - Collects and processes changelog fragments
- `scripts/create-changelog-fragment.mjs` - Creates changelog fragments for manual releases
- `scripts/publish-crate.mjs` - Publishes package to crates.io with multi-repo support

### Added
- Integration with `lino-env` crate (v0.1.0) for reading `.lenv` configuration files
- New `load_lenv_file()` function to load environment variables from `.lenv` files
- New `load_lenv_file_override()` function to load and overwrite existing environment variables
- Re-exported `LinoEnv`, `read_lino_env`, and `write_lino_env` from `lino-env` crate
- CLI now supports `--configuration` flag to load configuration from `.lenv` files

