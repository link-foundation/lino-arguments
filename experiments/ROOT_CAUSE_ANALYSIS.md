# Root Cause Analysis: Trusted Publishing Failure

## Issue

GitHub Actions workflow fails to publish lino-arguments package to npm with error:

```
🦋  error an error occurred while publishing lino-arguments: E404 Not Found - PUT https://registry.npmjs.org/lino-arguments - Not found
🦋  error The requested resource 'lino-arguments@0.2.3' could not be found or you do not have permission to access it.
```

## Investigation Summary

### Evidence from CI Logs (Run 19392476485)

1. ✅ Provenance was successfully generated:
   ```
   npm notice publish Signed provenance statement with source and build information from GitHub Actions
   npm notice publish Provenance statement published to transparency log: https://search.sigstore.dev/?logIndex=702103943
   ```
2. ❌ Publishing failed with 404 error
3. ✅ Workflow had `id-token: write` permission
4. ✅ npm was upgraded to latest version
5. ✅ Used `--provenance` flag

### Comparison with Working Repositories

**test-anywhere:**

- Uses **NPM_TOKEN** (traditional authentication)
- NOT using trusted publishing
- Workflow sets: `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`

**lino-env:**

- Uses manual release workflow (creates changeset PR)
- Actual publishing happens in separate workflow (not examined)

**lino-arguments (current):**

- Attempts to use **trusted publishing** (OIDC)
- Has all technical requirements (id-token: write, provenance, npm upgrade)
- NO NPM_TOKEN used

## Root Cause Identified

The workflow is correctly configured for **npm trusted publishing with OIDC**, BUT:

**The trusted publisher is NOT configured on npmjs.com for the lino-arguments package.**

### How Trusted Publishing Works

Per npm documentation (https://docs.npmjs.com/trusted-publishers/):

1. Package maintainer must configure a "Trusted Publisher" on npmjs.com
2. Configuration requires:
   - GitHub organization/user: `link-foundation`
   - Repository: `lino-arguments`
   - Workflow filename: `main.yml` (or whatever is used)
   - Environment name: (optional)

3. When configured, GitHub Actions can publish without NPM_TOKEN using OIDC

### Why the 404 Error

The 404 error "Not found or you do not have permission" occurs because:

- npm OIDC authentication succeeded (proven by provenance generation)
- But npm rejected the publish because no trusted publisher relationship exists
- npm returns 404 instead of 403 to avoid leaking information about package existence

## Solution Options

### Option 1: Configure Trusted Publisher (Recommended by User)

User explicitly stated: "Make sure we use https://docs.npmjs.com/trusted-publishers"

**Steps:**

1. Package owner (konard) logs into npmjs.com
2. Go to package settings for lino-arguments
3. Add trusted publisher:
   - Provider: GitHub Actions
   - Org: link-foundation
   - Repo: lino-arguments
   - Workflow: .github/workflows/main.yml
4. Workflow will work without changes

**Pros:**

- No tokens to manage
- More secure (short-lived OIDC tokens)
- Automatic provenance
- User explicitly requested this

**Cons:**

- Requires manual configuration on npmjs.com
- Only package owner can configure

### Option 2: Use NPM_TOKEN (Like test-anywhere)

Add NPM_TOKEN to workflow (what PR #8 attempted)

**Rejected because:**

- User explicitly said: "As we use trusted publishing that will not work (no NPM token will ever exist in our flow)"
- Goes against user's security requirements

## Recommended Fix

Since the user wants trusted publishing but configuration cannot be done via code:

1. **Update workflow to be ready for trusted publishing:**
   - Keep `id-token: write` permission
   - Remove `--provenance` flag (auto-enabled with OIDC)
   - Ensure workflow filename matches what will be configured

2. **Document the required manual step:**
   - Add clear instructions in PR description
   - Explain that package owner must configure trusted publisher on npmjs.com

3. **Add workflow for manual releases:**
   - Similar to test-anywhere
   - Allows manual release with instant version bump
   - Uses same trusted publishing mechanism
