# Workflow Comparison: Trusted Publishing Issue

## Error Analysis

From CI logs (run #19392476485), the error is:
```
npm error 404 Not Found - PUT https://registry.npmjs.org/lino-arguments - Not found
npm error 404 The requested resource 'lino-arguments@0.2.3' could not be found or you do not have permission to access it.
```

However, the logs also show:
```
npm notice publish Signed provenance statement with source and build information from GitHub Actions
npm notice publish Provenance statement published to transparency log
```

This indicates that **trusted publishing IS working** - the provenance was successfully generated and published. The E404 error is a **permission issue**, not an OIDC/trusted publishing configuration issue.

## Configuration Comparison

### lino-arguments (FAILING)
```yaml
- name: Publish to npm
  run: |
    npm run changeset:publish --provenance
  # NO env section with NODE_AUTH_TOKEN or NPM_TOKEN
```

### test-anywhere (WORKING)
```yaml
- name: Publish to npm
  run: |
    npm run changeset:publish
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
    NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Root Cause

**The issue is NOT with trusted publishing configuration**. The `id-token: write` permission and provenance generation are working correctly.

**The actual issue**: The `lino-arguments` workflow is missing the authentication token that grants permission to publish to the npm package.

### Why does the E404 error occur?

The package `lino-arguments@0.2.1` already exists on npm, maintained by user `konard`. The E404 error "Not found or you do not have permission to access it" indicates an **authentication/authorization failure**.

When using `--provenance` flag alone without authentication:
1. npm generates and signs the provenance (works ✓)
2. npm tries to publish the package (fails ✗ - no auth token to prove ownership)
3. npm registry rejects with E404 because it can't verify the publisher has rights to the package

### Current state of npm trusted publishing (2025)

As of July 2025, npm trusted publishing with OIDC is generally available. However, it requires:
1. Package configuration on npm to accept publishes from specific GitHub workflows
2. npm CLI v11.5.1 or later
3. No NPM_TOKEN when properly configured

The workflow is using `--provenance` which generates provenance statements, but this is NOT the same as full trusted publishing (which would eliminate the need for tokens entirely).

## Solutions

### Option 1: Add NPM_TOKEN (Recommended for private/scoped packages)
```yaml
- name: Publish to npm
  run: |
    npm run changeset:publish --provenance
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
    NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Option 2: Use pure trusted publishing (if configured on npm)
For this to work, the package must be configured on npm to use GitHub OIDC trusted publishing:
1. The npm package settings must have trusted publishing enabled
2. The GitHub repository must be authorized in npm settings
3. Then remove `--provenance` flag and let npm handle it via OIDC

The error message "Not found or you do not have permission to access it" suggests the package either:
- Doesn't exist yet (first publish)
- Exists but the OIDC trust relationship is not configured in npm
- Requires a traditional token for authentication

## Recommendation

Use Option 1: Add the NPM_TOKEN environment variables. This is the same approach used in `test-anywhere` which is working.
