# lino-arguments

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
