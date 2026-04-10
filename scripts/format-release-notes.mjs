#!/usr/bin/env node

/**
 * Script to format JavaScript GitHub release notes with proper formatting:
 * - Fix special characters like \n
 * - Add link to PR with changeset (if available)
 * - Add shields.io NPM version badge
 * - Format nicely with proper markdown
 *
 * Usage (named flags – preferred):
 *   node scripts/format-release-notes.mjs \
 *     --release-id <id> \
 *     --release-version <version> \
 *     --repository <owner/repo> \
 *     [--commit-sha <sha>]
 *
 * Legacy positional usage (deprecated):
 *   node scripts/format-release-notes.mjs <releaseId> <version> <repository>
 */

import { execSync } from 'child_process';

// ---------------------------------------------------------------------------
// Argument parsing – support both named flags and legacy positional args
// ---------------------------------------------------------------------------
const rawArgs = process.argv.slice(2);
const getNamedArg = (name) => {
  const idx = rawArgs.indexOf(`--${name}`);
  return idx >= 0 && rawArgs[idx + 1] ? rawArgs[idx + 1] : null;
};

// Named flags take priority; fall back to positional args for compatibility
const releaseId =
  getNamedArg('release-id') ??
  (rawArgs[0] && !rawArgs[0].startsWith('--') ? rawArgs[0] : null);
const version =
  getNamedArg('release-version') ??
  (rawArgs[1] && !rawArgs[1].startsWith('--') ? rawArgs[1] : null);
const repository =
  getNamedArg('repository') ??
  (rawArgs[2] && !rawArgs[2].startsWith('--') ? rawArgs[2] : null);

if (!releaseId || !version || !repository) {
  console.error(
    'Usage: format-release-notes.mjs --release-id <id> --release-version <version> --repository <owner/repo>'
  );
  process.exit(1);
}

const packageName = 'lino-arguments';

try {
  // Get current release body
  const releaseData = JSON.parse(
    execSync(`gh api repos/${repository}/releases/${releaseId}`, {
      encoding: 'utf8',
    })
  );

  const currentBody = releaseData.body || '';

  // Skip if already formatted (has shields.io badge image)
  if (currentBody.includes('img.shields.io')) {
    console.log('ℹ️ Release notes already formatted');
    process.exit(0);
  }

  // Extract the patch changes section
  // This regex captures the commit hash and everything after the colon until we hit double newline or end
  const patchChangesMatch = currentBody.match(
    /### Patch Changes\s*\n\s*-\s+([a-f0-9]+):\s+(.+?)$/s
  );

  if (!patchChangesMatch) {
    console.log('⚠️ Could not parse patch changes from release notes');
    process.exit(0);
  }

  const [, commitHash, rawDescription] = patchChangesMatch;

  // Clean up the description:
  // 1. Remove literal \n sequences (escaped newlines from GitHub API)
  // 2. Remove any trailing npm package links or markdown that might be there
  // 3. Normalize whitespace
  const cleanDescription = rawDescription
    .replace(/\\n/g, ' ') // Remove literal \n characters
    .replace(/📦.*$/s, '') // Remove any existing npm package info
    .replace(/---.*$/s, '') // Remove any existing separators and everything after
    .trim()
    .replace(/\s+/g, ' '); // Normalize all whitespace to single spaces

  // Find the PR that contains this commit
  let prNumber = null;

  try {
    const prsData = JSON.parse(
      execSync(`gh api "repos/${repository}/commits/${commitHash}/pulls"`, {
        encoding: 'utf8',
      })
    );

    // Find the PR that's not the version bump PR (not "chore: version packages")
    const relevantPr = prsData.find(
      (pr) => !pr.title.includes('version packages')
    );

    if (relevantPr) {
      prNumber = relevantPr.number;
    }
  } catch {
    console.log('⚠️ Could not find PR for commit', commitHash);
  }

  // Build formatted release notes
  const versionWithoutV = version.replace(/^v/, '');
  const npmBadge = `[![npm version](https://img.shields.io/badge/npm-${versionWithoutV}-blue.svg)](https://www.npmjs.com/package/${packageName}/v/${versionWithoutV})`;

  let formattedBody = `## What's Changed\n\n${cleanDescription}`;

  // Add PR link if available
  if (prNumber) {
    formattedBody += `\n\n**Related Pull Request:** #${prNumber}`;
  }

  formattedBody += `\n\n---\n\n${npmBadge}\n\n📦 **View on npm:** https://www.npmjs.com/package/${packageName}/v/${versionWithoutV}`;

  // Update the release using JSON input to properly handle special characters
  const updatePayload = JSON.stringify({ body: formattedBody });
  execSync(
    `gh api repos/${repository}/releases/${releaseId} -X PATCH --input -`,
    {
      encoding: 'utf8',
      input: updatePayload,
    }
  );

  console.log(`✅ Formatted release notes for v${versionWithoutV}`);
  if (prNumber) {
    console.log(`   - Added link to PR #${prNumber}`);
  }
  console.log('   - Added shields.io npm badge');
  console.log('   - Cleaned up formatting');
} catch (error) {
  console.error('❌ Error formatting release notes:', error.message);
  process.exit(1);
}
