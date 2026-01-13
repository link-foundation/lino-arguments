#!/usr/bin/env node

/**
 * Check if a release is needed based on changelog fragments and version state
 *
 * This script checks:
 * 1. If there are changelog fragments to process
 * 2. If the current version has already been released (tagged)
 *
 * Supports both single-language and multi-language repository structures:
 * - Single-language: Cargo.toml in repository root
 * - Multi-language: Cargo.toml in rust/ subfolder
 *
 * Usage: node scripts/check-release-needed.mjs [--rust-root <path>]
 *
 * Environment variables:
 *   - HAS_FRAGMENTS: 'true' if changelog fragments exist (from get-bump-type.mjs)
 *   - RUST_ROOT: Optional path to Rust package root
 *
 * Outputs (written to GITHUB_OUTPUT):
 *   - should_release: 'true' if a release should be created
 *   - skip_bump: 'true' if version bump should be skipped (version not yet released)
 */

import { readFileSync, appendFileSync } from 'fs';
import { execSync } from 'child_process';
import {
  getRustRoot,
  getCargoTomlPath,
  parseRustRootConfig,
} from './rust-paths.mjs';

// Parse CLI arguments
const args = process.argv.slice(2);
const getArg = (name, defaultValue) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : defaultValue;
};

const hasFragments = getArg('has-fragments', process.env.HAS_FRAGMENTS || 'false');

// Get Rust package root (auto-detect or use explicit config)
const rustRootConfig = parseRustRootConfig();
const rustRoot = getRustRoot({ rustRoot: rustRootConfig || undefined, verbose: true });

// Get paths based on detected/configured rust root
const CARGO_TOML = getCargoTomlPath({ rustRoot });

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
  console.log(`Output: ${key}=${value}`);
}

/**
 * Get current version from Cargo.toml
 * @returns {string}
 */
function getCurrentVersion() {
  const cargoToml = readFileSync(CARGO_TOML, 'utf-8');
  const match = cargoToml.match(/^version\s*=\s*"([^"]+)"/m);

  if (!match) {
    console.error(`Error: Could not find version in ${CARGO_TOML}`);
    process.exit(1);
  }

  return match[1];
}

/**
 * Check if a git tag exists for this version
 * @param {string} version
 * @returns {boolean}
 */
function checkTagExists(version) {
  try {
    execSync(`git rev-parse v${version}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function main() {
  try {
    const fragmentsExist = hasFragments === 'true';

    if (!fragmentsExist) {
      // No fragments - check if current version tag exists
      const currentVersion = getCurrentVersion();
      const tagExists = checkTagExists(currentVersion);

      if (tagExists) {
        console.log(
          `No changelog fragments and v${currentVersion} already released`
        );
        setOutput('should_release', 'false');
      } else {
        console.log(
          `No changelog fragments but v${currentVersion} not yet released`
        );
        setOutput('should_release', 'true');
        setOutput('skip_bump', 'true');
      }
    } else {
      console.log('Found changelog fragments, proceeding with release');
      setOutput('should_release', 'true');
      setOutput('skip_bump', 'false');
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
