import { makeConfig } from '../src/index.js';

/**
 * Example: Working with yargs' built-in --version and --help flags
 *
 * By default, yargs enables built-in --version and --help flags.
 * If you want to define your own --version or --help options, you can
 * disable the built-in flags by calling .version(false) and .help(false)
 * on the yargs instance inside your configuration function.
 *
 * This approach is simple, explicit, and gives you full control.
 */

console.log('=== Working with Built-in Version and Help Flags ===\n');

// Example 1: Enable built-in --version flag with custom version string
console.log('1. Enabling built-in --version flag with custom version:');
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
      .version('1.0.0'), // Set your app version

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

// Example 4: Disable built-in flags to use custom --version option
// This is the solution for Issue #14
console.log('4. Disabling built-in flags to use custom --version:');
const configWithCustomVersion = makeConfig({
  yargs: ({ yargs }) =>
    yargs
      .version(false) // Disable built-in --version flag
      .help(false) // Disable built-in --help flag
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

// Example 5: Disable only --version but keep --help
console.log('5. Disable only --version but keep --help:');
const configPartialDisable = makeConfig({
  yargs: ({ yargs }) =>
    yargs
      .version(false) // Disable built-in --version
      .option('version', {
        type: 'string',
        description: 'Release version',
        default: '',
      })
      .option('name', {
        type: 'string',
        description: 'Project name',
        default: '',
      })
      .help() // Keep built-in --help enabled
      .strict(),
  argv: ['node', 'script.js', '--version', '1.2.3', '--name', 'my-project'],
});

console.log('Config:', configPartialDisable);
console.log('Version:', configPartialDisable.version);
console.log('Name:', configPartialDisable.name);
console.log();

console.log('\n=== Summary ===');
console.log('By default, yargs provides built-in --version and --help flags.');
console.log('');
console.log('To use your own --version or --help options:');
console.log(
  '  1. Call .version(false) and/or .help(false) on the yargs instance'
);
console.log('  2. Define your custom options with .option()');
console.log('');
console.log('Example:');
console.log('  makeConfig({');
console.log('    yargs: ({ yargs }) =>');
console.log('      yargs');
console.log(
  '        .version(false)  // Disable built-in to allow custom --version'
);
console.log('        .option("version", { type: "string" })');
console.log('        .strict()');
console.log('  })');
