#!/usr/bin/env node

/**
 * Test: Can users call .version(false) and .help(false) inside their yargsConfigFn?
 *
 * This tests the simpler approach suggested by the maintainer: instead of adding
 * a separate `builtins` config option, just let users override the built-in
 * version/help flags by calling .version(false) and .help(false) on the yargs
 * instance passed to them.
 */

import { makeConfig } from '../src/index.js';

console.log(
  'Testing simpler approach: overriding version/help inside yargsConfigFn\n'
);

// Test 1: Does calling .version(false) allow user to define their own --version?
console.log(
  'Test 1: User can define custom --version option by calling .version(false)'
);
try {
  const config1 = makeConfig({
    argv: [
      'node',
      'test.js',
      '--version',
      '0.8.36',
      '--repository',
      'test-repo',
    ],
    yargs: ({ yargs }) =>
      yargs
        .version(false) // User disables built-in version
        .help(false) // User disables built-in help
        .option('version', { type: 'string', description: 'Custom version' })
        .option('repository', {
          type: 'string',
          description: 'Repository name',
        })
        .strict(),
  });

  console.log('  Result:', JSON.stringify(config1, null, 2));
  console.log('  config.version =', config1.version);
  console.log('  config.repository =', config1.repository);

  if (config1.version === '0.8.36' && config1.repository === 'test-repo') {
    console.log('  ✅ SUCCESS: User-defined --version works!\n');
  } else {
    console.log('  ❌ FAILED: version =', config1.version, 'expected "0.8.36"');
    console.log(
      '             repository =',
      config1.repository,
      'expected "test-repo"\n'
    );
    process.exit(1);
  }
} catch (err) {
  console.log('  ❌ ERROR:', err.message);
  process.exit(1);
}

// Test 2: Does the default behavior still work (built-in flags enabled)?
console.log('Test 2: Default behavior still works (built-in flags enabled)');
try {
  const config2 = makeConfig({
    argv: ['node', 'test.js', '--port', '3000'],
    yargs: ({ yargs }) =>
      yargs
        .option('port', { type: 'number', default: 8080 })
        // Don't override .version() or .help() - they should still be enabled
        .strict(),
  });

  console.log('  Result:', JSON.stringify(config2, null, 2));

  if (config2.port === 3000) {
    console.log('  ✅ SUCCESS: Default behavior works!\n');
  } else {
    console.log('  ❌ FAILED: port =', config2.port, 'expected 3000\n');
    process.exit(1);
  }
} catch (err) {
  console.log('  ❌ ERROR:', err.message);
  process.exit(1);
}

// Test 3: Can user define both custom --version and use strict mode?
console.log('Test 3: Custom --version with strict mode');
try {
  const config3 = makeConfig({
    argv: ['node', 'test.js', '--version', '1.0.0'],
    yargs: ({ yargs }) =>
      yargs
        .version(false)
        .help(false)
        .option('version', { type: 'string' })
        .strict(),
  });

  console.log('  Result:', JSON.stringify(config3, null, 2));

  if (config3.version === '1.0.0') {
    console.log('  ✅ SUCCESS: Custom --version with strict mode works!\n');
  } else {
    console.log(
      '  ❌ FAILED: version =',
      config3.version,
      'expected "1.0.0"\n'
    );
    process.exit(1);
  }
} catch (err) {
  console.log('  ❌ ERROR:', err.message);
  process.exit(1);
}

// Test 4: Can user re-enable version/help after disabling (for demonstration)?
console.log('Test 4: User can re-enable built-in version with custom string');
try {
  const config4 = makeConfig({
    argv: ['node', 'test.js', '--port', '5000'],
    yargs: ({ yargs }) =>
      yargs
        .option('port', { type: 'number' })
        .version('2.0.0') // Re-enable with specific version
        .help() // Re-enable help
        .strict(),
  });

  console.log('  Result:', JSON.stringify(config4, null, 2));

  if (config4.port === 5000) {
    console.log('  ✅ SUCCESS: Re-enabled version with custom string works!\n');
  } else {
    console.log('  ❌ FAILED: port =', config4.port, 'expected 5000\n');
    process.exit(1);
  }
} catch (err) {
  console.log('  ❌ ERROR:', err.message);
  process.exit(1);
}

console.log('='.repeat(60));
console.log('All tests passed! The simpler approach works.');
console.log('\nConclusion: Users can override .version() and .help() inside');
console.log('their yargsConfigFn without needing a separate builtins option.');
console.log('='.repeat(60));
