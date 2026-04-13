#!/usr/bin/env node

/**
 * Bump version in Cargo.toml or package.json and commit changes
 * Used by the CI/CD pipeline for releases
 *
 * IMPORTANT: This script checks the package registry (npm/crates.io) as the
 * source of truth for published versions, NOT git tags. This is critical because:
 * - Git tags can exist without the package being published
 * - GitHub releases create tags but don't publish to registries
 * - Only registry publication means users can actually install the package
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
const tagPrefix = getArg('tag-prefix', process.env.TAG_PREFIX || 'v');
const releaseLabel = getArg('release-label', process.env.RELEASE_LABEL || '');
const mode = getArg('mode', process.env.VERSION_MODE || 'rust');

// Get Rust package root (auto-detect or use explicit config)
const rustRootConfig = parseRustRootConfig();
const rustRoot = getRustRoot({ rustRoot: rustRootConfig || undefined, verbose: true });

// Get paths based on detected/configured rust root
const CARGO_TOML = getCargoTomlPath({ rustRoot });
const CHANGELOG_DIR = getChangelogDir({ rustRoot });
const CHANGELOG_FILE = getChangelogPath({ rustRoot });

// In changeset mode, bump type is determined by changesets, not required as input
if (mode !== 'changeset' && mode !== 'instant' && (!bumpType || !['major', 'minor', 'patch'].includes(bumpType))) {
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
    exec(`git rev-parse ${tagPrefix}${version}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get crate name from Cargo.toml
 * @returns {string}
 */
function getCrateName() {
  const cargoToml = readFileSync(CARGO_TOML, 'utf-8');
  const match = cargoToml.match(/^name\s*=\s*"([^"]+)"/m);
  if (!match) {
    console.error(`Error: Could not parse crate name from ${CARGO_TOML}`);
    process.exit(1);
  }
  return match[1];
}

/**
 * Check if a version exists on crates.io
 * @param {string} crateName
 * @param {string} version
 * @returns {boolean}
 */
function checkVersionOnCratesIo(crateName, version) {
  try {
    const response = exec(
      `curl -s -o /dev/null -w "%{http_code}" -H "User-Agent: version-and-commit-mjs" https://crates.io/api/v1/crates/${crateName}/${version}`
    ).trim();
    return response === '200';
  } catch {
    return false;
  }
}

/**
 * Get the maximum published version from crates.io
 * @param {string} crateName
 * @returns {{major: number, minor: number, patch: number}|null}
 */
function getMaxPublishedCratesIoVersion(crateName) {
  try {
    const response = exec(
      `curl -s -H "User-Agent: version-and-commit-mjs" https://crates.io/api/v1/crates/${crateName}`
    );
    const data = JSON.parse(response);
    if (!data.versions || !Array.isArray(data.versions)) return null;

    let max = null;
    for (const v of data.versions) {
      if (v.yanked) continue;
      const base = v.num.split('-')[0];
      const parts = base.split('.');
      if (parts.length !== 3) continue;
      const [major, minor, patch] = parts.map(Number);
      if (isNaN(major) || isNaN(minor) || isNaN(patch)) continue;
      if (!max || major > max.major || (major === max.major && minor > max.minor) || (major === max.major && minor === max.minor && patch > max.patch)) {
        max = { major, minor, patch };
      }
    }
    return max;
  } catch {
    return null;
  }
}

/**
 * Check if a version exists on npm registry
 * @param {string} packageName
 * @param {string} version
 * @returns {boolean}
 */
function checkVersionOnNpm(packageName, version) {
  try {
    exec(`npm view "${packageName}@${version}" version`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the maximum published version from npm
 * @param {string} packageName
 * @returns {{major: number, minor: number, patch: number}|null}
 */
function getMaxPublishedNpmVersion(packageName) {
  try {
    const response = exec(`npm view "${packageName}" versions --json`).trim();
    const versions = JSON.parse(response);
    if (!Array.isArray(versions) || versions.length === 0) return null;

    let max = null;
    for (const v of versions) {
      const base = v.split('-')[0];
      const parts = base.split('.');
      if (parts.length !== 3) continue;
      const [major, minor, patch] = parts.map(Number);
      if (isNaN(major) || isNaN(minor) || isNaN(patch)) continue;
      if (!max || major > max.major || (major === max.major && minor > max.minor) || (major === max.major && minor === max.minor && patch > max.patch)) {
        max = { major, minor, patch };
      }
    }
    return max;
  } catch {
    return null;
  }
}

/**
 * Ensure the version exceeds the maximum published version on a registry.
 * If the proposed version is <= the max published version, bumps the patch
 * to be one above. Also skips versions where a git tag or registry entry already exists.
 * @param {string} versionStr - The proposed version
 * @param {string} registryType - 'crates.io' or 'npm'
 * @param {string} packageName - The crate or npm package name
 * @param {{major: number, minor: number, patch: number}|null} maxPublished
 * @returns {string} The final version to use
 */
function ensureVersionExceedsPublished(versionStr, registryType, packageName, maxPublished) {
  const parts = versionStr.split('-')[0].split('.');
  if (parts.length !== 3) return versionStr;

  let [major, minor, patch] = parts.map(Number);

  if (maxPublished) {
    const { major: pubMajor, minor: pubMinor, patch: pubPatch } = maxPublished;
    if (major < pubMajor || (major === pubMajor && minor < pubMinor) || (major === pubMajor && minor === pubMinor && patch <= pubPatch)) {
      console.log(
        `Version ${major}.${minor}.${patch} is not greater than max published ${pubMajor}.${pubMinor}.${pubPatch}, adjusting to ${pubMajor}.${pubMinor}.${pubPatch + 1}`
      );
      major = pubMajor;
      minor = pubMinor;
      patch = pubPatch + 1;
    }
  }

  let candidate = `${major}.${minor}.${patch}`;
  const checkRegistry = registryType === 'crates.io'
    ? (v) => checkVersionOnCratesIo(packageName, v)
    : (v) => checkVersionOnNpm(packageName, v);

  let safetyCounter = 0;
  while ((checkTagExists(candidate) || checkRegistry(candidate)) && safetyCounter < 100) {
    console.log(`Version ${candidate} already has a git tag or is published on ${registryType}, bumping patch`);
    patch += 1;
    candidate = `${major}.${minor}.${patch}`;
    safetyCounter += 1;
  }

  if (safetyCounter >= 100) {
    console.error('Error: Could not find an unpublished version after 100 attempts');
    process.exit(1);
  }

  return candidate;
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

/**
 * Get version from package.json (for changeset mode)
 * @returns {string}
 */
function getPackageJsonVersion() {
  const pkgPath = existsSync('package.json') ? 'package.json' : 'js/package.json';
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  return pkg.version;
}

/**
 * Run changeset-based version bump and commit (JavaScript mode)
 */
function mainChangeset() {
  try {
    // Configure git
    exec('git config user.name "github-actions[bot]"');
    exec('git config user.email "github-actions[bot]@users.noreply.github.com"');

    // Run changeset version to apply version bumps
    const cwd = existsSync('package.json') ? '.' : 'js';
    exec(`npm run changeset:version`, { cwd, stdio: 'inherit' });

    // Get the new version after changeset version and the package name
    const pkgPath = existsSync('package.json') ? 'package.json' : 'js/package.json';
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    const packageName = pkg.name;
    let newVersion = pkg.version;

    const maxPublished = getMaxPublishedNpmVersion(packageName);
    if (maxPublished) {
      console.log(`Max published version on npm: ${maxPublished.major}.${maxPublished.minor}.${maxPublished.patch}`);
    } else {
      console.log('No versions published on npm yet (or package not found)');
    }

    console.log(`Changeset version: ${newVersion}`);

    const adjustedVersion = ensureVersionExceedsPublished(newVersion, 'npm', packageName, maxPublished);

    if (adjustedVersion !== newVersion) {
      console.log(`Adjusted version from ${newVersion} to ${adjustedVersion} to exceed published versions`);
      newVersion = adjustedVersion;
      // Update package.json with the adjusted version
      pkg.version = newVersion;
      writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
      console.log(`Updated ${pkgPath} to version ${newVersion}`);
    }

    console.log(`Final release version: ${newVersion}`);

    // Stage all changes made by changeset version
    exec('git add -A');

    // Check if there are changes to commit
    try {
      exec('git diff --cached --quiet', { stdio: 'ignore' });
      console.log('No changes to commit');
      setOutput('version_committed', 'false');
      setOutput('new_version', newVersion);
      return;
    } catch {
      // There are changes to commit
    }

    // Commit changes
    const labelStr = releaseLabel ? `(${releaseLabel}) ` : '';
    const commitMsg = `chore: release ${labelStr}${tagPrefix}${newVersion}`;
    exec(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`);
    console.log(`Committed version ${newVersion}`);

    // Create tag with language-specific prefix
    const tagName = `${tagPrefix}${newVersion}`;
    const displayName = releaseLabel ? `[${releaseLabel}] ${newVersion}` : `${tagPrefix}${newVersion}`;
    const tagMsg = `Release ${displayName}`;
    exec(`git tag -a ${tagName} -m "${tagMsg.replace(/"/g, '\\"')}"`);
    console.log(`Created tag ${tagName}`);

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

/**
 * Run Cargo.toml-based version bump and commit (Rust mode)
 */
function mainRust() {
  try {
    // Configure git
    exec('git config user.name "github-actions[bot]"');
    exec('git config user.email "github-actions[bot]@users.noreply.github.com"');

    const current = getCurrentVersion();
    const initialBump = calculateNewVersion(current, bumpType);
    const crateName = getCrateName();

    const maxPublished = getMaxPublishedCratesIoVersion(crateName);
    if (maxPublished) {
      console.log(`Max published version on crates.io: ${maxPublished.major}.${maxPublished.minor}.${maxPublished.patch}`);
    } else {
      console.log('No versions published on crates.io yet (or crate not found)');
    }

    console.log(`Initial bump (${bumpType}) from ${current.major}.${current.minor}.${current.patch}: ${initialBump}`);

    const newVersion = ensureVersionExceedsPublished(initialBump, 'crates.io', crateName, maxPublished);

    if (newVersion !== initialBump) {
      console.log(`Adjusted version from ${initialBump} to ${newVersion} to exceed published versions`);
    }

    console.log(`Final release version: ${newVersion}`);

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
    const labelStr = releaseLabel ? `(${releaseLabel}) ` : '';
    const commitMsg = description
      ? `chore: release ${labelStr}${tagPrefix}${newVersion}\n\n${description}`
      : `chore: release ${labelStr}${tagPrefix}${newVersion}`;
    exec(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`);
    console.log(`Committed version ${newVersion}`);

    // Create tag with language-specific prefix
    const tagName = `${tagPrefix}${newVersion}`;
    const displayName = releaseLabel ? `[${releaseLabel}] ${newVersion}` : `${tagPrefix}${newVersion}`;
    const tagMsg = description
      ? `Release ${displayName}\n\n${description}`
      : `Release ${displayName}`;
    exec(`git tag -a ${tagName} -m "${tagMsg.replace(/"/g, '\\"')}"`);
    console.log(`Created tag ${tagName}`);

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

/**
 * Run instant JS version bump (npm version) and commit
 */
function mainInstantJs() {
  try {
    // Configure git
    exec('git config user.name "github-actions[bot]"');
    exec('git config user.email "github-actions[bot]@users.noreply.github.com"');

    if (!bumpType || !['major', 'minor', 'patch'].includes(bumpType)) {
      console.error('Error: --bump-type is required for instant mode');
      process.exit(1);
    }

    // Bump package.json version using npm version (no git tag, we handle tagging ourselves)
    const cwd = existsSync('package.json') ? '.' : 'js';
    exec(`npm version ${bumpType} --no-git-tag-version`, { cwd, stdio: 'inherit' });

    const pkgPath = existsSync('package.json') ? 'package.json' : 'js/package.json';
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    const packageName = pkg.name;
    let newVersion = pkg.version;

    const maxPublished = getMaxPublishedNpmVersion(packageName);
    if (maxPublished) {
      console.log(`Max published version on npm: ${maxPublished.major}.${maxPublished.minor}.${maxPublished.patch}`);
    } else {
      console.log('No versions published on npm yet (or package not found)');
    }

    console.log(`Initial bump (${bumpType}): ${newVersion}`);

    const adjustedVersion = ensureVersionExceedsPublished(newVersion, 'npm', packageName, maxPublished);

    if (adjustedVersion !== newVersion) {
      console.log(`Adjusted version from ${newVersion} to ${adjustedVersion} to exceed published versions`);
      newVersion = adjustedVersion;
      pkg.version = newVersion;
      writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
      console.log(`Updated ${pkgPath} to version ${newVersion}`);
    }

    console.log(`Final release version: ${newVersion}`);

    // Stage changes
    exec('git add -A');

    // Check if there are changes to commit
    try {
      exec('git diff --cached --quiet', { stdio: 'ignore' });
      console.log('No changes to commit');
      setOutput('version_committed', 'false');
      setOutput('new_version', newVersion);
      return;
    } catch {
      // There are changes to commit
    }

    // Commit changes
    const labelStr = releaseLabel ? `(${releaseLabel}) ` : '';
    const commitMsg = description
      ? `chore: release ${labelStr}${tagPrefix}${newVersion}\n\n${description}`
      : `chore: release ${labelStr}${tagPrefix}${newVersion}`;
    exec(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`);
    console.log(`Committed version ${newVersion}`);

    // Create tag
    const tagName = `${tagPrefix}${newVersion}`;
    const displayName = releaseLabel ? `[${releaseLabel}] ${newVersion}` : `${tagPrefix}${newVersion}`;
    const tagMsg = description
      ? `Release ${displayName}\n\n${description}`
      : `Release ${displayName}`;
    exec(`git tag -a ${tagName} -m "${tagMsg.replace(/"/g, '\\"')}"`);
    console.log(`Created tag ${tagName}`);

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

if (mode === 'changeset') {
  mainChangeset();
} else if (mode === 'instant') {
  mainInstantJs();
} else {
  mainRust();
}
