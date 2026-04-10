# Case Study: Issue #27 — Fix CI/CD So We Never Publish the Same Version Twice

## Summary

The Rust CI/CD auto-release pipeline failed because it attempted to publish `lino-arguments@0.2.0` to crates.io when that version was already published. Multiple root causes were identified and fixed.

## Timeline of Events

| Time (UTC) | Event |
|---|---|
| 2026-04-04 | Rust v0.2.0 successfully published to crates.io and GitHub Release created |
| 2026-04-10 14:44 | Push to main triggers Rust CI/CD (commit `6308d6e`) |
| 2026-04-10 14:45 | Detect Changes: `rs-changed=false`, `workflow-changed=true`, `rust-workflow-changed=true` |
| 2026-04-10 14:45 | Lint, Test, Build jobs pass successfully |
| 2026-04-10 14:46:29 | Auto Release: `check-release-needed.mjs` determines `should_release=true` (found changelog fragments) |
| 2026-04-10 14:46:39 | `publish-crate.mjs` attempts `cargo publish` for v0.2.0 |
| 2026-04-10 14:46:39 | **FAILURE**: `error: crate lino-arguments@0.2.0 already exists on crates.io index` |
| 2026-04-10 14:46:39 | Script reports "Failed to publish for unknown reason" — exit code 1 |

## Root Causes

### Root Cause 1: `publish-crate.mjs` couldn't detect "already exists" errors

**Problem**: The `exec()` function used `stdio: 'inherit'`, which sends stderr directly to the terminal. When `cargo publish` fails, the error details are in stderr — but with `inherit` mode, `error.message` in the catch block only contains the generic `Command failed:` prefix, not the actual error text.

**Evidence** (from CI log line 3402-3403):
```
error: crate lino-arguments@0.2.0 already exists on crates.io index
Failed to publish for unknown reason
```

The script had detection code for `'already exists'` in the catch block, but it could never match because the actual error text was piped to the terminal, not captured.

**Fix**: 
1. Changed `stdio: 'inherit'` to `stdio: 'pipe'` to capture stderr/stdout
2. Added pre-publish check against the crates.io API (`curl -s https://crates.io/api/v1/crates/{name}/{version}`) before attempting `cargo publish`
3. Combined `error.stderr + error.stdout + error.message` for reliable pattern matching

### Root Cause 2: `check-release-needed.mjs` only checked git tags, not the registry

**Problem**: The script checked if a git tag `v{version}` exists to determine if a release was needed. However, git tags and crates.io publication are separate concerns — a tag can exist without a successful publish (failed CI), or a publish can succeed without a tag (manual publish).

**Fix**: Added crates.io API check (`https://crates.io/api/v1/crates/{name}/{version}`) alongside git tag verification. The script now handles four possible states:
- Tag exists + published → skip release
- Tag exists + not published → publish without version bump
- No tag + published → skip release (don't re-publish)
- No tag + not published → publish with version bump

### Root Cause 3: Shared tag prefix between JS and Rust releases

**Problem**: Both JavaScript and Rust releases used the `v` prefix (e.g., `v0.2.0`). This means if JS and Rust versions ever align, they would create conflicting tags and releases.

**Fix**: Introduced language-specific prefixes:
- Rust: `rust_0.2.0` tag, `[Rust] 0.2.0` display name
- JavaScript: `js_0.3.0` tag, `[JavaScript] 0.3.0` display name

### Root Cause 4: Hardcoded package name in `publish-to-npm.mjs`

**Problem**: The npm version check used `npm view "test-anywhere@${version}"` instead of the actual package name from `package.json`. This was likely a copy-paste artifact from a template.

**Fix**: Read `name` field from `./package.json` dynamically.

## Requirements Checklist

| # | Requirement | Status |
|---|---|---|
| 1 | Never publish the same version twice | Fixed (pre-publish registry check + graceful "already exists" handling) |
| 2 | Separate changelogs for JS and Rust | Already in place (`js/CHANGELOG.md`, `rust/CHANGELOG.md`) |
| 3 | Separate versions with separate bumps | Already in place (JS: 0.3.0, Rust: 0.2.0) |
| 4 | Separate releases to crates/npm | Already in place (separate workflows) |
| 5 | Separate GitHub Releases | Fixed (language-specific tag prefixes and display names) |
| 6 | Release prefixes `js_X.Y.Z`, `rust_X.Y.Z` | Fixed |
| 7 | Display names `[Rust] X.Y.Z`, `[JavaScript] X.Y.Z` | Fixed |
| 8 | Badges on each release with direct links | Already in place (shields.io badges added by format scripts) |

## Files Changed

| File | Change |
|---|---|
| `scripts/publish-crate.mjs` | Pre-check crates.io API; capture stderr for error detection |
| `scripts/check-release-needed.mjs` | Check crates.io registry + configurable tag prefix |
| `scripts/version-and-commit.mjs` | Support `--tag-prefix` and `--release-label` |
| `scripts/create-github-release.mjs` | Support `--release-label` for display names |
| `scripts/format-rust-release.mjs` | Configurable tag prefix (default: `rust_`) |
| `scripts/format-github-release.mjs` | Configurable tag prefix |
| `scripts/publish-to-npm.mjs` | Read package name from package.json |
| `.github/workflows/rust.yml` | Pass `rust_` prefix and `Rust` label |
| `.github/workflows/js.yml` | Pass `js_` prefix and `JavaScript` label |

## References

- Failed CI run: https://github.com/link-foundation/lino-arguments/actions/runs/24248668790
- Rust template best practices: https://github.com/link-foundation/rust-ai-driven-development-pipeline-template
- JS template best practices: https://github.com/link-foundation/js-ai-driven-development-pipeline-template
