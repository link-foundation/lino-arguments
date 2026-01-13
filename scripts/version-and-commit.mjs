#!/usr/bin/env node

/**
 * Bump version in Cargo.toml and commit changes
 * Used by the CI/CD pipeline for releases
 *
 * Supports both single-language and multi-language repository structures:
 * - Single-language: Cargo.toml and changelog.d/ in repository root
 * - Multi-language: Cargo.toml and changelog.d/ in rust/ subfolder
 *
 * Usage: node scripts/version-and-commit.mjs --bump-type <major|minor|patch> [--description <desc>] [--rust-root <path>]
 *
 * Environment variables:
 *   - BUMP_TYPE: Version bump type
 *   - DESCRIPTION: Release description
 *   - RUST_ROOT: Optional path to Rust package root
 *
 * Outputs (written to GITHUB_OUTPUT):
 *   - version_committed: 'true' if version was bumped and committed
 *   - already_released: 'true' if version was already released
 *   - new_version: The new version number
 */

import { readFileSync, writeFileSync, appendFileSync, readdirSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';
import {
  getRustRoot,
  getCargoTomlPath,
  getChangelogDir,
  getChangelogPath,
  parseRustRootConfig,
} from './rust-paths.mjs';

// Parse CLI arguments
const args = process.argv.slice(2);
const getArg = (name, defaultValue) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : defaultValue;
};

const bumpType = getArg('bump-type', process.env.BUMP_TYPE || '');
const description = getArg('description', process.env.DESCRIPTION || '');

// Get Rust package root (auto-detect or use explicit config)
const rustRootConfig = parseRustRootConfig();
const rustRoot = getRustRoot({ rustRoot: rustRootConfig || undefined, verbose: true });

// Get paths based on detected/configured rust root
const CARGO_TOML = getCargoTomlPath({ rustRoot });
const CHANGELOG_DIR = getChangelogDir({ rustRoot });
const CHANGELOG_FILE = getChangelogPath({ rustRoot });

if (!bumpType || !['major', 'minor', 'patch'].includes(bumpType)) {
  console.error(
    'Usage: node scripts/version-and-commit.mjs --bump-type <major|minor|patch> [--description <desc>] [--rust-root <path>]'
  );
  process.exit(1);
}

/**
 * Execute a shell command
 * @param {string} command - The command to execute
 * @param {Object} options - Execution options
 * @returns {string} - The command output
 */
function exec(command, options = {}) {
  return execSync(command, { encoding: 'utf-8', ...options });
}

/**
 * Append to GitHub Actions output file
 * @param {string} key
 * @param {string} value
 */
function setOutput(key, value) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    appendFileSync(outputFile, `${key}=${value}\n`);
  }
  // Log for visibility (plain log, not deprecated ::set-output command)
  console.log(`Output: ${key}=${value}`);
}

/**
 * Get current version from Cargo.toml
 * @returns {{major: number, minor: number, patch: number}}
 */
function getCurrentVersion() {
  const cargoToml = readFileSync(CARGO_TOML, 'utf-8');
  const match = cargoToml.match(/^version\s*=\s*"(\d+)\.(\d+)\.(\d+)"/m);

  if (!match) {
    console.error(`Error: Could not parse version from ${CARGO_TOML}`);
    process.exit(1);
  }

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

/**
 * Calculate new version based on bump type
 * @param {{major: number, minor: number, patch: number}} current
 * @param {string} bumpType
 * @returns {string}
 */
function calculateNewVersion(current, bumpType) {
  const { major, minor, patch } = current;

  switch (bumpType) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      throw new Error(`Invalid bump type: ${bumpType}`);
  }
}

/**
 * Update version in Cargo.toml
 * @param {string} newVersion
 */
function updateCargoToml(newVersion) {
  let cargoToml = readFileSync(CARGO_TOML, 'utf-8');
  cargoToml = cargoToml.replace(
    /^(version\s*=\s*")[^"]+(")/m,
    `$1${newVersion}$2`
  );
  writeFileSync(CARGO_TOML, cargoToml, 'utf-8');
  console.log(`Updated ${CARGO_TOML} to version ${newVersion}`);
}

/**
 * Check if a git tag exists for this version
 * @param {string} version
 * @returns {boolean}
 */
function checkTagExists(version) {
  try {
    exec(`git rev-parse v${version}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Strip frontmatter from markdown content
 * @param {string} content - Markdown content potentially with frontmatter
 * @returns {string} - Content without frontmatter
 */
function stripFrontmatter(content) {
  const frontmatterMatch = content.match(/^---\s*\n[\s\S]*?\n---\s*\n([\s\S]*)$/);
  if (frontmatterMatch) {
    return frontmatterMatch[1].trim();
  }
  return content.trim();
}

/**
 * Collect changelog fragments and update CHANGELOG.md
 * @param {string} version
 */
function collectChangelog(version) {
  if (!existsSync(CHANGELOG_DIR)) {
    return;
  }

  const files = readdirSync(CHANGELOG_DIR).filter(
    (f) => f.endsWith('.md') && f !== 'README.md'
  );

  if (files.length === 0) {
    return;
  }

  const fragments = files
    .sort()
    .map((f) => {
      const rawContent = readFileSync(join(CHANGELOG_DIR, f), 'utf-8');
      // Strip frontmatter (which contains bump type metadata)
      return stripFrontmatter(rawContent);
    })
    .filter(Boolean)
    .join('\n\n');

  if (!fragments) {
    return;
  }

  const dateStr = new Date().toISOString().split('T')[0];
  const newEntry = `\n## [${version}] - ${dateStr}\n\n${fragments}\n`;

  if (existsSync(CHANGELOG_FILE)) {
    let content = readFileSync(CHANGELOG_FILE, 'utf-8');
    const lines = content.split('\n');
    let insertIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('## [')) {
        insertIndex = i;
        break;
      }
    }

    if (insertIndex >= 0) {
      lines.splice(insertIndex, 0, newEntry);
      content = lines.join('\n');
    } else {
      content += newEntry;
    }

    writeFileSync(CHANGELOG_FILE, content, 'utf-8');
  }

  console.log(`Collected ${files.length} changelog fragment(s)`);
}

function main() {
  try {
    // Configure git
    exec('git config user.name "github-actions[bot]"');
    exec('git config user.email "github-actions[bot]@users.noreply.github.com"');

    const current = getCurrentVersion();
    const newVersion = calculateNewVersion(current, bumpType);

    // Check if this version was already released
    if (checkTagExists(newVersion)) {
      console.log(`Tag v${newVersion} already exists`);
      setOutput('already_released', 'true');
      setOutput('new_version', newVersion);
      return;
    }

    // Update version in Cargo.toml
    updateCargoToml(newVersion);

    // Collect changelog fragments
    collectChangelog(newVersion);

    // Stage Cargo.toml and CHANGELOG.md
    // Use the paths determined by rust-root configuration
    exec(`git add ${CARGO_TOML}`);
    if (existsSync(CHANGELOG_FILE)) {
      exec(`git add ${CHANGELOG_FILE}`);
    }

    // Check if there are changes to commit
    try {
      exec('git diff --cached --quiet', { stdio: 'ignore' });
      // No changes to commit
      console.log('No changes to commit');
      setOutput('version_committed', 'false');
      setOutput('new_version', newVersion);
      return;
    } catch {
      // There are changes to commit (git diff exits with 1 when there are differences)
    }

    // Commit changes
    const commitMsg = description
      ? `chore: release v${newVersion}\n\n${description}`
      : `chore: release v${newVersion}`;
    exec(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`);
    console.log(`Committed version ${newVersion}`);

    // Create tag
    const tagMsg = description
      ? `Release v${newVersion}\n\n${description}`
      : `Release v${newVersion}`;
    exec(`git tag -a v${newVersion} -m "${tagMsg.replace(/"/g, '\\"')}"`);
    console.log(`Created tag v${newVersion}`);

    // Push changes and tag
    exec('git push');
    exec('git push --tags');
    console.log('Pushed changes and tags');

    setOutput('version_committed', 'true');
    setOutput('new_version', newVersion);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
