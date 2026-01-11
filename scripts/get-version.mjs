#!/usr/bin/env node

/**
 * Get the current version from Cargo.toml
 *
 * This script reads the version from Cargo.toml and outputs it
 * for use in GitHub Actions.
 *
 * Supports both single-language and multi-language repository structures:
 * - Single-language: Cargo.toml in repository root
 * - Multi-language: Cargo.toml in rust/ subfolder
 *
 * Usage: node scripts/get-version.mjs [--rust-root <path>]
 *
 * Environment variables:
 *   - RUST_ROOT: Optional path to Rust package root
 *
 * Outputs (written to GITHUB_OUTPUT):
 *   - version: The current version from Cargo.toml
 */

import { readFileSync, appendFileSync } from 'fs';
import {
  getRustRoot,
  getCargoTomlPath,
  parseRustRootConfig,
} from './rust-paths.mjs';

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

try {
  const version = getCurrentVersion();
  console.log(`Current version: ${version}`);
  setOutput('version', version);
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
