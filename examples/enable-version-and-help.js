import { makeConfig } from '../src/index.js';

/**
 * Example demonstrating how to explicitly enable yargs' built-in
 * --version and --help flags in makeConfig()
 *
 * By default, makeConfig() disables these built-in flags to allow users
 * to define their own --version and --help options. However, if you want
 * to use yargs' built-in version and help functionality, you can explicitly
 * enable them as shown below.
 */

console.log('=== Enabling Built-in Version and Help Flags ===\n');

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

// Example 4: Important note about user-defined options
console.log('4. Why makeConfig() disables these flags by default:');
console.log(`
Without disabling built-in flags, user-defined --version options would conflict:

// This would FAIL if we didn't disable built-in flags:
const config = makeConfig({
  yargs: ({ yargs }) =>
    yargs
      .option('version', {
        type: 'string',
        description: 'Release version to process',
      })
      .strict(),
  argv: ['node', 'script.js', '--version', '0.8.36']
});

// Error: Unknown argument: 0.8.36
// Because yargs' built-in --version would intercept the flag

To use built-in flags, explicitly enable them as shown in examples above.
To use custom --version or --help options, don't call .version() or .help().
`);

console.log('\n=== Summary ===');
console.log(
  '✅ Built-in --version and --help are disabled by default in makeConfig()'
);
console.log(
  '✅ Explicitly call .version() and .help() to enable them when needed'
);
console.log(
  '✅ This gives you full control over your CLI interface without conflicts'
);
