#!/usr/bin/env node

/**
 * Minimal reproduction script for issue #13:
 * Bug: --help flag conflicts with custom options in makeConfig
 *
 * This script demonstrates that yargs' built-in --help flag
 * overrides user-defined options with the same name.
 *
 * Expected behavior: config.help should be "some-value"
 * Actual behavior: config.help is true or triggers help display (before fix)
 */

import { makeConfig } from '../src/index.js';

console.log('Testing --help flag conflict...\n');
console.log('process.argv:', process.argv);

// Parse CLI arguments using lino-arguments
const config = makeConfig({
  yargs: ({ yargs, getenv }) =>
    yargs.option('help', {
      type: 'string',
      default: getenv('HELP', ''),
      describe: 'Help text or documentation URL',
    }),
  argv: process.argv,
});

console.log('\nconfig.help:', JSON.stringify(config.help));
console.log('config.help type:', typeof config.help);

if (typeof config.help === 'boolean') {
  console.error(
    '\n❌ BUG REPRODUCED: --help returned boolean instead of string value'
  );
  console.error(
    '   This is caused by yargs built-in --help flag overriding custom option'
  );
  process.exit(1);
} else if (config.help === 'some-value') {
  console.log('\n✅ PASS: --help parsed correctly:', config.help);
  process.exit(0);
} else {
  console.log('\n⚠️  UNEXPECTED: config.help =', config.help);
  process.exit(1);
}
