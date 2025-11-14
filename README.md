# lino-arguments

A setup of Links Notation Environment (lenv) + yargs to support easy configuration of CLI apps

[![npm version](https://img.shields.io/npm/v/lino-arguments.svg)](https://www.npmjs.com/package/lino-arguments)
[![License: Unlicense](https://img.shields.io/badge/license-Unlicense-blue.svg)](http://unlicense.org/)

## Overview

`lino-arguments` provides a unified configuration approach for command-line applications by combining:

- **`.lenv` files** - Environment configuration using Links Notation format
- **Links notation** - A natural, human-readable data format for structured information
- **yargs** - Powerful command-line argument parsing

This library makes it easy to manage configuration from multiple sources:

1. Environment files (`.lenv`)
2. Environment variables (using links notation format)
3. Command-line arguments
4. Programmatic defaults

## Installation

```bash
npm install lino-arguments
```

## Quick Start

### Basic Usage

```javascript
import { parseLinoArguments, createYargsConfig } from 'lino-arguments';

// Parse arguments from links notation format
const args = parseLinoArguments(`(
  --verbose
  --port 3000
  --host localhost
)`);

// Use with yargs
const config = createYargsConfig(['node', 'script.js', ...args])
  .option('verbose', { type: 'boolean', default: false })
  .option('port', { type: 'number', default: 8080 })
  .option('host', { type: 'string', default: '0.0.0.0' })
  .parse();

console.log(config);
// { verbose: true, port: 3000, host: 'localhost' }
```

### Advanced Usage - Merge Multiple Sources

```javascript
import { mergeAndParse } from 'lino-arguments';

const config = await mergeAndParse({
  // Define your yargs configuration
  yargsConfig: (yargs) =>
    yargs
      .option('port', { type: 'number', default: 3000 })
      .option('debug', { type: 'boolean', default: false }),

  // Load from .lenv file
  lenvPath: '.lenv',

  // Parse overrides from environment variable
  overridesEnvVar: 'CLI_OVERRIDES',

  // Additional arguments
  additionalArgs: ['--debug'],

  // Apply .lenv to process.env
  applyEnvToProcess: true,
});
```

## API Reference

### `parseLinoArguments(linoString)`

Parse arguments from links notation format into an array.

**Parameters:**

- `linoString` (string): String in links notation format

**Returns:** `string[]` - Array of parsed arguments

**Example:**

```javascript
const args = parseLinoArguments('(\n  --verbose\n  --port 3000\n)');
// Returns: ['--verbose', '--port', '3000']
```

### `loadLinoEnv(filePath)`

Load environment configuration from a `.lenv` file.

**Parameters:**

- `filePath` (string): Path to the `.lenv` file (default: `'.lenv'`)

**Returns:** `LinoEnv` - LinoEnv instance with loaded data

**Example:**

```javascript
const env = loadLinoEnv('.lenv');
const apiKey = env.get('API_KEY');
```

### `applyLinoEnv(filePath, options)`

Apply `.lenv` configuration to `process.env`.

**Parameters:**

- `filePath` (string): Path to the `.lenv` file (default: `'.lenv'`)
- `options` (Object): Options
  - `override` (boolean): Whether to override existing process.env values (default: `false`)

**Returns:** `Object` - Object containing all loaded environment variables

**Example:**

```javascript
applyLinoEnv('.lenv', { override: false });
```

### `parseEnvArguments(envVarName, defaultValue)`

Parse arguments from an environment variable using links notation.

**Parameters:**

- `envVarName` (string): Name of the environment variable
- `defaultValue` (string): Default value if environment variable is not set

**Returns:** `string[]` - Parsed arguments array

**Example:**

```javascript
// If process.env.CLI_OVERRIDES = '(\n  --debug\n  --port 8080\n)'
const overrides = parseEnvArguments('CLI_OVERRIDES');
// Returns: ['--debug', '--port', '8080']
```

### `createYargsConfig(argv)`

Create a yargs instance pre-configured with lino-arguments helpers.

**Parameters:**

- `argv` (string[]): Command line arguments (default: `process.argv`)

**Returns:** `Object` - Configured yargs instance

**Example:**

```javascript
const args = createYargsConfig().option('verbose', { type: 'boolean' }).parse();
```

### `mergeAndParse(config)`

Merge multiple argument sources and parse with yargs.

**Parameters:**

- `config` (Object): Configuration object
  - `yargsConfig` (Function): Yargs configuration function
  - `lenvPath` (string): Path to `.lenv` file (optional)
  - `overridesEnvVar` (string): Environment variable name for overrides (optional)
  - `additionalArgs` (string[]): Additional arguments to parse (optional)
  - `applyEnvToProcess` (boolean): Apply `.lenv` to process.env (default: `true`)

**Returns:** `Promise<Object>` - Parsed arguments

**Example:**

```javascript
const args = await mergeAndParse({
  yargsConfig: (yargs) =>
    yargs.option('port', { type: 'number', default: 3000 }),
  lenvPath: '.lenv',
  overridesEnvVar: 'CLI_OVERRIDES',
  additionalArgs: ['--verbose'],
});
```

### `loadDotenvx(options)` (DEPRECATED)

**⚠️ DEPRECATED:** Use Links Notation (`.lenv` files) for environment configuration instead.

Load dotenvx configuration. This function displays a deprecation warning.

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

## Examples

See the `examples/` directory for complete examples:

- `basic-usage.js` - Simple parsing and yargs integration
- `advanced-usage.js` - Full workflow with multiple configuration sources
- `.lenv.example` - Example environment configuration file

## Links Notation Format

Links notation is a natural, human-readable format for structured data. Arguments can be specified in a clean, readable way:

```
(
  --verbose
  --port 3000
  --host localhost
)
```

Or with environment variables:

```bash
export CLI_OVERRIDES="(
  --debug
  --trace
  --output ./logs
)"
```

## Integration Example

Based on the pattern from [hive-mind](https://github.com/deep-assistant/hive-mind), here's how to use lino-arguments in a real application:

```javascript
import { mergeAndParse, parseEnvArguments } from 'lino-arguments';

async function main() {
  // Parse configuration from multiple sources
  const config = await mergeAndParse({
    yargsConfig: (yargs) =>
      yargs
        .option('port', { type: 'number', default: 3000 })
        .option('verbose', { type: 'boolean', default: false })
        .option('debug', { type: 'boolean', default: false }),
    lenvPath: '.lenv',
    overridesEnvVar: 'APP_OVERRIDES',
    applyEnvToProcess: true,
  });

  // Start your application with the merged config
  startApp(config);
}

main();
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
