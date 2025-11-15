# lino-arguments

## 0.2.3

### Patch Changes

- 51aa1bd: Test patch release

## 0.2.2

### Patch Changes

- b08f95c: Adapt CI/CD pipeline for npm trusted publishing with provenance support. Replace shell script changeset validation with .mjs script. Add manual release workflow and helper scripts for changeset management.

## 0.2.1

### Patch Changes

- 7b0868d: Replace custom getenv implementation with official npm package. Now uses the robust `getenv` package for type casting and validation, enhanced with case-insensitive lookup across multiple naming conventions. Also enforces stricter no-unused-vars linting with catch { } syntax.

## 0.2.0

### Minor Changes

- e81d376: Implement makeConfig() API with unified configuration system

  This major update implements the requested API design with the following features:
  - **makeConfig() function**: Main API that accepts configuration with lenv, env, getenv, and yargs options
  - **Multi-source configuration**: Automatically loads from dotenvx (.env), lino-env (.lenv), environment variables, and CLI arguments
  - **Priority system**: CLI arguments > getenv defaults > --configuration flag > .lenv file > .env file
  - **Case conversion utilities**: Support for UPPER_CASE, camelCase, PascalCase, snake_case, and kebab-case
  - **getenv() helper**: Intelligent environment variable lookup across all case formats with type preservation
  - **Deprecation warnings**: Yellow console warnings when using dotenvx/.env files
  - **--configuration flag**: Special CLI option to dynamically specify .lenv file path
  - **Automatic key mapping**: kebab-case CLI options automatically convert to camelCase in result object

  The implementation follows the hero example pattern from the PR comments, making it simple to use with sensible defaults while allowing full customization when needed.
