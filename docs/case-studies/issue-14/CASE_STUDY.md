# Case Study: makeConfig() Fails to Parse CLI Arguments in GitHub Actions

## Executive Summary

The `makeConfig()` function from `lino-arguments` fails to parse CLI arguments when users define their own `--version` option, due to a conflict with yargs' built-in `--version` flag. This issue manifested in GitHub Actions CI environments and caused multiple release failures in the test-anywhere repository.

**Root Cause**: yargs' built-in `.version()` flag conflicts with user-defined `--version` options, causing parse failures.

**Impact**: 4+ releases failed (v0.8.33-v0.8.36), affecting release notes formatting and documentation.

**Solution**: Disable yargs' built-in version and help flags by default in `makeConfig()`, allowing users to define their own.

## Timeline of Events

### Initial Occurrence - December 2025

1. **PR #115** (test-anywhere): Introduced `lino-arguments` to release scripts
2. **Release v0.8.33** failed (Issue #116): Initially attributed to workflow issues, but root cause was `lino-arguments` parsing failure
3. **Releases v0.8.34, v0.8.35, v0.8.36**: Continued failures with broken release notes

### Investigation Phase

4. **December 9, 2025**: Issue #122 (test-anywhere) reported missing PR links and unformatted markdown in release notes
5. **CI Logs Analysis**: Downloaded logs from run 20126234140, found exit code 1 with no output
6. **Local Testing**: Script worked locally, indicating environment-specific issue
7. **PR #119** (test-anywhere): Fixed some scripts by removing `lino-arguments` and using manual parsing
8. **PR #123** (test-anywhere): Fixed remaining `format-release-notes.mjs` script with same workaround

### Root Cause Discovery - December 11, 2025

9. **Issue #14** (lino-arguments): Filed with comprehensive documentation and reproducible example
10. **Deep Investigation**: Created reproduction tests, identified `--version` flag conflict
11. **Confirmed Root Cause**: yargs' built-in `--version` flag interferes with user-defined `--version` options

## Technical Analysis

### The Problem

When users define a `--version` option in `makeConfig()`, yargs' built-in version handling causes two types of failures:

#### Scenario 1: With `.strict()` mode (recommended usage)

```bash
$ node script.mjs --version "0.8.36"
```

**Result**: `Unknown argument: 0.8.36`

The value `"0.8.36"` is treated as an unknown positional argument because yargs interprets `--version` as its built-in flag.

#### Scenario 2: Without `.strict()` mode

```bash
$ node script.mjs --version "0.8.36"
```

**Result**: `config.version === false`

The `--version` flag is parsed as yargs' built-in boolean flag, ignoring the provided value.

### Why It Affected GitHub Actions

The issue affected GitHub Actions specifically because:

1. **Real CLI Usage**: Unlike tests (which pass custom `argv`), production scripts use actual command-line arguments
2. **Silent Failures**: Scripts exit early with code 1 and no output, making debugging difficult
3. **No Local Reproduction**: The issue only manifested when scripts were called with real CLI arguments

### Evidence

#### From CI Logs (run 20126234140)

```json
{
  "finalExitCode": 1,
  "stdoutLength": 0,
  "stderrLength": 4413,
  "stdoutPreview": ""
}
```

#### From Local Reproduction

```javascript
// process.argv
[
  "/path/to/node",
  "/path/to/script.mjs",
  "--version",
  "0.8.36",
  "--repository",
  "link-foundation/test-anywhere"
]

// Parsed config (WRONG)
{
  "version": false,  // ❌ Should be "0.8.36"
  "repository": "link-foundation/test-anywhere"
}
```

#### With Renamed Option (--ver instead of --version)

```javascript
// Parsed config (CORRECT)
{
  "ver": "0.8.36",  // ✅ Works perfectly
  "repository": "link-foundation/test-anywhere"
}
```

### Code Analysis

In `src/index.js`, line 337-344:

```javascript
// Step 3: Parse initial CLI args to check for --configuration
const initialYargs = yargs(hideBin(argv))
  .option('configuration', {
    type: 'string',
    describe: 'Path to configuration .lenv file',
    alias: 'c',
  })
  .help(false) // ✅ Disabled for initial parse
  .version(false) // ✅ Disabled for initial parse
  .exitProcess(false);
```

But in line 360-364:

```javascript
// Step 5: Configure yargs with user options
const yargsInstance = yargs(hideBin(argv)).option('configuration', {
  type: 'string',
  describe: 'Path to configuration .lenv file',
  alias: 'c',
});
// ❌ .version(false) and .help(false) NOT called here!
```

The second yargs instance doesn't disable the built-in flags, causing conflicts.

## Related Research

### Yargs Built-in Flags

From [yargs documentation](https://yargs.js.org/):

- `.version()` - Enables the built-in `--version` flag
- `.help()` - Enables the built-in `--help` flag
- `.version(false)` - Disables the built-in version flag
- `.help(false)` - Disables the built-in help flag

### Similar Issues

Research found similar issues in the yargs ecosystem:

1. **[iterative/cml #727](https://github.com/iterative/cml/issues/727)**: Error logging issues in GitHub Actions with yargs
2. **[yargs/yargs #2399](https://github.com/yargs/yargs/issues/2399)**: Factory pattern parsing issues
3. **[yargs/yargs #873](https://github.com/yargs/yargs/issues/873)**: Environment variables triggering errors in strict mode

Common theme: yargs behaves differently in CI environments, particularly with built-in flags and strict mode.

## Proposed Solutions

### Solution 1: Disable Built-in Flags by Default (Recommended)

**Change `makeConfig()` to disable yargs' built-in version and help flags by default:**

```javascript
const yargsInstance = yargs(hideBin(argv))
  .option('configuration', {
    type: 'string',
    describe: 'Path to configuration .lenv file',
    alias: 'c',
  })
  .version(false) // ✅ Disable built-in version flag
  .help(false); // ✅ Disable built-in help flag (users should call .help() explicitly)
```

**Pros:**

- Fixes the issue completely
- Users can define their own `--version` and `--help` options
- Backward compatible for users who don't use these flags
- Consistent with initial parse behavior

**Cons:**

- Users who want yargs' built-in version behavior must add it explicitly
- Requires users to call `.help()` in their yargs configuration to get help

### Solution 2: Conditional Disabling

Only disable built-in flags if user defines conflicting options:

**Pros:**

- Preserves built-in help/version for users who don't define their own

**Cons:**

- More complex implementation
- Harder to understand behavior
- Still breaks if users define `--version` without realizing the conflict

### Solution 3: Documentation Only

Document the conflict and recommend users avoid `--version` as an option name:

**Pros:**

- No code changes needed

**Cons:**

- Doesn't fix the issue
- Users must work around the limitation
- Poor developer experience

## Recommended Solution

**Solution 1** is recommended because:

1. It completely fixes the issue
2. It's simple and predictable
3. It gives users full control over their CLI interface
4. It's consistent with the library's philosophy of being a "configuration library" that wraps yargs, not a CLI framework

Users who want the built-in version/help behavior can easily add it:

```javascript
const config = makeConfig({
  yargs: ({ yargs, getenv }) =>
    yargs
      .option('port', { default: getenv('PORT', 3000) })
      .version('1.0.0') // ✅ Explicit version
      .help(), // ✅ Explicit help
});
```

## Testing Strategy

### Existing Tests

The current test suite uses custom `argv` parameters, which masks the issue:

```javascript
const config = makeConfig({
  yargs: ({ yargs }) => yargs.option('port', { type: 'number' }),
  argv: ['node', 'script.js', '--port', '8080'], // ✅ Works
});
```

### Required New Tests

1. **Test with `--version` option and `.strict()` mode**
2. **Test with `--help` option and `.strict()` mode**
3. **Test that built-in flags are properly disabled**
4. **Test that users can define their own `--version` option**
5. **Integration test simulating actual CLI usage**

## Impact Assessment

### Affected Projects

1. **test-anywhere**: 4+ releases with broken release notes
2. **Any project using `makeConfig()` with `--version` option**

### Severity

- **High**: Causes complete parsing failure
- **Silent failure**: No clear error message
- **Hard to debug**: Works locally, fails in CI
- **Workaround available**: Manual argument parsing (as used in PR #119, #123)

## Lessons Learned

1. **Test with real CLI arguments**: Mock `argv` in tests can mask real-world issues
2. **Check for built-in flag conflicts**: When wrapping CLI libraries, disable built-in behaviors that might conflict
3. **Add CI-specific tests**: Some issues only manifest in non-interactive environments
4. **Better error messages**: The "Unknown argument" error didn't indicate the root cause

## References

- [Issue #14 (lino-arguments)](https://github.com/link-foundation/lino-arguments/issues/14)
- [Issue #122 (test-anywhere)](https://github.com/link-foundation/test-anywhere/issues/122)
- [PR #123 (test-anywhere)](https://github.com/link-foundation/test-anywhere/pull/123)
- [PR #119 (test-anywhere)](https://github.com/link-foundation/test-anywhere/pull/119)
- [yargs documentation](https://yargs.js.org/)
- [npm trusted publishers](https://docs.npmjs.com/trusted-publishers/)

## Conclusion

The root cause of makeConfig() failures in GitHub Actions is a conflict between user-defined `--version` options and yargs' built-in version flag. The fix is straightforward: disable built-in flags by default in makeConfig(). This gives users full control over their CLI interface and prevents silent parsing failures.

**Status**: Root cause identified, solution proposed, implementation pending.

**Next Steps**:

1. Implement fix in `src/index.js`
2. Add comprehensive tests for `--version` and `--help` conflicts
3. Update documentation to explain the change
4. Version bump and release
