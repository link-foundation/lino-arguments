import { makeConfig } from '../src/index.js';

/**
 * Example demonstrating how to work with yargs' built-in --version and --help flags
 *
 * By default, makeConfig() enables yargs' built-in version and help flags
 * for backwards compatibility. However, if you want to define your own
 * --version or --help options, you can disable the built-in flags using
 * the `builtins` configuration option.
 */

console.log('=== Working with Built-in Version and Help Flags ===\n');

// Example 1: Enable built-in --version flag
console.log('1. Enabling built-in --version flag:');
const configWithVersion = makeConfig({
  yargs: ({ yargs }) =>
    yargs
      .option('port', {
        type: 'number',
        description: 'Server port',
        default: 3000,
      })
      .option('host', {
        type: 'string',
        description: 'Server host',
        default: 'localhost',
      })
      .version('1.0.0'), // Explicitly enable version with your app version

  argv: ['node', 'script.js', '--port', '8080'],
});

console.log('Config:', configWithVersion);
console.log('Port:', configWithVersion.port);
console.log();

// Example 2: Enable both --version and --help
console.log('2. Enabling both --version and --help:');
const configWithBoth = makeConfig({
  yargs: ({ yargs }) =>
    yargs
      .option('debug', {
        type: 'boolean',
        description: 'Enable debug mode',
        default: false,
      })
      .option('verbose', {
        type: 'boolean',
        description: 'Enable verbose output',
        default: false,
      })
      .version('2.5.0') // Enable version
      .help(), // Enable help

  argv: ['node', 'script.js', '--debug'],
});

console.log('Config:', configWithBoth);
console.log('Debug:', configWithBoth.debug);
console.log();

// Example 3: Custom version string from package.json
console.log('3. Using package.json version:');
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../package.json'), 'utf-8')
);

const configWithPackageVersion = makeConfig({
  yargs: ({ yargs }) =>
    yargs
      .option('config', {
        type: 'string',
        description: 'Configuration file path',
        default: './config.json',
      })
      .version(packageJson.version) // Use version from package.json
      .alias('version', 'v') // Add -v alias
      .help()
      .alias('help', 'h'), // Add -h alias

  argv: ['node', 'script.js', '--config', './custom.json'],
});

console.log('Config:', configWithPackageVersion);
console.log('Config file:', configWithPackageVersion.config);
console.log();

// Example 4: Using custom --version option (disable built-in)
console.log('4. Disabling built-in flags to use custom --version:');
const configWithCustomVersion = makeConfig({
  builtins: { version: false, help: false }, // Disable built-in flags
  yargs: ({ yargs }) =>
    yargs
      .option('version', {
        type: 'string',
        description: 'Release version to process',
        default: '',
      })
      .option('repository', {
        type: 'string',
        description: 'Repository name',
        default: '',
      })
      .strict(),
  argv: [
    'node',
    'script.js',
    '--version',
    '0.8.36',
    '--repository',
    'test-repo',
  ],
});

console.log('Config:', configWithCustomVersion);
console.log('Version:', configWithCustomVersion.version);
console.log('Repository:', configWithCustomVersion.repository);
console.log();

console.log('\n=== Summary ===');
console.log(
  '✅ Built-in --version and --help are ENABLED by default (backwards compatible)'
);
console.log(
  '✅ Explicitly call .version() and .help() in yargs config to set version string'
);
console.log(
  '✅ To use custom --version or --help options, set builtins: { version: false, help: false }'
);
console.log(
  '✅ This gives you full control over your CLI interface without breaking changes'
);
