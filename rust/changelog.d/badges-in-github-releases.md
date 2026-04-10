---
bump: patch
---

### Added
- `scripts/format-rust-release.mjs` — new CI/CD script that appends crates.io version and docs.rs badges to Rust GitHub release notes after each release
- Rust CI/CD workflow now calls `format-rust-release.mjs` in both `auto-release` and `manual-release` jobs so every published Rust release automatically includes badge links
- Fixed `scripts/format-release-notes.mjs` to accept named CLI flags (`--release-id`, `--release-version`, `--repository`) in addition to legacy positional arguments, enabling proper npm badge injection for JS releases
