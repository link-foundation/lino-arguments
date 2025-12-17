#!/usr/bin/env node

/**
 * Test makeConfig() WITHOUT strict mode
 */

import { makeConfig } from '../src/index.js';

console.log('=== process.argv ===');
console.log(JSON.stringify(process.argv, null, 2));
console.log('');

console.log('=== Testing WITHOUT .strict() ===');
const config = makeConfig({
  builtins: { version: false, help: false }, // Disable built-in flags to allow custom --version
  yargs: ({ yargs, getenv }) =>
    yargs
      .option('version', {
        type: 'string',
        description: 'Version to process',
        default: getenv('VERSION') || '',
      })
      .option('repository', {
        type: 'string',
        description: 'Repository name',
        default: getenv('REPOSITORY') || '',
      }),
  // NO .strict() here
});

console.log('=== Result ===');
console.log(JSON.stringify(config, null, 2));
console.log('');

const version = config.version;
const repository = config.repository;

if (!version || !repository) {
  console.error('❌ Error: Missing required arguments');
  process.exit(1);
}

console.log('✅ Success!');
console.log(`  version: "${version}"`);
console.log(`  repository: "${repository}"`);
