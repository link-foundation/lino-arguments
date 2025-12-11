#!/usr/bin/env node

/**
 * Minimal reproduction script for issue #13:
 * Bug: --version flag conflicts with custom options in makeConfig
 *
 * This script demonstrates that yargs' built-in --version flag
 * overrides user-defined options with the same name.
 *
 * Expected behavior: config.version should be "1.0.0"
 * Actual behavior: config.version is false (before fix)
 */

import { makeConfig } from '../src/index.js';

console.log('Testing --version flag conflict...\n');
console.log('process.argv:', process.argv);

// Parse CLI arguments using lino-arguments
const config = makeConfig({
  yargs: ({ yargs, getenv }) =>
    yargs.option('version', {
      type: 'string',
      default: getenv('VERSION', ''),
      describe: 'Version number (e.g., 1.0.0)',
    }),
  argv: process.argv,
});

console.log('\nconfig.version:', JSON.stringify(config.version));
console.log('config.version type:', typeof config.version);

if (config.version === false) {
  console.error(
    '\n❌ BUG REPRODUCED: --version returned false instead of the value'
  );
  console.error(
    '   This is caused by yargs built-in --version flag overriding custom option'
  );
  process.exit(1);
} else if (config.version === '1.0.0') {
  console.log('\n✅ PASS: --version parsed correctly:', config.version);
  process.exit(0);
} else {
  console.log('\n⚠️  UNEXPECTED: config.version =', config.version);
  process.exit(1);
}
