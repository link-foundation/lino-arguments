---
bump: patch
---

### Fixed
- CI/CD: Prevent duplicate version publishing by checking crates.io registry before attempting publish
- CI/CD: Properly capture cargo publish stderr to detect "already exists" errors
- CI/CD: Use language-specific tag prefixes (`rust_X.Y.Z`) to avoid tag collisions with JavaScript releases
