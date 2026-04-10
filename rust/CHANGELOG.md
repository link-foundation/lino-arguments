# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

<!-- changelog-insert-here -->



## [0.3.0] - 2026-04-10

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
- `LinoParser` trait extending clap's `Parser` — `lino_parse()` automatically loads `.lenv` and `.env` files before CLI parsing
- Full support for `#[arg(long, env = "PORT", default_value = "3000")]` with automatic `.lenv`/`.env` resolution
- `lino_parse_with()`, `lino_parse_from()`, `lino_parse_from_with()` methods for custom file paths and testing
- `load_env_file()` and `load_env_file_override()` for standard `.env` file support via dotenvy
- `.env()` and `.env_override()` methods on `ConfigBuilder` for functional API
- Re-exported clap derive macros (`Parser`, `Args`, `Subcommand`, `ValueEnum`) for struct-based CLI parsing without a separate clap dependency
- `make_config()` functional builder API inspired by the JavaScript `makeConfig` function
- `make_config_from()` for testing with custom arguments
- `Config` type with `.get()`, `.get_int()`, `.get_bool()`, and `.has()` accessors
- `ConfigBuilder` with chainable `.option()`, `.flag()`, `.lenv()`, `.env()`, `.name()`, `.about()`, `.version()` methods
- Examples for both struct-based and functional usage patterns

### Added
- Integration with `lino-env` crate (v0.1.0) for reading `.lenv` configuration files
- New `load_lenv_file()` function to load environment variables from `.lenv` files
- New `load_lenv_file_override()` function to load and overwrite existing environment variables
- Re-exported `LinoEnv`, `read_lino_env`, and `write_lino_env` from `lino-env` crate
- CLI now supports `--configuration` flag to load configuration from `.lenv` files

### Added
- Crates.io version badge to `rust/README.md` and root `README.md` for easy visibility of published Rust package version
- docs.rs documentation badge to `rust/README.md` and root `README.md`
- Rust CI status badge to `rust/README.md`

### Added
- `scripts/format-rust-release.mjs` — new CI/CD script that appends crates.io version and docs.rs badges to Rust GitHub release notes after each release
- Rust CI/CD workflow now calls `format-rust-release.mjs` in both `auto-release` and `manual-release` jobs so every published Rust release automatically includes badge links
- Fixed `scripts/format-release-notes.mjs` to accept named CLI flags (`--release-id`, `--release-version`, `--repository`) in addition to legacy positional arguments, enabling proper npm badge injection for JS releases

### Fixed
- CI/CD: Prevent duplicate version publishing by checking crates.io registry before attempting publish
- CI/CD: Properly capture cargo publish stderr to detect "already exists" errors
- CI/CD: Use language-specific tag prefixes (`rust_X.Y.Z`) to avoid tag collisions with JavaScript releases

## [0.2.0] - 2026-04-04

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
- `LinoParser` trait extending clap's `Parser` — `lino_parse()` automatically loads `.lenv` and `.env` files before CLI parsing
- Full support for `#[arg(long, env = "PORT", default_value = "3000")]` with automatic `.lenv`/`.env` resolution
- `lino_parse_with()`, `lino_parse_from()`, `lino_parse_from_with()` methods for custom file paths and testing
- `load_env_file()` and `load_env_file_override()` for standard `.env` file support via dotenvy
- `.env()` and `.env_override()` methods on `ConfigBuilder` for functional API
- Re-exported clap derive macros (`Parser`, `Args`, `Subcommand`, `ValueEnum`) for struct-based CLI parsing without a separate clap dependency
- `make_config()` functional builder API inspired by the JavaScript `makeConfig` function
- `make_config_from()` for testing with custom arguments
- `Config` type with `.get()`, `.get_int()`, `.get_bool()`, and `.has()` accessors
- `ConfigBuilder` with chainable `.option()`, `.flag()`, `.lenv()`, `.env()`, `.name()`, `.about()`, `.version()` methods
- Examples for both struct-based and functional usage patterns

### Added
- Integration with `lino-env` crate (v0.1.0) for reading `.lenv` configuration files
- New `load_lenv_file()` function to load environment variables from `.lenv` files
- New `load_lenv_file_override()` function to load and overwrite existing environment variables
- Re-exported `LinoEnv`, `read_lino_env`, and `write_lino_env` from `lino-env` crate
- CLI now supports `--configuration` flag to load configuration from `.lenv` files

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

