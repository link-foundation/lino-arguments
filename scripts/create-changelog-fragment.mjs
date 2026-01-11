#!/usr/bin/env node

/**
 * Create a changelog fragment for manual release PR
 *
 * This script creates a changelog fragment with the appropriate
 * category based on the bump type.
 *
 * Supports both single-language and multi-language repository structures:
 * - Single-language: changelog.d/ in repository root
 * - Multi-language: changelog.d/ in rust/ subfolder
 *
 * Usage: node scripts/create-changelog-fragment.mjs --bump-type <type> [--description <desc>] [--rust-root <path>]
 *
 * Environment variables:
 *   - BUMP_TYPE: Version bump type (patch, minor, major)
 *   - DESCRIPTION: Release description
 *   - RUST_ROOT: Optional path to Rust package root
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import {
  getRustRoot,
  getChangelogDir,
  parseRustRootConfig,
} from './rust-paths.mjs';

// Parse CLI arguments
const args = process.argv.slice(2);
const getArg = (name, defaultValue) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : defaultValue;
};

const bumpType = getArg('bump-type', process.env.BUMP_TYPE || 'patch');
const description = getArg('description', process.env.DESCRIPTION || '');

// Get Rust package root (auto-detect or use explicit config)
const rustRootConfig = parseRustRootConfig();
const rustRoot = getRustRoot({ rustRoot: rustRootConfig || undefined, verbose: true });

// Get paths based on detected/configured rust root
const CHANGELOG_DIR = getChangelogDir({ rustRoot });

/**
 * Get the changelog category based on bump type
 * @param {string} bumpType
 * @returns {string}
 */
function getCategory(bumpType) {
  switch (bumpType) {
    case 'major':
      return '### Breaking Changes';
    case 'minor':
      return '### Added';
    case 'patch':
      return '### Fixed';
    default:
      return '### Changed';
  }
}

/**
 * Generate a timestamp-based filename
 * @returns {string}
 */
function generateTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

try {
  const timestamp = generateTimestamp();
  const fragmentFile = join(CHANGELOG_DIR, `${timestamp}-manual-${bumpType}.md`);

  // Determine changelog category based on bump type
  const category = getCategory(bumpType);

  // Create changelog fragment with frontmatter
  const descriptionText = description || `Manual ${bumpType} release`;
  const fragmentContent = `---
bump: ${bumpType}
---

${category}

- ${descriptionText}
`;

  // Ensure changelog.d directory exists
  if (!existsSync(CHANGELOG_DIR)) {
    mkdirSync(CHANGELOG_DIR, { recursive: true });
  }

  // Write the fragment file
  writeFileSync(fragmentFile, fragmentContent, 'utf-8');

  console.log(`Created changelog fragment: ${fragmentFile}`);
  console.log('');
  console.log('Content:');
  console.log(fragmentContent);
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
