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
 *   - CARGO_REGISTRY_TOKEN: Cargo's native crates.io token (preferred). In CI
 *     this is the short-lived trusted publishing (OIDC) token from
 *     rust-lang/crates-io-auth-action, or the token secret as a fallback.
 *   - CARGO_TOKEN: Alternative token name for backwards compatibility
 *   - CRATES_AUTH_OUTCOME: Optional outcome of the crates-io-auth-action step
 *     ('success', 'failure', ...), used to report which credential is used
 *   - RUST_ROOT: Optional path to Rust package root
 *
 * The token is handed to cargo through its CARGO_REGISTRY_TOKEN environment
 * variable, never on the command line, so it cannot appear in process lists
 * or in the "Command failed" message of a failed publish.
 *
 * Outputs (written to GITHUB_OUTPUT):
 *   - publish_result: 'success', 'already_exists', or 'failed'
 */

import { readFileSync, appendFileSync } from 'fs';
import { execSync, execFileSync } from 'child_process';
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
 * Run `cargo publish` in the Rust package root, capturing output.
 * The token (if any) is passed only through the child's environment.
 * @returns {string} - The command output
 */
function cargoPublish() {
  const env = { ...process.env };
  if (token) {
    env.CARGO_REGISTRY_TOKEN = token;
  } else {
    // An empty CARGO_REGISTRY_TOKEN would shadow cargo's own credentials
    delete env.CARGO_REGISTRY_TOKEN;
  }
  return execFileSync('cargo', ['publish', '--allow-dirty'], {
    cwd: rustRoot,
    env,
    encoding: 'utf-8',
    stdio: 'pipe',
  });
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

/**
 * Report whether trusted publishing (OIDC) or the token secret fallback is used
 */
function reportCredentialSource() {
  const outcome = process.env.CRATES_AUTH_OUTCOME;
  if (!outcome) {
    return;
  }
  if (outcome === 'success') {
    console.log('Using the crates.io trusted publishing (OIDC) token');
    return;
  }
  const repository = process.env.GITHUB_REPOSITORY || '<owner>/<repo>';
  console.log(
    `::warning::crates.io trusted publishing is unavailable (auth step outcome: ${outcome}), falling back to the CARGO_REGISTRY_TOKEN / CARGO_TOKEN secret. ` +
      `To publish without the token, add a trusted publisher on crates.io (crate Settings > Trusted Publishing) for repository ${repository} and workflow rust.yml.`
  );
}

function main() {
  try {
    const { name, version } = getPackageInfo();
    console.log(`Package: ${name}@${version}`);
    console.log('');
    console.log('=== Attempting to publish to crates.io ===');

    reportCredentialSource();

    if (!token) {
      console.log(
        '::warning::No crates.io token: trusted publishing did not provide one and neither CARGO_REGISTRY_TOKEN nor CARGO_TOKEN is set, attempting publish without explicit token'
      );
    }

    // First, check if this version is already published on crates.io
    try {
      const cratesIoResponse = execSync(
        `curl -s https://crates.io/api/v1/crates/${name}/${version}`,
        { encoding: 'utf-8' }
      );
      const cratesIoData = JSON.parse(cratesIoResponse);
      if (cratesIoData.version && cratesIoData.version.num === version) {
        console.log(
          `Version ${version} already exists on crates.io - skipping publish`
        );
        setOutput('publish_result', 'already_exists');
        return;
      }
    } catch {
      // Version not found on crates.io or API error - proceed with publish
      console.log('Version not found on crates.io, proceeding with publish...');
    }

    try {
      const output = cargoPublish();
      console.log(output);

      console.log(`Successfully published ${name}@${version} to crates.io`);
      setOutput('publish_result', 'success');
    } catch (error) {
      // With stdio: 'pipe', the error output is captured in stderr/stdout
      const errorOutput = (error.stderr || '') + (error.stdout || '') + (error.message || '');

      if (
        errorOutput.includes('already uploaded') ||
        errorOutput.includes('already exists')
      ) {
        console.log(
          `Version ${version} already exists on crates.io - this is OK`
        );
        setOutput('publish_result', 'already_exists');
      } else {
        console.error('Failed to publish to crates.io');
        console.error(errorOutput);
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
