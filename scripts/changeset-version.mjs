#!/usr/bin/env node

/**
 * Custom changeset version script that ensures package-lock.json is synchronized
 * with package.json after version bumps.
 *
 * This script:
 * 1. Runs `changeset version` to update package versions
 * 2. Formats the files it wrote with the project's prettier
 * 3. Runs `npm install` to synchronize package-lock.json with the new versions
 *
 * Changesets' own formatting is disabled (`"format": false` in
 * .changeset/config.json): its auto-detection picks Deno from deno.json /
 * deno.lock and spawns `deno`, which the npm release job does not install
 * (`Error: spawn deno ENOENT`).
 */

import { execSync } from 'child_process';

try {
  console.log('Running changeset version...');
  execSync('npx changeset version', { stdio: 'inherit' });

  console.log('\nFormatting the version bump with prettier...');
  execSync(
    'npx --no-install prettier --write --no-error-on-unmatched-pattern CHANGELOG.md package.json',
    { stdio: 'inherit' }
  );

  console.log('\nSynchronizing package-lock.json...');
  execSync('npm install --package-lock-only', { stdio: 'inherit' });

  console.log('\n✅ Version bump complete with synchronized package-lock.json');
} catch (error) {
  console.error('Error during version bump:', error.message);
  process.exit(1);
}
