# lino-arguments

## 0.2.8

### Patch Changes

- c89821f: Fix makeConfig() parsing failure with user-defined --version and --help options

  **Problem**: When users defined their own `--version` or `--help` options in makeConfig(), yargs' built-in version and help flags would interfere with parsing, causing:
  - With `.strict()`: "Unknown argument" errors
  - Without `.strict()`: Options parsed as boolean `false` instead of the provided values

  This issue caused silent failures in GitHub Actions CI environments, particularly affecting release scripts in the test-anywhere repository (v0.8.33-v0.8.36).

  **Solution**: Disable yargs' built-in version and help flags by default in makeConfig() by adding `.version(false)` and `.help(false)` to the yargs instance. Users who want these built-in behaviors can explicitly enable them in their yargs configuration:

  ```javascript
  const config = makeConfig({
    yargs: ({ yargs, getenv }) =>
      yargs
        .option('port', { default: getenv('PORT', 3000) })
        .version('1.0.0') // Explicit version
        .help(), // Explicit help
  });
  ```

  **Impact**: This fix allows users to define their own `--version` and `--help` options without conflicts, giving full control over the CLI interface.

  **Testing**: Added comprehensive tests for `--version` and `--help` option conflicts in strict mode.

  Fixes #14

## 0.2.7

### Patch Changes

- d11aa3c: docs: add comprehensive case study for issue #10 trusted publishing analysis

  This PR provides detailed documentation and analysis for Issue #10, which covered npm trusted publishing failures in our CI/CD pipeline.

  **Documentation added:**
  - Comprehensive analysis of E422 error (missing repository field) - RESOLVED
  - Detailed investigation of E404 error with manual workflow_dispatch triggers
  - Comparison of authentication strategies (NPM_TOKEN vs OIDC)
  - Workflow comparison with test-anywhere reference repository
  - Evidence-based findings from online research
  - Complete CI logs preserved in ci-logs/ directory
  - Timeline reconstruction and root cause analysis
  - Proposed solutions with trade-off analysis

  **Key findings:**
  1. E422 error was caused by missing `repository` field in package.json - fixed in PR #11
  2. E404 error for manual releases is likely due to OIDC/Trusted Publisher configuration mismatch with workflow_dispatch triggers
  3. test-anywhere uses NPM_TOKEN authentication which works reliably for all trigger types
  4. Multiple solution options proposed (NPM_TOKEN fallback, Trusted Publisher config, unified workflows, etc.)

  This documentation serves as a valuable reference for future npm publishing issues and OIDC troubleshooting.

  Related: Issue #10, PR #11

## 0.2.6

### Patch Changes

- Test patch release

## 0.2.5

### Patch Changes

- 05d9597: fix: add repository field to package.json for npm trusted publishing

  This fixes the E422 error when publishing with npm trusted publishing (OIDC).
  npm provenance verification requires the repository.url in package.json to match
  the Source Repository URI in the signing certificate. Without this field, the
  validation fails with "repository.url is '', expected to match 'https://github.com/link-foundation/lino-arguments'".

## 0.2.4

### Patch Changes

- b3cbcd4: Fix trusted publishing configuration for npm OIDC

## 0.2.3

### Patch Changes

- 51aa1bd: Test patch release

## 0.2.2

### Patch Changes

- b08f95c: Adapt CI/CD pipeline for npm trusted publishing with provenance support. Replace shell script changeset validation with .mjs script. Add manual release workflow and helper scripts for changeset management.

## 0.2.1

### Patch Changes

- 7b0868d: Replace custom getenv implementation with official npm package. Now uses the robust `getenv` package for type casting and validation, enhanced with case-insensitive lookup across multiple naming conventions. Also enforces stricter no-unused-vars linting with catch { } syntax.

## 0.2.0

### Minor Changes

- e81d376: Implement makeConfig() API with unified configuration system

  This major update implements the requested API design with the following features:
  - **makeConfig() function**: Main API that accepts configuration with lenv, env, getenv, and yargs options
  - **Multi-source configuration**: Automatically loads from dotenvx (.env), lino-env (.lenv), environment variables, and CLI arguments
  - **Priority system**: CLI arguments > getenv defaults > --configuration flag > .lenv file > .env file
  - **Case conversion utilities**: Support for UPPER_CASE, camelCase, PascalCase, snake_case, and kebab-case
  - **getenv() helper**: Intelligent environment variable lookup across all case formats with type preservation
  - **Deprecation warnings**: Yellow console warnings when using dotenvx/.env files
  - **--configuration flag**: Special CLI option to dynamically specify .lenv file path
  - **Automatic key mapping**: kebab-case CLI options automatically convert to camelCase in result object

  The implementation follows the hero example pattern from the PR comments, making it simple to use with sensible defaults while allowing full customization when needed.
