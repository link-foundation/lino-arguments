#!/usr/bin/env node

/**
 * Test with renamed option (ver instead of version)
 */

import { makeConfig } from '../src/index.js';

console.log('=== Testing with --ver instead of --version ===');
const config = makeConfig({
  yargs: ({ yargs, getenv }) =>
    yargs
      .option('ver', {
        type: 'string',
        description: 'Version to process',
        default: getenv('VERSION') || '',
      })
      .option('repository', {
        type: 'string',
        description: 'Repository name',
        default: getenv('REPOSITORY') || '',
      })
      .help()
      .strict(),
});

console.log('Result:', JSON.stringify(config, null, 2));

if (config.ver && config.repository) {
  console.log('✅ Success!');
}
