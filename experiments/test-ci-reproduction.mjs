#!/usr/bin/env node

/**
 * CI Reproduction Test for Issue #14
 *
 * This script tests makeConfig() behavior in a CI-like environment
 * to reproduce the parsing failure reported in GitHub Actions.
 *
 * Usage:
 *   node experiments/test-ci-reproduction.mjs --version "0.8.36" --repository "link-foundation/test-anywhere"
 */

import { makeConfig } from '../src/index.js';

// Debug: Print process.argv
console.log('=== DEBUG: process.argv ===');
console.log(JSON.stringify(process.argv, null, 2));
console.log('');

// Configure CLI arguments using lino-arguments
console.log('=== Calling makeConfig() ===');
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
      })
      .strict(),
});

console.log('=== Result from makeConfig() ===');
console.log(JSON.stringify(config, null, 2));
console.log('');

const version = config.version;
const repository = config.repository;

console.log('=== Extracted Values ===');
console.log(`version: "${version}"`);
console.log(`repository: "${repository}"`);
console.log('');

if (!version || !repository) {
  console.error('❌ Error: Missing required arguments');
  console.error(`  version is ${version ? 'present' : 'MISSING'}`);
  console.error(`  repository is ${repository ? 'present' : 'MISSING'}`);
  process.exit(1);
}

console.log('✅ Arguments parsed successfully!');
process.exit(0);
