# Changelog Fragments

This directory contains changelog fragments for the Rust version.

## Creating a Fragment

Create a new `.md` file with a descriptive name:

```
added-case-conversion.md
fixed-env-lookup.md
```

## Fragment Format

Each fragment should contain a brief description of the change:

```markdown
### Added
- New `to_pascal_case` function for case conversion
```

Or:

```markdown
### Fixed
- Environment variable lookup now handles empty strings correctly
```

## Categories

- **Added** - New features
- **Changed** - Changes to existing functionality
- **Deprecated** - Features that will be removed
- **Removed** - Removed features
- **Fixed** - Bug fixes
- **Security** - Security improvements
