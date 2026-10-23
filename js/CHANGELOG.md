# lino-arguments

## 0.4.0

### Minor Changes

- 6ad199b: Update all runtime, optional peer, and development dependencies to their latest
  releases, including yargs 18, links-notation 0.23, and dotenvx 2. Node.js now
  requires ^20.19.0, ^22.12.0, or >=23 to match yargs. Development and release
  tooling uses Node.js 24 and npm >=10.9.0. Add dependency freshness checks to CI.
  Preserve legacy flat argument parsing with links-notation's nested line/group
  nodes by traversing children in source order.
  Use an explicit test-file glob for compatibility with Node.js 24's test runner.

  Add isolated env/cwd configuration contexts, selective typed option-to-env
  mapping, an importable pure object resolver, and allowlisted bounded secret
  files with redacted failures. Preserve legacy process adapters and document
  source precedence and runtime/language boundaries. Fix JavaScript changeset
  and instant versioning plus GitHub release creation from js/ without Cargo.

  Add opt-in `makeConfig({ includePositionals: true })` support, returning a
  `positionals` copy of the final yargs `_` array with its types and order preserved.
  Keep the default options-only result and document process-style argv, named
  command positionals, passthrough, and reserved-key collisions.

  Refresh links-notation to 0.27.1, optional/dev dotenvx to 2.38.2, ESLint to
  10.13.0, eslint-plugin-prettier to 5.5.7, and Prettier to 3.9.10 to satisfy the
  dependency freshness check after their new releases.

  Assess links-notation 0.27.1 parser/CLI/environment interoperability and document
  the deliberate transitive dependency limit: published lino-env 0.2.8 still
  declares ^0.11.2, requiring an upstream release for full deduplication. Add
  cross-runtime regression coverage and a packed consumer CI check, including an
  isolated metadata-only upstream range migration that resolves one latest parser.

  Fix `changeset version` in the release job failing with `spawn deno ENOENT`:
  Changesets' auto-detected Deno formatter is disabled and the version bump is
  formatted with the project's Prettier instead.

## 0.3.0

### Minor Changes

- ab4273c: Add Rust version and reorganize repository structure
  - Move JavaScript code to ./js folder
  - Add new Rust implementation in ./rust folder
  - Split CI/CD into separate js.yml and rust.yml workflows
  - Shared ./scripts folder between languages
