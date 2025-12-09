# Case Study: npm Trusted Publishing E422 Error

## Issue Reference

- **Issue**: [#10 - Trusted publishing does not work in our CI/CD](https://github.com/link-foundation/lino-arguments/issues/10)
- **CI Run**: [20054176340](https://github.com/link-foundation/lino-arguments/actions/runs/20054176340/job/57515987959)
- **Date**: 2025-12-09

## Executive Summary

The npm package `lino-arguments` failed to publish via GitHub Actions with OIDC trusted publishing due to a missing `repository` field in `package.json`. npm's provenance verification requires the `repository.url` in `package.json` to match the repository URL from the provenance signature, but since the field was empty, the validation failed with an E422 error.

## Timeline of Events

| Time (UTC)          | Event                                                      |
| ------------------- | ---------------------------------------------------------- |
| 2025-12-09 06:27:13 | CI/CD workflow triggered on main branch (commit `b03321d`) |
| 2025-12-09 06:27:20 | Tests and linting passed successfully                      |
| 2025-12-09 06:27:52 | Changeset version bump to 0.2.4 committed                  |
| 2025-12-09 06:27:53 | npm publish initiated with OIDC trusted publishing         |
| 2025-12-09 06:27:55 | Provenance statement signed and published to Sigstore      |
| 2025-12-09 06:27:55 | **E422 Error**: Repository URL validation failed           |
| 2025-12-09 06:27:55 | Publish failed, workflow exited with error                 |

## Error Analysis

### Exact Error Message

```
E422 422 Unprocessable Entity - PUT https://registry.npmjs.org/lino-arguments -
Error verifying sigstore provenance bundle: Failed to validate repository information:
package.json: "repository.url" is "", expected to match "https://github.com/link-foundation/lino-arguments" from provenance
```

### Error Code Breakdown

| Component          | Value                                                        |
| ------------------ | ------------------------------------------------------------ |
| HTTP Status        | 422 Unprocessable Entity                                     |
| npm Error Code     | E422                                                         |
| Endpoint           | `PUT https://registry.npmjs.org/lino-arguments`              |
| Sigstore Log Index | [752580455](https://search.sigstore.dev/?logIndex=752580455) |

### What Worked vs What Failed

| Component                       | Status     | Evidence                                                     |
| ------------------------------- | ---------- | ------------------------------------------------------------ |
| GitHub Actions workflow         | Working    | All tests passed                                             |
| OIDC token generation           | Working    | id-token: write permission granted                           |
| npm authentication via OIDC     | Working    | npm received valid OIDC token                                |
| Provenance statement signing    | Working    | Published to Sigstore transparency log                       |
| Trusted publisher config on npm | Working    | Screenshot shows `link-foundation/lino-arguments` configured |
| Repository URL validation       | **FAILED** | package.json missing repository field                        |

## Root Cause Analysis

### The Core Problem

npm's trusted publishing feature performs server-side validation to ensure the `repository.url` field in `package.json` matches the Source Repository URI extension in the signing certificate. This is a security measure to prevent packages from claiming provenance from a repository they don't actually belong to.

**The `package.json` was missing the `repository` field entirely**, causing the validation to compare an empty string `""` against the expected URL `https://github.com/link-foundation/lino-arguments`.

### Why This Matters for Security

npm provenance attestations allow consumers to verify:

1. The package was built from a specific repository
2. The build process was transparent and reproducible
3. The package hasn't been tampered with

Without the `repository` field matching, npm cannot guarantee that the provenance claim is legitimate.

### Evidence from package.json

```json
{
  "name": "lino-arguments",
  "version": "0.2.4",
  "description": "A setup of Links Notation Environment...",
  // ... other fields ...
  "author": "",
  "license": "Unlicense"
  // NOTE: No "repository" field present!
}
```

## npm Trusted Publishing: How It Works

### OIDC Authentication Flow

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  GitHub Actions │───▶│    npm OIDC     │───▶│   npm Registry  │
│   (Workflow)    │    │   Provider      │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                       │                      │
        │ 1. Request           │ 2. Generate          │
        │    OIDC token        │    JWT with          │
        │                      │    claims            │
        │                      │                      │
        └──────────────────────┴──────────────────────┘
                               │
                        3. Publish with
                           provenance
                               │
                               ▼
                    ┌─────────────────┐
                    │    Sigstore     │
                    │  Transparency   │
                    │      Log        │
                    └─────────────────┘
```

### Validation Points

1. **OIDC Token Claims**: Contains repository, workflow, and actor information
2. **Provenance Bundle**: Signed attestation of build origin
3. **Repository URL Check**: `package.json` repository must match provenance claims
4. **Trusted Publisher Config**: npm must have the repository registered

## Related Issues and References

### npm CLI Bug #8036

- **URL**: https://github.com/npm/cli/issues/8036
- **Issue**: Capitalization mismatch in repository URLs causes E422
- **Resolution**: Ensure exact URL match including case sensitivity

### npm Documentation

- [Trusted Publishers](https://docs.npmjs.com/trusted-publishers/)
- [Generating Provenance Statements](https://docs.npmjs.com/generating-provenance-statements/)

### Key Requirements for npm Provenance

Per [npm/provenance documentation](https://github.com/npm/provenance):

1. `package.json` must include `repository` or `repository.url` field
2. URL must exactly match the GitHub repository (case-sensitive)
3. Workflow must have `id-token: write` permission
4. Must be publishing from a public repository

## Solution

### Required Change

Add the `repository` field to `package.json`:

```json
{
  "repository": {
    "type": "git",
    "url": "https://github.com/link-foundation/lino-arguments.git"
  }
}
```

Or the shorthand version:

```json
{
  "repository": "github:link-foundation/lino-arguments"
}
```

### Why This Fixes the Issue

1. npm can now extract `https://github.com/link-foundation/lino-arguments` from the repository field
2. This matches the Source Repository URI in the provenance signature
3. The E422 validation passes
4. Package publishes successfully with provenance attestation

## Configuration Verification

### npm Settings (from screenshot)

| Setting           | Value                          |
| ----------------- | ------------------------------ |
| Package Name      | lino-arguments                 |
| Version           | 0.2.1 (before this incident)   |
| Access            | Public                         |
| Trusted Publisher | link-foundation/lino-arguments |
| Workflow          | main.yml                       |
| 2FA               | Not required                   |

### GitHub Workflow Settings

| Setting              | Value                      |
| -------------------- | -------------------------- |
| Workflow File        | .github/workflows/main.yml |
| Permission: id-token | write                      |
| Permission: contents | write                      |
| npm upgrade          | Yes (npm@latest)           |

## Lessons Learned

1. **Always include `repository` in package.json**: This is required for npm provenance and helps package consumers find the source code.

2. **Test provenance locally first**: Use `npm pack --dry-run` and check the package metadata before publishing.

3. **Verify exact URL match**: Repository URLs are case-sensitive and must match exactly what GitHub reports.

4. **The error message is informative**: The E422 error clearly states what's expected vs what was found.

## Files in This Case Study

- `ci-logs/run-20054176340.log` - Full CI logs from the failing run
- `ci-logs/run-20054499396.log` - Subsequent PR check run logs
- `ci-runs-list.json` - List of recent CI runs
- `npm-config-screenshot.png` - npm package settings showing trusted publisher config

## References

1. [npm Trusted Publishers Documentation](https://docs.npmjs.com/trusted-publishers/)
2. [npm Provenance Documentation](https://docs.npmjs.com/generating-provenance-statements/)
3. [npm/provenance GitHub Repository](https://github.com/npm/provenance)
4. [npm CLI Issue #8036](https://github.com/npm/cli/issues/8036)
5. [GitHub Blog: npm trusted publishing with OIDC](https://github.blog/changelog/2025-07-31-npm-trusted-publishing-with-oidc-is-generally-available/)
6. [Sigstore Transparency Log Entry](https://search.sigstore.dev/?logIndex=752580455)
