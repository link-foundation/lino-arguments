---
'lino-arguments': patch
---

Fix makeConfig() parsing failure with user-defined --version and --help options

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
