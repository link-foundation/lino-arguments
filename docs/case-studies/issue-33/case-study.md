# Case Study: Issue #33 - Fix CI/CD JavaScript Release Flow

## Summary

The JavaScript CI/CD release pipeline failed to create a GitHub Release and `js_` prefixed tag for version `0.3.0`, even though the npm publish succeeded. The root causes were a missing git identity configuration and a workflow design that tightly coupled tag/release creation to the publish step, preventing recovery on re-runs.

## Timeline of Events

### 2026-04-10T21:41:33Z - First Run (ID: 24265468331) - FAILED

1. **Detect Changes** - Success: Changes detected on main branch push.
2. **Lint and Format Check** - Success.
3. **Tests (9 matrix combinations)** - All passed.
4. **Release job** started:
   - `npm install` - Success
   - `setup-npm.mjs` (upgrade npm for OIDC) - Success
   - **Check for changesets**: Found 0 changeset files (already consumed by prior version commit)
   - **Check if current version needs publishing**: `lino-arguments@0.3.0` NOT on npm -> `needs_publish=true`
   - **Publish to npm** (`publish-to-npm.mjs --should-pull`):
     - Verification confirmed 0.3.0 not on npm
     - Attempt 1: `changeset publish` returned E404 errors from npm registry
       - Error: `E404 Not Found - PUT https://registry.npmjs.org/lino-arguments - Not found`
       - This was likely due to npm OIDC trusted publishing settings not being fully propagated
     - Post-publish verification succeeded (3s delay was sufficient for registry propagation)
     - Script reported: `Published lino-arguments@0.3.0 to npm`
   - **Ensure release tag exists**: `js_0.3.0` tag did not exist, attempted to create it
     - **FAILED**: `fatal: empty ident name ... not allowed`
     - Git identity (user.name, user.email) was not configured
     - Exit code 128

**Root Cause 1**: The `release` job in `js.yml` did not call `git-config.mjs` before creating annotated tags. The Rust workflow (`rust.yml`) correctly includes this step, but it was missing from the JavaScript workflow.

### 2026-04-10T22:22:47Z - Restarted Run (ID: 24266896541) - "SUCCESS" (but incomplete)

1. All tests passed again.
2. **Release job** started:
   - `npm install`, `setup-npm.mjs` - Success
   - **Check for changesets**: Found 0 changeset files
   - **Check if current version needs publishing**: `0.3.0` is already published on npm -> `needs_publish=false`
   - Since `version_committed` was not true (no changesets), `already_released` was not true, and `needs_publish` was false, the **Publish step was skipped**
   - Since publish step was skipped, `published` output was never set
   - **Tag creation, GitHub Release, and release notes steps were all skipped** (conditioned on `published == 'true'`)

**Root Cause 2**: The workflow conditioned tag/release creation entirely on the `published` output from the publish step. When a version is already on npm but no GitHub Release exists (partial failure recovery), there was no way to create the missing release artifacts.

### Result

- `lino-arguments@0.3.0` was published to npm successfully
- No `js_0.3.0` tag was created (only `v0.3.0` from the old tag scheme exists)
- No GitHub Release was created for the JavaScript 0.3.0 release
- The CI run showed "success" on restart, masking the incomplete release

## Root Causes

### 1. Missing git identity configuration in js.yml release job

The "Ensure release tag exists" step runs `git tag -a` which requires `user.name` and `user.email` to be configured. The Rust workflow calls `git-config.mjs` but the JavaScript workflow did not.

**Evidence**: Failed run log line 6080-6092:
```
Committer identity unknown
*** Please tell me who you are.
fatal: empty ident name ... not allowed
```

### 2. Tightly coupled release artifact creation

Tag creation and GitHub Release creation were conditioned on `steps.publish.outputs.published == 'true'`. This meant:
- If the publish step succeeds but tag creation fails, restarting skips everything
- If the publish step is skipped (version already on npm), no tag or release is created
- No recovery path for "published on npm but missing GitHub Release"

### 3. Changeset publish silent failure behavior

The `@changesets/cli` `publish` command can exit with code 0 even when individual packages fail to publish. The `publish-to-npm.mjs` script already had post-publish verification to catch this, but error logging could be improved for debugging transient OIDC/npm issues.

## Solutions Implemented

### Fix 1: Add git identity configuration

Added a "Configure git identity" step using `git-config.mjs` in both the `release` and `instant-release` jobs of `js.yml`, before any steps that might create git tags or commits.

### Fix 2: Decouple tag/release creation from publish step

Added a new "Determine release version" step that:
1. Resolves the release version from publish outputs or package.json
2. Checks if the `js_` prefixed tag exists
3. Checks if a GitHub Release exists for that tag
4. Sets `needs_tag` and `needs_release` outputs independently

Tag creation and GitHub Release creation now use these independent checks instead of being gated on `published == 'true'`. This ensures:
- Re-runs create missing tags and releases even if the version is already on npm
- Partial failures are recovered automatically
- Idempotent behavior: existing tags/releases are detected and skipped

### Fix 3: Improved publish script logging

Updated `publish-to-npm.mjs` to:
- Always run post-publish verification regardless of whether changeset publish succeeded or failed
- Log which attempt number succeeded or failed
- Provide clearer error messages for debugging

## Files Changed

- `.github/workflows/js.yml` - Added git config, decoupled release creation
- `scripts/publish-to-npm.mjs` - Improved error handling and logging

## Related Issues and Context

- Issue #31 (docs/case-studies/issue-31/): Previous npm OIDC trusted publishing setup
- The npm OIDC trusted publishing requires the workflow filename to match the config at npmjs.com

## Artifacts

- `ci-logs/failed-run-24265468331.log` - Full logs from the failed run
- `ci-logs/restarted-run-24266896541.log` - Full logs from the restarted "successful" run
- `ci-runs-list.json` - Recent CI runs list at time of analysis
