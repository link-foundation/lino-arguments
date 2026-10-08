---
'lino-arguments': minor
---

Update all runtime, optional peer, and development dependencies to their latest
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
