# Complete requirement inventory and solution analysis

Scope: [#42](https://github.com/link-foundation/lino-arguments/issues/42), [#39](https://github.com/link-foundation/lino-arguments/issues/39) and its consumer-audit comment, [#40](https://github.com/link-foundation/lino-arguments/issues/40), [#41](https://github.com/link-foundation/lino-arguments/issues/41). All issue comments and PR conversation/review/inline comments were read; #40/#41 and PR #43 initially had none.

## #39: isolated configuration and explicit secret files

| Requirement                                        | Possible solutions                                                | Selected implementation and validation plan                                                                                                                                           |
| -------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Explicit env map                                   | Temporarily replace process.env; inject context                   | Inject a snapshot; never swap or read process.env for injected inputs. Test hostile host variables, frozen inputs, independent contexts.                                              |
| Explicit cwd/base directory                        | process.chdir; resolve paths locally                              | Resolve .lenv, --configuration/-c and secret paths relative to cwd without changing the process directory. Test two temporary directories.                                            |
| Backward-compatible process defaults               | Change every call; preserve compatibility adapter                 | Preserve no-input process defaults and existing .lenv export/override behavior. Run all existing tests.                                                                               |
| Reuse argv injection                               | New parser; existing yargs                                        | Retain full process-style argv injection and yargs parsing.                                                                                                                           |
| Reuse LinoEnv pure API                             | Custom .lenv parser; upstream LinoEnv                             | Use LinoEnv.read().toObject() without its process-exporting config(). Published 0.2.8 has read/toObject but no standalone parse method; no parser is added.                           |
| Document composition/precedence                    | Fixed precedence; configurable source order                       | New isolated path: CLI > injected environment > --configuration > .lenv > defaults. Preserve legacy override semantics explicitly.                                                    |
| Typed, case-normalized lookup                      | Separate casting for every source; shared lookup                  | Shared context for callback getenv, mapped options and plain objects; retain integer/float/boolish fallback semantics.                                                                |
| Preserve empty/false/zero                          | Truthiness checks; defined-value checks                           | Use presence/undefined checks across merges, lookups, file contents and CLI overrides.                                                                                                |
| Reject ambiguous aliases                           | First matching alias; reject duplicates                           | Reject multiple normalized spellings within one source and normalized output/option collisions; allow documented precedence between sources. Values never appear in ambiguity errors. |
| Opt-in NAME_FILE or schema                         | Scan all *_FILE; allowlist                                        | Explicit secrets.keys allowlist, with optional custom file-variable names. Unrelated *_FILE is inert.                                                                                 |
| Injectable file reader                             | Hardwire fs; adapter                                              | Inject synchronous readFile(path, {maxBytes}); default Node adapter performs bounded reads. Test reader calls and failures.                                                           |
| Bounded size                                       | Read then check only; bound default read and verify custom result | Positive maxBytes (default 64 KiB), read at most maxBytes+1 bytes, reject oversized UTF-8 content, including multibyte input.                                                         |
| Newline treatment                                  | trim all whitespace; strip one final newline; preserve            | Default strip exactly one terminal LF/CRLF; optional preserve. Spaces/interior/trailing additional newlines remain.                                                                   |
| No secret disclosure                               | Expose underlying errors; sanitize                                | Suppress paths, values, original reader errors and yargs validation/help defaults. Trace only source/key/status, disabled by default.                                                 |
| NAME and NAME_FILE policy                          | Implicit winner; explicit policy                                  | Default error for both in winning source; opt-in value/file policies. Across sources, higher source wins; CLI bypasses unused secret files.                                           |
| Pure resolution separate from exports              | One Node entry; independent pure subpath                          | Dependency-free lino-arguments/pure exports object resolution and context; main module keeps applyLinoEnv/loadDotenvx adapters.                                                       |
| Browser/WASM plain objects without Node filesystem | Bundle stubs; independent pure module                             | Pure import has no Node/yargs/LinoEnv imports or process references; test in restricted Deno without fs/env permissions.                                                              |
| Node/Bun/Deno tests                                | Separate suites; test-anywhere                                    | Extend existing runtime test framework for two contexts, leakage, missing/unreadable files, CLI/env/file precedence.                                                                  |
| Rust/Python capability boundary                    | Port everything; document boundary                                | Rust retains clap/process-based APIs; no Python package exists here. Explicitly document JS-only new capabilities in root and language READMEs.                                       |
| Consumer can remove generic plumbing               | App-specific integration; universal API/example                   | Runnable generic schema example with injected contexts and secrets; no credentials, sessions or private fixtures.                                                                     |

## #40: dependencies and option-to-env mapping

| Requirement                                | Possible solutions                         | Selected implementation and validation plan                                                                                                                        |
| ------------------------------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| yargs >=18.2.0 and links-notation >=0.23.0 | Upgrade; verify already merged             | Already satisfied by #38 in package.json, npm/Deno locks. Verify current npm versions and compatibility; retain pending minor changeset.                           |
| Avoid outdated duplicate direct copies     | Overrides; update direct pins              | Direct pins are current. lino-env@0.2.8 still depends on links-notation ^0.11.2; document upstream boundary rather than force an incompatible transitive override. |
| Opt-in automatic env mapping               | yargs.env(''); selective mapping           | Map only registered options, UPPER_CASE names, using shared context. No host-env scan or unrelated options.                                                        |
| Type by option type                        | Untyped string defaults; schema casting    | Cast numbers (including decimals), boolish booleans, strings using registered types; CLI retains priority.                                                         |
| Explicit per-option renamed env variable   | Extra getenv boilerplate; env metadata     | Support option {env:'START_URL'} plus env:false to disable mapping. Test .option/.options, aliases and commands.                                                   |
| Remove name repetition/default boilerplate | New schema layer; existing yargs extension | Keep yargs chain with env.autoMap metadata and injected env.values; plain env maps supported.                                                                      |

## #41: restore JS release

| Requirement                             | Possible solutions                             | Selected implementation and validation plan                                                                                                                                                                                                          |
| --------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reproduce failed run from js/           | Rerun external publisher; hermetic CLI fixture | Save run 37564452408 logs; run actual scripts in JS-only fixtures with mocked git/npm/gh and no Cargo.toml, before fixing.                                                                                                                           |
| Stop JS versioning requiring Rust root  | Root-relative detection; lazy Rust-only paths  | Initialize Rust paths only in Rust mode; test changeset and instant JS modes.                                                                                                                                                                        |
| Entire release path works               | Fix first failure only; trace downstream steps | Fix identical unconditional Rust lookup in create-github-release too and resolve the release-note formatter sibling relative to its module; read correct JS changelog (unbracketed Changesets headings). Test actual release payload with mocked gh. |
| Publish dependency updates as npm 0.4.0 | Manual version; existing automatic workflow    | Keep one minor changeset (workflow forbids manual version edits), verify real Changesets prepares 0.4.0, wire release regressions into CI. Merge triggers trusted npm publication; do not publish unmerged code from the PR branch.                  |
| Verify CI timestamps/SHA                | Trust stale checks; exact pushed revision      | Fetch latest runs, compare SHA/time; download failures, analyze line-number evidence, fix and wait for passing checks.                                                                                                                               |

## #42: delivery contract

1. Implement all three child issues and read every comment.
2. Use only PR #43 and branch issue-42-30b1828f3bdd; no deferred implementation.
3. Include one closing keyword each: Fixes #39, Fixes #40, Fixes #41, Fixes #42.
4. Explicitly identify the already-satisfied direct dependency pins, retaining #40's closing reference.
5. Update title/body, check full diff, synchronize main, preserve atomic commits, run local checks and fresh CI, mark ready.

## Online research and existing components

- [LinoEnv source](https://github.com/link-foundation/lino-env/blob/main/js/src/lino-env.mjs): reuse pure read/toObject. Installed npm 0.2.8 imports node:fs eagerly, so importing it from a browser-only entry would break that requirement.
- [yargs API](https://github.com/yargs/yargs/blob/main/docs/api.md): env('') includes every process variable. Selective defaults with option metadata retain yargs argument/validation behavior without global env mapping.
- [getenv](https://github.com/ctavan/node-getenv): legacy typed helpers are process-bound; pure conversion follows existing integer/float/boolish rules without process mutation.
- [Docker Compose secrets](https://docs.docker.com/compose/how-tos/use-secrets/): secrets are mounted files and _FILE is an application convention. Explicit allowlisting suits this contract.
- [dotenv custom targets](https://github.com/motdotla/dotenv#processenv): offers processEnv and parse, but does not supply .lenv or a bounded/allowlisted secret policy. No additional parser/dependency is necessary.
- [Convict](https://github.com/mozilla/node-convict): schema env/arg mappings and validation solve a related Node use case, but adopting it would replace the established yargs/LinoEnv APIs.
- [Changesets automation](https://github.com/changesets/changesets/blob/main/docs/automating-changesets.md): retain versioning/release automation and validate it from a JS-only directory.
- npm registry queried on 2026-10-08: yargs 18.2.0, links-notation 0.23.0, lino-env 0.2.8; lino-arguments remains 0.3.0. #38's pins are current but unreleased. Consumer audit at commit 8834279005932a2ee3eabd96e245cc9b686def09 confirms generic reusable acceptance cases and no production migration.

## Confirmed release evidence

Run [37564452408](https://github.com/link-foundation/lino-arguments/actions/runs/37564452408), started 2026-10-07T02:57:19Z at ab790a397ddb564fae915bc278710a6eb79550d5, failed. Preserved local ci-logs/javascript-37564452408.log: invocation line 4817, missing Cargo.toml line 4827, getRustRoot stack line 4836, unconditional version-and-commit lookup line 4837. These logs predate this PR and establish the actual root cause.

## Validation evidence

Pre-fix configuration regressions: 14 failures out of 15 cases. Pre-fix JS-only
release regressions: all six version/release cases failed with missing Cargo.toml.
The initial context tests were then expanded with object resolution, aliases,
command builders, help redaction and real independent secret-file contexts.
The release suite also covers the subsequent sibling formatter invocation.

Full local logs are saved under ci-logs/ (ignored to avoid adding runtime noise).
The short original failure excerpt is committed as release-failure.txt. The
Deno isolation assertion compares key/value equality, ignoring enumeration order;
Deno's process.env proxy can enumerate keys in a different order without mutation.
An independent experiment confirms no changed host env keys.

Final local results: 88 tests pass on Node (including CI's Node 24), Bun and
Deno. Eight hermetic release regressions pass, as do lint, formatting,
file-size, dependency-freshness and changeset validation checks. The pure
resolver works under Deno without filesystem or environment permissions.
Rust tests, clippy with warnings denied, and formatting checks also pass.
The built-in help/version regression initially failed because VERSION was
mistakenly mapped as an application option; reserved flags are now excluded
while explicitly declared application options keep their mapping.

Actual Changesets tooling prepares 0.4.0 from the retained minor changeset in an
isolated fixture. Publishing and GitHub releases remain gated on main, so npm
publication will happen after merge through the repaired trusted-publishing
workflow. The PR does not publish unmerged code or modify the default branch.
