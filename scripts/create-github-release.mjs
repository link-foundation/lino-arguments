#!/usr/bin/env node

/**
 * Create GitHub Release from CHANGELOG.md
 *
 * Supports both single-language and multi-language repository structures:
 * - Single-language: CHANGELOG.md in repository root
 * - Multi-language: CHANGELOG.md in rust/ subfolder
 *
 * Usage: node scripts/create-github-release.mjs --release-version <version> --repository <repository> [--rust-root <path>]
 *
 * Environment variables:
 *   - VERSION: Version number
 *   - REPOSITORY: GitHub repository (e.g., owner/repo)
 *   - TAG_PREFIX: Tag prefix (default: "v")
 *   - CRATES_IO_URL: Optional crates.io URL to include
 *   - RUST_ROOT: Optional path to Rust package root
 */

import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import {
  getRustRoot,
  getChangelogPath,
  parseRustRootConfig,
} from './rust-paths.mjs';

// Parse CLI arguments
const args = process.argv.slice(2);
const getArg = (name, defaultValue) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : defaultValue;
};

const version = getArg('release-version', process.env.VERSION || '');
const repository = getArg('repository', process.env.REPOSITORY || '');
const tagPrefix = getArg('tag-prefix', process.env.TAG_PREFIX || 'v');
const cratesIoUrl = getArg('crates-io-url', process.env.CRATES_IO_URL || '');

// Get Rust package root (auto-detect or use explicit config)
const rustRootConfig = parseRustRootConfig();
const rustRoot = getRustRoot({ rustRoot: rustRootConfig || undefined, verbose: true });

// Get paths based on detected/configured rust root
const CHANGELOG_FILE = getChangelogPath({ rustRoot });

if (!version || !repository) {
  console.error('Error: Missing required arguments');
  console.error(
    'Usage: node scripts/create-github-release.mjs --release-version <version> --repository <repository>'
  );
  process.exit(1);
}

const tag = `${tagPrefix}${version}`;

console.log(`Creating GitHub release for ${tag}...`);

/**
 * Extract changelog content for a specific version
 * @param {string} version
 * @returns {string}
 */
function getChangelogForVersion(version) {
  if (!existsSync(CHANGELOG_FILE)) {
    return `Release v${version}`;
  }

  const content = readFileSync(CHANGELOG_FILE, 'utf-8');

  // Find the section for this version
  const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `## \\[${escapedVersion}\\].*?\\n([\\s\\S]*?)(?=\\n## \\[|$)`
  );
  const match = content.match(pattern);

  if (match) {
    return match[1].trim();
  }

  return `Release v${version}`;
}

try {
  let releaseNotes = getChangelogForVersion(version);

  // Add crates.io link if provided
  if (cratesIoUrl) {
    releaseNotes = `${cratesIoUrl}\n\n${releaseNotes}`;
  }

  // Create release using GitHub API with JSON input
  // This avoids shell escaping issues
  const payload = JSON.stringify({
    tag_name: tag,
    name: `${tagPrefix}${version}`,
    body: releaseNotes,
  });

  try {
    execSync(`gh api repos/${repository}/releases -X POST --input -`, {
      input: payload,
      encoding: 'utf-8',
      stdio: ['pipe', 'inherit', 'inherit'],
    });
    console.log(`Created GitHub release: ${tag}`);
  } catch (error) {
    // Check if release already exists
    if (error.message && error.message.includes('already exists')) {
      console.log(`Release ${tag} already exists, skipping`);
    } else {
      throw error;
    }
  }
} catch (error) {
  console.error('Error creating release:', error.message);
  process.exit(1);
}
