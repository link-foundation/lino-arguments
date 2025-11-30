# Root Cause Analysis: Trusted Publishing Failure

## Issue Summary
CI run #19392476485 failed with error:
```
npm error 404 Not Found - PUT https://registry.npmjs.org/lino-arguments - Not found
npm error 404 The requested resource 'lino-arguments@0.2.3' could not be found or you do not have permission to access it.
```

## Investigation Steps

### 1. Examined CI Logs
- Downloaded logs from failed run: ci-logs/failed-run-19392476485.log
- Found that provenance generation was successful:
  ```
  npm notice publish Signed provenance statement with source and build information from GitHub Actions
  npm notice publish Provenance statement published to transparency log
  ```
- This proves OIDC authentication is working for provenance signing
- However, the package publish still failed with E404

### 2. Compared with Working Examples

#### test-anywhere (working)
```yaml
- name: Publish to npm
  run: npm run changeset:publish
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
    NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

#### lino-arguments (failing)
```yaml
- name: Publish to npm
  run: npm run changeset:publish --provenance
  # Missing: env section with NPM_TOKEN
```

### 3. Verified Package State
- Package exists on npm as `lino-arguments@0.2.1`
- Maintained by user `konard`
- CI was attempting to publish version `0.2.3`

## Root Cause

**Misconception about trusted publishing vs. provenance generation:**

1. **Provenance generation** (`--provenance` flag):
   - Uses OIDC (`id-token: write` permission) to sign build information
   - Creates attestations about where and how the package was built
   - Does NOT authenticate the publisher's right to the package
   - Still requires NPM_TOKEN for actual publishing

2. **Full trusted publishing** (npm OIDC, available July 2025):
   - Would eliminate the need for NPM_TOKEN entirely
   - Requires package configuration on npm.com
   - Requires npm CLI v11.5.1+
   - Currently only supports GitHub-hosted runners

**The workflow was using provenance generation but missing the authentication token needed to actually publish to npm.**

## The Fix

Add environment variables to the publish step:
```yaml
env:
  NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
  NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

This provides:
- Authentication to npm registry (via NPM_TOKEN)
- Provenance statements (via --provenance flag + id-token permission)
- Secure publishing with cryptographic proof of origin

## Why E404 Instead of E401/E403?

The E404 error message "Not found or you do not have permission" is npm's way of handling authorization failures. When npm cannot authenticate the publisher:
- It doesn't reveal whether the package exists (security by obscurity)
- Returns 404 instead of 401/403 to avoid information leakage
- The real issue is permission/authentication, not missing package

## Verification

The fix matches the working implementation in:
- `test-anywhere` repository (main.yml:208-210)
- Other link-foundation repositories using the same pattern

## Files Modified
- `.github/workflows/main.yml` - Added env section to "Publish to npm" step
