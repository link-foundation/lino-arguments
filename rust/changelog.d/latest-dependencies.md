---
bump: patch
---

### Changed

- Update every direct dependency to its latest release, including ctor 1.0.13
  and thiserror 2.0.21, and refresh all compatible lockfile dependencies.
- Adapt startup initialization to ctor's required explicit unsafe annotation.
- Enforce dependency freshness in CI and verify a consumer uses a single copy
  of ctor and thiserror while preserving startup loading and error sources.
