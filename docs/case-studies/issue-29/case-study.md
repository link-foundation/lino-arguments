# Case Study: Issue #29 — CI/CD for JavaScript Publishing is Broken

## Summary

The JavaScript CI/CD pipeline has not published to npm since version 0.2.5 (Dec 2025), despite version 0.3.0 being committed to `package.json` and tagged in git on Dec 31, 2025. The npm registry shows `lino-arguments@0.2.5` as latest, while the repository has `0.3.0`. Meanwhile, Rust releases (e.g., `rust_0.3.0`) publish successfully, highlighting that the JS pipeline has a structural defect.

## Timeline of Events

| Time (UTC) | Event |
|---|---|
| 2025-12-09 | JS v0.2.5 published to npm (last successful npm publish) |
| 2025-12-31 10:40 | PR #18 merged to main with JS changes + changeset file `add-rust-version.md` |
| 2025-12-31 10:42 | JS CI/CD Release job runs: `changeset version` consumes the changeset, bumps `package.json` to 0.3.0, commits, creates tag `v0.3.0` |
| 2025-12-31 ~10:42 | **FAILURE POINT**: npm publish step either failed or was skipped (logs expired, HTTP 410) |
| 2025-12-31 onward | npm registry still shows 0.2.5 as latest |
| 2026-01-13 21:25 | Push to main triggers JS CI/CD — Release job finds 0 changesets, skips version+publish |
| 2026-04-04 | PR #24 merged — Rust-only changes, no JS code changes |
| 2026-04-10 14:44 | PR #26 merged — CI/CD workflow changes, no JS code changes |
| 2026-04-10 20:47 | PR #28 merged — CI/CD changes; JS CI/CD runs, Release job finds 0 changesets, skips version+publish |
| 2026-04-10 20:49 | Rust `rust_0.3.0` released successfully to crates.io and GitHub |
| 2026-04-10 | Issue #29 opened: "CI/CD for JavaScript publishing is broken" |

## Requirements from the Issue

1. **JS package must be published to npm** — npm shows 0.2.5, repository has 0.3.0
2. **CI logs and data must be downloaded** to `./docs/case-studies/issue-29/`
3. **Deep case study analysis** with timeline, root causes, and solutions
4. **Root cause identification** for each problem
5. **Proposed solutions** with references to existing tools/libraries

## Root Causes

### Root Cause 1: Release job has no fallback when changesets are absent but version is unpublished

**Problem**: The JS `release` job in `.github/workflows/js.yml` has this flow:

```
1. Check for changesets → has_changesets
2. IF has_changesets: Run version-and-commit.mjs → version_committed, already_released
3. IF version_committed OR already_released: Run publish-to-npm.mjs
```

When there are no changeset files (step 1 = false), step 2 is skipped entirely, so `version_committed` and `already_released` are never set. Step 3's condition evaluates to false, and **publish is skipped** — even though `package.json` has an unpublished version.

**Evidence** (from CI run 24263446026, line 5986):
```
Found 0 changeset file(s)
```
The "Version packages" and "Publish to npm" steps were never executed.

**Evidence** (from CI run 20973144893, line 5968):
```
Found 0 changeset file(s)
```
Same pattern — 0 changesets, publish skipped.

**Contrast with Rust pipeline**: The Rust workflow in `rust.yml` has an independent `check-release-needed.mjs` step (lines 292-299) that verifies whether the current version needs releasing regardless of changelog fragment state. The JS workflow lacks this equivalent safeguard.

### Root Cause 2: Original v0.3.0 publish likely failed silently

**Problem**: The Dec 31, 2025 CI run (ID 20617328160) that created the v0.3.0 commit and tag is the one that should have published to npm. However, the CI logs for this run have expired (HTTP 410), so we cannot definitively determine what went wrong.

**Evidence**:
- `npm view lino-arguments versions` returns `["0.2.1", "0.2.5"]` — v0.3.0 is absent
- Git tag `v0.3.0` exists pointing to commit `a2790c6` (the changeset version commit)
- The changeset file `add-rust-version.md` was consumed (removed by `changeset version`)
- `package.json` shows version `0.3.0`

**Most likely cause**: The publish step either encountered a transient npm/OIDC error, or the step condition prevented it from running (similar to Root Cause 1, if the pipeline had an earlier version of this bug).

### Root Cause 3: Tag prefix migration gap

**Problem**: Issue #27 (PR #28) introduced language-specific tag prefixes: `rust_` for Rust, `js_` for JavaScript. The JS workflow now uses `--tag-prefix "js_"` in the release steps. However, no `js_*` tags exist — all existing JS releases used the `v` prefix (v0.1.1, v0.2.0, v0.2.5, v0.2.7, v0.2.8, v0.3.0).

This means:
- `checkTagExists('0.3.0')` with prefix `js_` looks for `js_0.3.0` — not found
- The `create-github-release.mjs` step tries to create a release for tag `js_0.3.0` — tag doesn't exist
- No migration path from `v`-prefix to `js_`-prefix tags was implemented

## Solutions

### Solution 1: Add npm publish check independent of changesets (implemented)

Added a new step `Check if current version needs publishing` to the `release` job that runs after the version step. This step:

1. Reads the current version from `package.json`
2. Checks if that version exists on npm via `npm view`
3. Sets `needs_publish=true` if the version is missing from npm

The publish step condition is updated to also trigger when `needs_publish == 'true'`:
```yaml
if: steps.version.outputs.version_committed == 'true' ||
    steps.version.outputs.already_released == 'true' ||
    steps.check_publish.outputs.needs_publish == 'true'
```

### Solution 2: Add tag migration step (implemented)

Added an `Ensure release tag exists` step that runs before `Create GitHub Release`. This step:

1. Checks if the `js_`-prefixed tag exists
2. If not, looks for an equivalent `v`-prefixed tag and creates the `js_` tag pointing to the same commit
3. Falls back to HEAD if no `v`-prefixed tag exists

This provides a one-time migration path from the old `v` prefix to the new `js_` prefix.

## Files Changed

| File | Change |
|---|---|
| `.github/workflows/js.yml` | Added `Check if current version needs publishing` step, `Ensure release tag exists` step, updated publish condition |

## Verification

After merging this fix to main:

1. The JS CI/CD pipeline will detect that `lino-arguments@0.3.0` is not on npm
2. The publish step will run and publish v0.3.0 to npm
3. The `js_0.3.0` tag will be created from the existing `v0.3.0` tag
4. A `[JavaScript] 0.3.0` GitHub release will be created
5. Future releases with changesets will continue to work as before

## References

- Issue: https://github.com/link-foundation/lino-arguments/issues/29
- PR: https://github.com/link-foundation/lino-arguments/pull/30
- npm package: https://www.npmjs.com/package/lino-arguments
- Rust pipeline (working reference): `.github/workflows/rust.yml` lines 252-346
- `@changesets/cli` docs: https://github.com/changesets/changesets
