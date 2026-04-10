# Case Study: Issue #25 — Rust Package Badges in README and Releases

## Issue Reference
- **Issue:** [#25](https://github.com/link-foundation/lino-arguments/issues/25)
- **Title:** Double check we have badges for Rust version of the package in both releases and README and other places in docs where needed
- **State:** Open
- **Labels:** bug, documentation
- **Author:** konard (Konstantin Diachenko)
- **Created:** 2026-04-10

## Timeline / Sequence of Events

1. **2025-12-31** — First JavaScript release `0.3.0` that introduced a Rust version in the repository
2. **2026-01-13** — First Rust-specific release `v0.1.1` published to crates.io
3. **2026-04-04** — Rust release `v0.2.0` published (latest as of issue creation)
4. **2026-04-10** — Issue #25 filed: Rust version badges are missing/incomplete in README and documentation

## Requirements (from Issue)

1. **Verify and add Rust version badge** — Confirm a crates.io version badge exists in both the root `README.md` and `rust/README.md`
2. **Verify and add other Rust badges** — CI status, docs.rs, downloads, license badges for Rust
3. **Check all documentation locations** — Not just READMEs but also releases, docs pages, and any other places where badges would be useful
4. **Deep case study analysis** — Compile all data, reconstruct timeline, find root causes, propose solutions

## Current State Analysis

### Root `README.md` Badges (before fix)
```
[![License: Unlicense](...)
[![npm version](https://img.shields.io/npm/v/lino-arguments.svg)](https://www.npmjs.com/package/lino-arguments)
```

**Missing:** Rust/crates.io version badge, docs.rs badge, Rust CI status badge

### `rust/README.md` Badges (before fix)
```
[![License: Unlicense](...)
```

**Missing:** crates.io version badge, docs.rs badge, Rust CI status badge

## Root Cause Analysis

### Root Cause 1: Rust was added after initial JS README structure
When the Rust version was first introduced (around release 0.3.0 in Dec 2025), the root README was updated to mention Rust, but only the JS badge row was present. The Rust section was added as documentation text without corresponding badges.

### Root Cause 2: No badge review process in release workflow
The automated release pipeline (`rust.yml`) does not include a step to verify that package documentation (README) contains appropriate badges for discoverability. There is no lint/check for badge presence.

### Root Cause 3: `rust/README.md` only has license badge
The Rust-specific README was created without following the same pattern as JS which has a version badge. The most important badge for a library on crates.io is the version badge showing the published version.

## Available Badge Types for Rust/crates.io Packages

### Version Badge (most important)
```markdown
[![Crates.io](https://img.shields.io/crates/v/lino-arguments.svg)](https://crates.io/crates/lino-arguments)
```

### Documentation Badge (docs.rs)
```markdown
[![docs.rs](https://img.shields.io/docsrs/lino-arguments)](https://docs.rs/lino-arguments)
```

### Downloads Badge
```markdown
[![Crates.io Downloads](https://img.shields.io/crates/d/lino-arguments.svg)](https://crates.io/crates/lino-arguments)
```

### CI/Build Status Badge
```markdown
[![Rust CI](https://github.com/link-foundation/lino-arguments/actions/workflows/rust.yml/badge.svg)](https://github.com/link-foundation/lino-arguments/actions/workflows/rust.yml)
```

### Minimum Supported Rust Version (MSRV) Badge
```markdown
[![Rust Version](https://img.shields.io/badge/rust-stable-orange.svg)](https://www.rust-lang.org)
```

## Proposed Solutions

### Solution 1 (Implemented): Add badges to root README.md and rust/README.md

In **root `README.md`** under the Rust section, add:
```markdown
[![Crates.io](https://img.shields.io/crates/v/lino-arguments.svg)](https://crates.io/crates/lino-arguments)
[![docs.rs](https://img.shields.io/docsrs/lino-arguments)](https://docs.rs/lino-arguments)
```

In **`rust/README.md`** header, add:
```markdown
[![Crates.io](https://img.shields.io/crates/v/lino-arguments.svg)](https://crates.io/crates/lino-arguments)
[![docs.rs](https://img.shields.io/docsrs/lino-arguments)](https://docs.rs/lino-arguments)
[![Rust CI](https://github.com/link-foundation/lino-arguments/actions/workflows/rust.yml/badge.svg)](https://github.com/link-foundation/lino-arguments/actions/workflows/rust.yml)
```

### Solution 2 (Future): Add badge check to CI
Consider adding a CI check that validates README files contain required badges for published packages.

## Known Similar Implementations / Libraries

- **shields.io** — The industry standard for README badges. Supports crates.io natively.
  - URL pattern: `https://img.shields.io/crates/v/{crate-name}.svg`
  - Docs: https://shields.io/badges/crates-io-version
- **docs.rs** — Automatically generates documentation for crates published to crates.io
  - Badge URL: `https://img.shields.io/docsrs/{crate-name}`
- **GitHub Actions status badge** — Built-in feature of GitHub Actions workflows
  - URL pattern: `{repo}/actions/workflows/{workflow-file}/badge.svg`

## Files Changed
- `README.md` — Added Rust version badge under Rust section
- `rust/README.md` — Added crates.io, docs.rs, and CI status badges
- `rust/changelog.d/added-rust-badges.md` — Changelog fragment for this change
