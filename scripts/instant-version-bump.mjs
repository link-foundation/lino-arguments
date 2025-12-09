#!/usr/bin/env node

/**
 * Instant version bump script for manual releases
 * Bypasses the changeset workflow and directly updates version and changelog
 *
 * Usage: node scripts/instant-version-bump.mjs <bump_type> [description]
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';

try {
  // Get bump type from command line arguments
  const bumpType = process.argv[2];
  const description =
    process.argv.slice(3).join(' ') || `Manual ${bumpType} release`;

  if (!bumpType || !['major', 'minor', 'patch'].includes(bumpType)) {
    console.error(
      'Usage: node scripts/instant-version-bump.mjs <major|minor|patch> [description]'
    );
    process.exit(1);
  }

  console.log(`\nBumping version (${bumpType})...`);

  // Get current version
  const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'));
  const oldVersion = packageJson.version;
  console.log(`Current version: ${oldVersion}`);

  // Bump version using npm version (doesn't create git tag)
  execSync(`npm version ${bumpType} --no-git-tag-version`, {
    stdio: 'inherit',
  });

  // Get new version
  const updatedPackageJson = JSON.parse(readFileSync('package.json', 'utf-8'));
  const newVersion = updatedPackageJson.version;
  console.log(`New version: ${newVersion}`);

  // Update CHANGELOG.md
  console.log('\nUpdating CHANGELOG.md...');
  const changelogPath = 'CHANGELOG.md';
  let changelog = readFileSync(changelogPath, 'utf-8');

  // Create new changelog entry
  const newEntry = `## ${newVersion}

### ${bumpType.charAt(0).toUpperCase() + bumpType.slice(1)} Changes

- ${description}

`;

  // Insert new entry after the first heading (# Changelog or similar)
  // Look for the first ## heading and insert before it
  const firstVersionMatch = changelog.match(/^## /m);

  if (firstVersionMatch) {
    const insertPosition = firstVersionMatch.index;
    changelog =
      changelog.slice(0, insertPosition) +
      newEntry +
      changelog.slice(insertPosition);
  } else {
    // If no version headings exist, append after the main heading
    const mainHeadingMatch = changelog.match(/^# .+$/m);
    if (mainHeadingMatch) {
      const insertPosition =
        mainHeadingMatch.index + mainHeadingMatch[0].length;
      changelog = `${changelog.slice(0, insertPosition)}\n\n${
        newEntry
      }${changelog.slice(insertPosition)}`;
    } else {
      // If no headings at all, prepend
      changelog = `${newEntry}\n${changelog}`;
    }
  }

  writeFileSync(changelogPath, changelog, 'utf-8');
  console.log('✅ CHANGELOG.md updated');

  // Synchronize package-lock.json
  console.log('\nSynchronizing package-lock.json...');
  execSync('npm install --package-lock-only', { stdio: 'inherit' });

  console.log('\n✅ Instant version bump complete');
  console.log(`Version: ${oldVersion} → ${newVersion}`);
} catch (error) {
  console.error('Error during instant version bump:', error.message);
  if (process.env.DEBUG) {
    console.error('Stack trace:', error.stack);
  }
  process.exit(1);
}
