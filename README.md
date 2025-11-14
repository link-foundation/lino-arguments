# lino-arguments

A unified configuration library combining Links Notation Environment (lino-env), yargs, and environment variables with a clear priority chain.

[![npm version](https://img.shields.io/npm/v/lino-arguments.svg)](https://www.npmjs.com/package/lino-arguments)
[![License: Unlicense](https://img.shields.io/badge/license-Unlicense-blue.svg)](http://unlicense.org/)

## Overview

`lino-arguments` provides a unified configuration system that automatically loads configuration from multiple sources with a clear priority chain:

1. **CLI arguments** - Highest priority (manually entered options)
2. **getenv defaults** - Environment variable lookups with fallbacks
3. **--configuration flag** - Dynamic .lenv file path via CLI
4. **`.lenv` file** - Local environment overrides using Links Notation
5. **`.env` file** - Base configuration (DEPRECATED, use .lenv instead)

## Installation

```bash
npm install lino-arguments
```

## Quick Start

### Hero Example

```javascript
import { makeConfig } from 'lino-arguments';

const config = makeConfig({
  yargs: ({ yargs, getenv }) =>
    yargs.option('port', { default: getenv('PORT', 3000) }),
});
```

That's it! This simple configuration:

- ✅ Loads from `.lenv` file automatically
- ✅ Reads `PORT` environment variable with fallback to 3000
- ✅ Accepts `--port` CLI argument with highest priority
- ✅ Supports `--configuration` to specify custom .lenv file path
- ✅ Returns clean object with camelCase keys

### Complete Example

````javascript
import { makeConfig } from 'lino-arguments';

const config = makeConfig({
  yargs: ({ yargs, getenv }) =>
    yargs
      .option('port', {
        type: 'number',
        default: getenv('PORT', 3000),
        describe: 'Server port'
      })
      .option('api-key', {
        type: 'string',
        default: getenv('API_KEY', ''),
        describe: 'API authentication key'
      })
      .option('verbose', {
        type: 'boolean',
        default: false,
        describe: 'Enable verbose logging'
      })
});

console.log(config);
// { port: 3000, apiKey: '...', verbose: false }

## API Reference

### `makeConfig(config)` (Primary API)

The main function for creating unified configuration from multiple sources.

**Parameters:**

- `config` (Object): Configuration object
  - `yargs` (Function): Required. Yargs configuration function receiving `({ yargs, getenv })`
  - `lenv` (Object): Optional. .lenv file configuration
    - `enabled` (boolean): Enable .lenv loading (default: `true`)
    - `path` (string): Path to .lenv file (default: `'.lenv'`)
    - `override` (boolean): Override existing env vars (default: `true`)
  - `env` (Object): Optional. dotenvx/.env configuration (DEPRECATED)
    - `enabled` (boolean): Enable .env loading (default: `false`)
    - `quiet` (boolean): Suppress deprecation warnings (default: `true`)
  - `getenv` (Object): Optional. getenv helper configuration
    - `enabled` (boolean): Enable getenv helper (default: `true`)
  - `argv` (string[]): Optional. Custom argv to parse (default: `process.argv`)

**Returns:** `Object` - Parsed configuration with camelCase keys

**Example:**

```javascript
const config = makeConfig({
  yargs: ({ yargs, getenv }) =>
    yargs
      .option('port', { type: 'number', default: getenv('PORT', 3000) })
      .option('api-key', { type: 'string', default: getenv('API_KEY', '') })
      .option('verbose', { type: 'boolean', default: false })
});
````

### `getenv(name, defaultValue)`

Smart environment variable lookup with type preservation and case conversion.

**Parameters:**

- `name` (string): Environment variable name (any case format)
- `defaultValue` (any): Default value if not found

**Returns:** Same type as `defaultValue`

**Example:**

```javascript
// All these work and return the same value:
getenv('API_KEY', ''); // UPPER_CASE
getenv('apiKey', ''); // camelCase
getenv('api-key', ''); // kebab-case
getenv('api_key', ''); // snake_case

// Type preservation:
getenv('PORT', 3000); // Returns number
getenv('DEBUG', false); // Returns boolean
getenv('API_KEY', ''); // Returns string
```

### Case Conversion Utilities

Utility functions for converting between naming conventions:

- `toUpperCase(str)` - Convert to UPPER_CASE (environment variables)
- `toCamelCase(str)` - Convert to camelCase (config object keys)
- `toKebabCase(str)` - Convert to kebab-case (CLI options)
- `toSnakeCase(str)` - Convert to snake_case
- `toPascalCase(str)` - Convert to PascalCase

**Example:**

```javascript
import { toUpperCase, toCamelCase, toKebabCase } from 'lino-arguments';

toUpperCase('apiKey'); // 'API_KEY'
toCamelCase('api-key'); // 'apiKey'
toKebabCase('apiKey'); // 'api-key'
```

### Low-level APIs (Advanced Usage)

These functions are available for advanced use cases but `makeConfig()` is recommended for most applications:

#### `applyLinoEnv(filePath, options)`

Apply `.lenv` file to `process.env`.

#### `loadDotenvx(options)` (DEPRECATED)

**⚠️ DEPRECATED:** Use `.lenv` files instead of `.env` files.

## `.lenv` File Format

The `.lenv` file uses Links Notation format with `: ` (colon-space) separator:

```
# Database configuration
DATABASE_URL: postgresql://localhost:5432/myapp
DATABASE_POOL_SIZE: 10

# API Keys
API_KEY: your_api_key_here
SECRET_KEY: your_secret_key_here

# Application settings
APP_NAME: My Application
APP_PORT: 3000
```

## Features

### Multi-source Configuration Loading

`makeConfig()` automatically loads and merges configuration from multiple sources with a clear priority chain:

```javascript
const config = makeConfig({
  yargs: ({ yargs, getenv }) =>
    yargs.option('port', { default: getenv('PORT', 3000) }),
});
```

**Priority order (highest to lowest):**

1. CLI arguments: `--port 8080`
2. getenv defaults: `process.env.PORT`
3. --configuration flag: `--configuration custom.lenv`
4. .lenv file: Local environment overrides
5. .env file: Base configuration (DEPRECATED)

### Smart Environment Variable Lookup

The `getenv()` helper automatically searches for environment variables in all common case formats:

```javascript
// If process.env.API_KEY = 'secret123'
getenv('API_KEY', ''); // ✅ Found
getenv('apiKey', ''); // ✅ Found (converted to API_KEY)
getenv('api-key', ''); // ✅ Found (converted to API_KEY)
getenv('api_key', ''); // ✅ Found (converted to API_KEY)
```

### Automatic Key Mapping

CLI options in kebab-case are automatically converted to camelCase in the result:

```bash
$ node app.js --api-key mykey --max-connections 100
```

```javascript
const config = makeConfig({
  yargs: ({ yargs }) =>
    yargs
      .option('api-key', { type: 'string' })
      .option('max-connections', { type: 'number' }),
});

console.log(config);
// { apiKey: 'mykey', maxConnections: 100 }
```

### Dynamic Configuration Files

Use `--configuration` (or `-c`) to specify a different .lenv file at runtime:

```bash
$ node app.js --configuration production.lenv
```

## Real-world Example

Here's a complete example based on the [hive-mind](https://github.com/deep-assistant/hive-mind) pattern:

```javascript
import { makeConfig } from 'lino-arguments';

const config = makeConfig({
  yargs: ({ yargs, getenv }) =>
    yargs
      .option('port', {
        type: 'number',
        default: getenv('PORT', 3000),
        describe: 'Server port',
      })
      .option('telegram-token', {
        type: 'string',
        default: getenv('TELEGRAM_TOKEN', ''),
        describe: 'Telegram bot token',
      })
      .option('api-key', {
        type: 'string',
        default: getenv('API_KEY', ''),
        describe: 'API authentication key',
      })
      .option('verbose', {
        type: 'boolean',
        default: false,
        describe: 'Enable verbose logging',
      })
      .option('debug', {
        type: 'boolean',
        default: false,
        describe: 'Enable debug mode',
      }),
});

// Start your application
startServer(config);
```

Create a `.lenv` file for local development:

```
PORT: 3000
TELEGRAM_TOKEN: 1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
API_KEY: dev_key_12345
```

Override values via CLI:

```bash
$ node app.js --port 8080 --verbose
```

## Testing

The library uses [test-anywhere](https://github.com/link-foundation/test-anywhere) for testing across multiple JavaScript runtimes:

```bash
# Run tests on Node.js
npm test

# Run tests on Bun
bun test

# Run tests on Deno
deno test --allow-read
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run linting
npm run lint

# Check formatting
npm run format:check

# Fix formatting
npm run format

# Check file size limits
npm run check:file-size
```

## Contributing

We use [changesets](https://github.com/changesets/changesets) for version management:

```bash
# Create a changeset
npm run changeset

# Check changeset status
npm run changeset:status
```

## Related Projects

- [links-notation](https://github.com/link-foundation/links-notation) - Links Notation parser
- [lino-env](https://github.com/link-foundation/lino-env) - .lenv file operations
- [test-anywhere](https://github.com/link-foundation/test-anywhere) - Universal JavaScript testing

## License

This is free and unencumbered software released into the public domain. See the [LICENSE](LICENSE) file for details.
