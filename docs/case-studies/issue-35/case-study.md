# Case Study: Issue #35 — version-and-commit.mjs checks git tags instead of registry

## Summary

The `version-and-commit.mjs` script used `git rev-parse` to check if a version tag exists, and exited early if it did. This caused the release pipeline to get permanently stuck when GitHub releases created tags without the package being published to the registry (npm/crates.io).

## Timeline / Sequence of Events

1. **Discovery in browser-commander**: The bug was first discovered in [link-foundation/browser-commander#47](https://github.com/link-foundation/browser-commander/issues/47), where the Rust CI/CD pipeline was stuck at version 0.4.0 on crates.io while GitHub had releases up to v0.8.0.

2. **Root cause identified**: The `checkTagExists()` function in `version-and-commit.mjs` treated git tags as the source of truth for whether a package was published. However, git tags can exist without the package being published (e.g., failed publish, GitHub-only releases, manual tag creation).

3. **Issue reported**: Filed as [lino-arguments#35](https://github.com/link-foundation/lino-arguments/issues/35) on 2026-04-13. Same issue also reported in template repo: [rust-ai-driven-development-pipeline-template#25](https://github.com/link-foundation/rust-ai-driven-development-pipeline-template/issues/25).

4. **Template repo already fixed**: The template repository's Rust version (`version-and-commit.rs`) already had the fix with registry-based checks, `getMaxPublishedVersion()`, and `ensureVersionExceedsPublished()` with auto-recovery.

## Root Cause Analysis

### The Bug

In `version-and-commit.mjs`, all three modes (rust, changeset, instant) had the same pattern:

```javascript
if (checkTagExists(newVersion)) {
    console.log(`Tag ${tagPrefix}${newVersion} already exists`);
    setOutput('already_released', 'true');
    // exits WITHOUT bumping version
}
```

Where `checkTagExists` only checked git tags:

```javascript
function checkTagExists(version) {
    exec(`git rev-parse ${tagPrefix}${version}`, { stdio: 'ignore' });
    return true;
}
```

### The Failure Loop

1. Script bumps version (e.g., 1.0.0 → 1.0.1)
2. Checks tag `v1.0.1` → EXISTS (from a prior GitHub-only release)
3. Exits early WITHOUT updating version file
4. Publish step tries old version → "already exists" on registry
5. Pipeline is permanently stuck — every subsequent run hits the same tag

### Why Git Tags Are Wrong Source of Truth

- GitHub releases create git tags automatically
- A failed `cargo publish` or `npm publish` leaves the tag but no published package
- Manual tag creation can also cause this
- The registry (npm/crates.io) is the actual source of truth for published packages

## Requirements

1. **R1**: Check the package registry (npm/crates.io) instead of git tags to determine if a version is already published
2. **R2**: Auto-recover from stuck states where the proposed version is <= the max published version
3. **R3**: Support all three modes: rust (crates.io), changeset (npm), instant (npm)
4. **R4**: Maintain git tag checks as a secondary signal (both tag AND registry)
5. **R5**: Follow the pattern already established in the template repo's `version-and-commit.rs`

## Solution

### Functions Added

| Function | Purpose |
|----------|---------|
| `checkVersionOnCratesIo(crateName, version)` | Check if a specific version exists on crates.io |
| `checkVersionOnNpm(packageName, version)` | Check if a specific version exists on npm |
| `getMaxPublishedCratesIoVersion(crateName)` | Find the highest non-yanked version on crates.io |
| `getMaxPublishedNpmVersion(packageName)` | Find the highest version on npm |
| `getCrateName()` | Extract crate name from Cargo.toml |
| `ensureVersionExceedsPublished(...)` | Auto-recover: bump patch until finding an unpublished version |

### Recovery Logic

The `ensureVersionExceedsPublished()` function:
1. Compares proposed version against max published version
2. If proposed <= max published, adjusts to max_published.patch + 1
3. Loops to skip any versions that already have a tag OR are already published
4. Safety limit of 100 iterations to prevent infinite loops

### Changes Per Mode

- **Rust mode**: Queries crates.io API for published versions
- **Changeset mode**: Queries npm registry for published versions
- **Instant mode**: Queries npm registry for published versions

## Verification

Test script `experiments/test-registry-checks.mjs` validates:
- Registry existence checks for both crates.io and npm (published and unpublished versions)
- Max published version detection
- Auto-recovery from stuck versions
- All 14 tests pass

## Related Issues

- [link-foundation/browser-commander#47](https://github.com/link-foundation/browser-commander/issues/47) — Original discovery
- [link-foundation/rust-ai-driven-development-pipeline-template#25](https://github.com/link-foundation/rust-ai-driven-development-pipeline-template/issues/25) — Same bug in template repo
