#!/usr/bin/env node

/**
 * Format Rust GitHub release notes with shields.io badges.
 *
 * Adds to the release body:
 *   - crates.io version badge
 *   - docs.rs badge
 *
 * Usage:
 *   node scripts/format-rust-release.mjs \
 *     --release-version <version> \
 *     --repository <owner/repo> \
 *     [--crate-name <name>]
 *
 * Environment variables:
 *   VERSION      – fallback for --release-version
 *   REPOSITORY   – fallback for --repository
 *   CRATE_NAME   – fallback for --crate-name
 */

import { execSync } from 'child_process';

// ---------------------------------------------------------------------------
// Argument parsing (named flags)
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const getArg = (name, defaultValue = '') => {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : defaultValue;
};

const version = getArg('release-version', process.env.VERSION || '');
const repository = getArg('repository', process.env.REPOSITORY || '');
// Default crate name derived from repo name (last segment)
const defaultCrateName = repository.split('/').pop() || '';
const crateName = getArg('crate-name', process.env.CRATE_NAME || defaultCrateName);

if (!version || !repository) {
  console.error('Error: Missing required arguments');
  console.error(
    'Usage: node scripts/format-rust-release.mjs --release-version <version> --repository <owner/repo>'
  );
  process.exit(1);
}

const versionWithoutV = version.replace(/^v/, '');
const tag = `v${versionWithoutV}`;

// ---------------------------------------------------------------------------
// Shields.io badges for Rust
// ---------------------------------------------------------------------------
const cratesIoBadge = `[![crates.io](https://img.shields.io/crates/v/${crateName}.svg)](https://crates.io/crates/${crateName})`;
const docsRsBadge = `[![docs.rs](https://img.shields.io/docsrs/${crateName})](https://docs.rs/${crateName})`;
const badgeLine = `${cratesIoBadge} ${docsRsBadge}`;
const packageLinks =
  `📦 **View on crates.io:** https://crates.io/crates/${crateName}/${versionWithoutV}\n` +
  `📖 **API docs:** https://docs.rs/${crateName}/${versionWithoutV}`;

// ---------------------------------------------------------------------------
// Fetch and update the release
// ---------------------------------------------------------------------------
try {
  // Look up the release by tag
  let releaseData;
  try {
    releaseData = JSON.parse(
      execSync(`gh api repos/${repository}/releases/tags/${tag}`, {
        encoding: 'utf8',
      })
    );
  } catch {
    console.log(`⚠️  Could not find release for ${tag}`);
    process.exit(0);
  }

  const { id: releaseId, body: currentBody = '' } = releaseData;

  // Skip if already formatted
  if (currentBody.includes('img.shields.io')) {
    console.log('ℹ️  Release notes already contain badges – skipping');
    process.exit(0);
  }

  const formattedBody =
    `${currentBody.trimEnd()}\n\n---\n\n${badgeLine}\n\n${packageLinks}`;

  const updatePayload = JSON.stringify({ body: formattedBody });
  execSync(
    `gh api repos/${repository}/releases/${releaseId} -X PATCH --input -`,
    { encoding: 'utf8', input: updatePayload }
  );

  console.log(`✅ Formatted Rust release notes for ${tag}`);
  console.log('   - Added crates.io version badge');
  console.log('   - Added docs.rs badge');
} catch (error) {
  console.error('❌ Error formatting Rust release notes:', error.message);
  process.exit(1);
}
