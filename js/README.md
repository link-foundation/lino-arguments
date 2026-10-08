# lino-arguments

Configuration from CLI arguments, environment maps, and Links Notation environment files, using yargs and lino-env.

[![npm version](https://img.shields.io/npm/v/lino-arguments.svg)](https://www.npmjs.com/package/lino-arguments)
[![License: Unlicense](https://img.shields.io/badge/license-Unlicense-blue.svg)](http://unlicense.org/)

## Installation

```bash
npm install lino-arguments
```

Requires Node.js ^20.19.0, ^22.12.0, or >=23. Bun and Deno are supported. The Deno configuration permits newly published dependencies to follow the repository's dependency freshness checks.

## Existing process-based usage

```javascript
import { makeConfig } from 'lino-arguments';

const config = makeConfig({
  yargs: ({ yargs, getenv }) =>
    yargs.option('port', { type: 'number', default: getenv('PORT', 3000) }),
});
```

Without an injected environment, `makeConfig` retains its process defaults: it reads `process.argv`, loads `.lenv` into `process.env`, and returns CLI options with camelCase keys. `.lenv` overrides the existing process environment by default; set `lenv.override: false` to retain existing values, including empty strings. A file selected by `--configuration`/`-c` overrides both. CLI options always have highest priority.

## Isolated contexts and automatic environment mapping

```javascript
const config = makeConfig({
  env: {
    values: {
      PORT: '8080',
      VERBOSE: 'false',
      START_URL: 'https://example.test',
    },
    autoMap: true,
  },
  cwd: '/app/config',
  argv: ['node', 'app.js', '--port', '9090'],
  yargs: ({ yargs }) =>
    yargs
      .option('port', { type: 'number', default: 3000 })
      .option('verbose', { type: 'boolean', default: true })
      .option('start-url', { type: 'string', env: 'START_URL' }),
});
// { port: 9090, verbose: false, startUrl: 'https://example.test' }
```

`env.values` is copied; resolution never obtains values from or exports values to the host environment. Two calls with separate maps/directories are independent. `cwd` resolves `.lenv`, `lenv.path`, `--configuration`/`-c`, and relative secret paths without changing the process directory.

You can pass an environment map directly as `env: { PORT: '8080' }` or `env: {}`. Use `env.values` when the map could contain reserved settings keys (`enabled`, `quiet`, `autoMap`, `values`); a settings-only object with boolean settings keeps its legacy meaning. `env: { autoMap: true }` opts into mapping with the legacy process defaults. `env: { values: {} }` explicitly isolates an empty environment.

For isolated contexts, precedence from highest to lowest is:

1. Explicit CLI arguments.
2. Injected `env`/`env.values`.
3. The `.lenv` selected by `--configuration`/`-c`.
4. The default `.lenv` (or `lenv.path`).
5. Option defaults.

`lenv.override` controls the legacy process exporter only. Missing/unreadable optional `.lenv` files are treated as empty by `LinoEnv.read()`. The implementation reuses `LinoEnv.read().toObject()` and adds no `.lenv` parser.

Automatic mapping is opt-in. It maps only declared options: `job-application-interval` → `JOB_APPLICATION_INTERVAL`, `verbose` → `VERBOSE`. It supports `.option()`, `.options()`, shorthand type declarations, and synchronous command builders. Use `{ env: 'APP_START_URL' }` for an explicit variable name even without `autoMap`, or `{ env: false }` to disable mapping for one option. CLI aliases retain CLI priority. Native `yargs.env()` is rejected in isolated contexts because it reads the host environment.

Mapped numbers accept finite decimal values; booleans accept `true`/`false` (case insensitive) and `1`/`0`; strings retain empty values. Array options accept comma-separated strings or array-valued object input. Invalid mapped values throw an error naming the key and type, without the value. Unknown environment keys never become options.

Keys normalize across UPPER_CASE, camelCase, kebab-case, snake_case, and PascalCase. Multiple spellings of the same key **within one source** are ambiguous and rejected, even if the values are equal. Different sources can use different spellings and follow precedence. Conflicting option aliases are rejected too. Repeated identical `.lenv` keys retain LinoEnv's last-value behavior.

## Opt-in secret files

```javascript
const config = makeConfig({
  env: { values: { API_KEY_FILE: 'secrets/api-key' }, autoMap: true },
  cwd: '/app',
  secrets: { keys: ['API_KEY'] },
  yargs: ({ yargs }) => yargs.option('api-key', { type: 'string' }),
});
```

Only keys in `secrets.keys` can load a file; unrelated `*_FILE` variables are inert. A secret is read when its declared option or contextual `getenv` lookup needs it, and the result is cached within that call. File values never export to `process.env`. Explicit CLI values bypass automatic env mapping and unused files. A manual `getenv` call inside the callback resolves immediately, so use mapping for secrets that CLI should bypass.

| Secret setting                 | Default and behavior                                                                                                                                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `keys`                         | Required allowlist, e.g. `['API_KEY']`; uses `API_KEY_FILE`. An object such as `{ API_KEY: 'TOKEN_PATH' }` selects a custom file variable.                                                                                     |
| `readFile(path, { maxBytes })` | Optional synchronous injected reader returning a string or Uint8Array. The main entry otherwise uses its bounded Node filesystem adapter. A custom reader must honor the supplied bound; its returned content is also checked. |
| `maxBytes`                     | 65536 bytes (64 KiB), valid range 1–16777216. Checked before newline removal, using UTF-8 bytes. The default adapter only reads regular files, allocating at most `maxBytes + 1` bytes.                                        |
| `newline`                      | `'strip'`: removes exactly one terminal LF or CRLF. `'preserve'` retains it. BOM, spaces, interior newlines and extra trailing newlines remain. Invalid UTF-8 is rejected.                                                     |
| `conflict`                     | `'error'`: both `NAME` and its file variable in the winning source throw. `'value'` prefers direct values (including empty strings). `'file'` prefers file contents.                                                           |

Source precedence is applied to a direct value and its allowlisted file variable together: a higher-priority direct value overrides a lower-priority file, and a higher-priority file overrides a lower-priority direct value. Conflicts in unused lower sources do not cause reads or errors.

Missing/unreadable/oversized secret files throw redacted errors. Paths, contents, and underlying reader error messages are omitted. Env defaults display `[environment]` in yargs help. With a secret allowlist, yargs validation failures use a generic error to prevent values appearing in error/help output. Application-supplied logging, callbacks and coercion functions remain the application's responsibility.

Optional `trace(event)` receives only normalized key, source, and whether a file was used. Tracing is off by default; it never receives values or file paths.

See [examples/isolated-contexts.js](examples/isolated-contexts.js) for a runnable example using generic fixtures.

## Browser/WASM and plain objects

Import the filesystem-free subpath for already-parsed objects:

```javascript
import { resolveConfig, createConfigContext } from 'lino-arguments/pure';

const config = resolveConfig({
  options: {
    port: { type: 'number', default: 3000 },
    'api-key': { type: 'string', env: 'TOKEN', default: '' },
  },
  lenv: { PORT: '5000' }, // Already parsed, e.g. LinoEnv.toObject().
  configuration: {},
  env: { TOKEN: '' },
  argv: { port: 8080 }, // Already parsed CLI/options object.
});
// { port: 8080, apiKey: '' }

const context = createConfigContext({ env: { PORT: '0' } });
context.getenv('port', 3000); // 0
```

`resolveConfig` maps its declared schema automatically unless `autoMap: false`. `createConfigContext` exposes `getenv(name, fallback)` and `lookup(name)`; the latter returns `{ found, value }` for present keys. Both accept `env`, `lenv`, `configuration`, `secrets`, `cwd`, `readFile`, `resolvePath`, and `trace`, with the same precedence/conflict rules. The pure entry has no Node imports, process access, yargs or filesystem defaults. Secret files require an injected reader. It does not parse CLI strings or raw `.lenv` text; parse those with the existing runtime APIs first. For CLI aliases, use the yargs entry; the pure schema receives canonical option names.

The main entry imports Node filesystem adapters through lino-env/yargs. Browser/WASM applications should import `lino-arguments/pure`.

## API reference

`makeConfig({ yargs, env, cwd, argv, lenv, getenv, secrets, trace })` returns parsed camelCase options. `yargs` is an optional callback receiving `{ yargs, getenv }`. `argv` retains the existing full process-style array convention, including executable/script slots. `getenv.enabled: false` disables the callback helper. `lenv.enabled: false` disables default `.lenv` loading; explicit `--configuration` still loads its file. `lenv.quiet: false` enables compatibility loading notices.

`getenv(name, defaultValue = '', { env, ...contextOptions }?)` uses the process environment by default or an injected map when provided. The type of the default determines conversion: integer defaults require an integer, fractional defaults allow floats, and boolean defaults use boolish conversion. Invalid values return the fallback; empty strings, false and zero are preserved when valid for that type. Ambiguous aliases throw.

`applyLinoEnv(path, { override: false, quiet: false })` is the explicit compatibility exporter. It normalizes names to UPPER_CASE in `process.env`; `override: false` preserves defined values, including empty strings.

`await loadDotenvx(options)` is the deprecated optional `.env` exporter. Existing `env: { enabled: true, quiet: true }` remains supported, but `makeConfig` is synchronous and cannot await its import. Await `loadDotenvx()` before `makeConfig()` when deterministic `.env` loading is needed. Injected contexts reject `enabled: true`; supply an already-parsed environment map instead.

`Parser`, `LinoEnv`, and `yargs` remain exported. `parseLinoArguments(text)` retains the legacy flat argument API. `toUpperCase`, `toCamelCase`, `toKebabCase`, `toSnakeCase`, and `toPascalCase` remain available; parsed result keys normalize through kebab-case before camelCase conversion.

## `.lenv` format

```text
PORT: 3000
VERBOSE: false
API_KEY_FILE: secrets/api-key
```

The separator is colon followed by a space. Blank lines and comments are ignored. Values retain their spaces.

## Built-in yargs flags

Disable reserved flags when defining your own options of the same name:

```javascript
makeConfig({
  yargs: ({ yargs }) =>
    yargs.version(false).help(false).option('version', { type: 'string' }),
});
```

To use yargs' built-in behavior, call `.version('1.0.0').help()`. See [examples/enable-version-and-help.js](examples/enable-version-and-help.js).

## Language boundaries

These isolated contexts, pure object resolution, and secret-file settings are JavaScript APIs. The Rust package continues using clap and process environment loaders; its existing automatic option-to-env mapping is separate and does not provide these isolated/secret-file contracts. This repository has no Python implementation.

Direct dependencies use yargs ^18.2.0 and links-notation ^0.23.0. Published lino-env 0.2.8 still depends on links-notation ^0.11.2; that transitive duplicate requires an upstream lino-env release. This package does not force an incompatible override.

## Development and testing

Use Node.js 24 and npm >=10.9.0 for lint/release tools. Tests use [test-anywhere](https://github.com/link-foundation/test-anywhere).

```bash
npm ci
npm test
bun test
deno test --allow-read --allow-write --allow-env
npm run check
npm run check:dependencies
npm run test:release
# Pure resolver runs without fs/env permissions:
deno run --no-config ../experiments/test-pure-resolution.mjs
```

We use [Changesets](https://github.com/changesets/changesets) for versioning. Add exactly one changeset per PR (`npm run changeset`); CI versions and publishes on merge. Manual edits to the package version are prohibited by CI.

## Related projects

- [links-notation](https://github.com/link-foundation/links-notation)
- [lino-env](https://github.com/link-foundation/lino-env)
- [getenv](https://github.com/ctavan/node-getenv)

## License

Public domain under the [Unlicense](../LICENSE).
