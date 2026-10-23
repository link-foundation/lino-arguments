# Links Notation compatibility assessment

Assessed for [lino-arguments#46](https://github.com/link-foundation/lino-arguments/issues/46)
on 2026-10-11 using npm registry tarballs, not unreleased upstream source.
Refreshed on 2026-10-23 for links-notation 0.27.1 after its 0.26/0.27 releases
left the ^0.25.2 range and failed the packed consumer check (see
[lino-arguments#48](https://github.com/link-foundation/lino-arguments/issues/48)
and its pull request).
This is a dependency maintenance request; the issue reports passing application
controls and does not reproduce an application failure.

## Supported dependency graph

| Relationship                    | Declared range | Installed version | Result                                           |
| ------------------------------- | -------------- | ----------------- | ------------------------------------------------ |
| lino-arguments → links-notation | ^0.27.1        | 0.27.1            | Maintained direct grammar                        |
| lino-arguments → lino-env       | ^0.2.8         | 0.2.8             | Latest published environment library             |
| lino-env → links-notation       | ^0.11.2        | 0.11.2            | Additional legacy grammar from upstream metadata |
| Consumer → links-notation       | 0.27.1         | 0.27.1            | Shares the maintained parser with lino-arguments |

The direct range was already refreshed on `main` before this assessment; the
npm and Deno locks both record these versions. The two grammar minor ranges do
not overlap because caret ranges below 1.0 retain the minor version boundary.
A new direct range or `npm dedupe` cannot satisfy lino-env's old declaration
with 0.27.1.

The intentional limit is **full graph deduplication until an upstream lino-env
release updates or removes its declaration**. This package retains both
published dependency contracts and does not ship an override, fork, or separate
environment parser. Track that release in
[lino-env#33](https://github.com/link-foundation/lino-env/issues/33).

## What was verified

The 0.27.1 parser returns nested line/group nodes. The existing iterative legacy
adapter traverses them in source order. Tests cover inline, nested multiline,
indexed and quoted notation, comments, Unicode and embedded hashes; invalid
notation still uses the legacy line fallback. The exported `Parser` is the
same constructor the consumer imports, and both resolve the same module.

Tokens from `parseLinoArguments` feed a real yargs configuration with numeric,
boolean and string options. CLI values win over the environment. `.lenv` and
selected-file resolution retain their existing ordering below the environment
and above defaults in isolated mode. Tests also cover the explicit process
exporter's override behavior.

The published lino-env 0.2.8 `src/lino-env.mjs` imports only `node:fs`. It splits
lines on LF and uses the first `: ` separator; **it does not call links-notation**.
Its roundtrip preserves literal spaces, quotes, colons, hashes, Unicode and
empty single-line values. Duplicate keys retain last-value lookup. This is not
evidence that arbitrary general Links Notation is a supported `.lenv` format.
Unreleased lino-env source differs from the npm tarball, so migrating its source
or replacing its parser is outside this package's compatibility assessment.
CRLF value handling remains the separate
[lino-env#32](https://github.com/link-foundation/lino-env/issues/32) request.

## Reproduce and reassess

From the repository root:

```bash
cd js
npm ci
node --test tests/grammar.test.js
npm ls links-notation lino-env --all
cd ..
node experiments/test-latest-grammar-consumer.mjs
```

The experiment packs this repository's JavaScript package, installs it into a
fresh production consumer together with the registry's latest root grammar,
checks parser module identity, and runs parser/CLI/lenv integration assertions.
It reports the actual grammar entries from the consumer lockfile. No application
inputs, credentials, overrides, or workspace dependency symlinks are used.

The stricter graph assertion intentionally exits 1 with the current upstream
release, **after the functional assertions pass**:

```bash
node experiments/test-latest-grammar-consumer.mjs --require-deduplicated
# AssertionError: Full deduplication requires the upstream lino-env range migration (#33)
# actual: 2; expected: 1
```

The bounded assessment of the proposed upstream range passes:

```bash
node experiments/test-latest-grammar-consumer.mjs --assess-lino-env-range
# Assessing lino-env 0.2.8 with range ^0.27.1.
# Packed consumer parser, CLI, lenv roundtrip and precedence pass.
# One node_modules/links-notation entry at 0.27.1.
```

This mode copies the installed upstream tarball contents to a temporary
directory, changes only its grammar dependency range, packs that copy, and
installs it as a direct consumer dependency. The upstream runtime source is
unchanged. npm then satisfies this package's lino-env range with the same local
tarball. All temporary files are removed in `finally`; the repository, its
locks, and the published upstream package are unchanged. The experiment proves
that this metadata migration works for the tested integration, not that an
unreleased upstream version is ready for publication.

CI runs both the normal packed consumer and the isolated migration assessment
using `npm run test:consumer`. The normal check also accepts a future upstream
release that resolves a single current grammar. The unit/integration cases run
in the existing Node/Bun/Deno matrix on Linux, macOS, and Windows, and the
packed-consumer check gates JavaScript releases.

## Follow-up release acceptance

When lino-env#33 publishes a migrated release, update the maintained lino-env
range and both locks. Run its own roundtrip and CRLF regressions, this package's
runtime matrix, the packed consumer, and `--require-deduplicated` against the
unmodified release. At that point the full graph assertion must pass with one
latest parser and this documented limit can be removed.
