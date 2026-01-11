#!/usr/bin/env node

/**
 * Publish package to crates.io
 *
 * This script publishes the Rust package to crates.io and handles
 * the case where the version already exists.
 *
 * Supports both single-language and multi-language repository structures:
 * - Single-language: Cargo.toml in repository root
 * - Multi-language: Cargo.toml in rust/ subfolder
 *
 * Usage: node scripts/publish-crate.mjs [--token <token>] [--rust-root <path>]
 *
 * Environment variables (checked in order of priority):
 *   - CARGO_REGISTRY_TOKEN: Cargo's native crates.io token (preferred)
 *   - CARGO_TOKEN: Alternative token name for backwards compatibility
 *   - RUST_ROOT: Optional path to Rust package root
 *
 * Outputs (written to GITHUB_OUTPUT):
 *   - publish_result: 'success', 'already_exists', or 'failed'
 */

import { readFileSync, appendFileSync } from 'fs';
import { execSync } from 'child_process';
import {
  getRustRoot,
  getCargoTomlPath,
  needsCd,
  parseRustRootConfig,
} from './rust-paths.mjs';

// Parse CLI arguments
const args = process.argv.slice(2);
const getArg = (name, defaultValue) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : defaultValue;
};

// Support both CARGO_REGISTRY_TOKEN (cargo's native env var) and CARGO_TOKEN (backwards compat)
const token = getArg(
  'token',
  process.env.CARGO_REGISTRY_TOKEN || process.env.CARGO_TOKEN || ''
);

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
 * Execute a shell command
 * @param {string} command - The command to execute
 * @param {Object} options - Execution options
 * @returns {string} - The command output
 */
function exec(command, options = {}) {
  return execSync(command, { encoding: 'utf-8', stdio: 'inherit', ...options });
}

/**
 * Get package info from Cargo.toml
 * @returns {{name: string, version: string}}
 */
function getPackageInfo() {
  const cargoToml = readFileSync(CARGO_TOML, 'utf-8');

  const nameMatch = cargoToml.match(/^name\s*=\s*"([^"]+)"/m);
  const versionMatch = cargoToml.match(/^version\s*=\s*"([^"]+)"/m);

  if (!nameMatch || !versionMatch) {
    console.error(`Error: Could not parse package info from ${CARGO_TOML}`);
    process.exit(1);
  }

  return {
    name: nameMatch[1],
    version: versionMatch[1],
  };
}

function main() {
  try {
    const { name, version } = getPackageInfo();
    console.log(`Package: ${name}@${version}`);
    console.log('');
    console.log('=== Attempting to publish to crates.io ===');

    if (!token) {
      console.log(
        '::warning::Neither CARGO_REGISTRY_TOKEN nor CARGO_TOKEN is set, attempting publish without explicit token'
      );
    }

    try {
      // Build the cargo publish command
      let command = 'cargo publish --allow-dirty';
      if (token) {
        command += ` --token ${token}`;
      }

      // For multi-language repos, we need to cd into the rust directory
      if (needsCd({ rustRoot })) {
        command = `cd ${rustRoot} && ${command}`;
      }

      exec(command);

      console.log(`Successfully published ${name}@${version} to crates.io`);
      setOutput('publish_result', 'success');
    } catch (error) {
      const errorMessage = error.message || '';

      if (
        errorMessage.includes('already uploaded') ||
        errorMessage.includes('already exists')
      ) {
        console.log(
          `Version ${version} already exists on crates.io - this is OK`
        );
        setOutput('publish_result', 'already_exists');
      } else {
        console.error('Failed to publish for unknown reason');
        console.error(errorMessage);
        setOutput('publish_result', 'failed');
        process.exit(1);
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
