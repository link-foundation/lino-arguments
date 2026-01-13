#!/usr/bin/env node

/**
 * Detect code changes for CI/CD pipeline
 *
 * This script detects what types of files have changed between two commits
 * and outputs the results for use in GitHub Actions workflow conditions.
 *
 * Key behavior:
 * - For PRs: compares PR head against base branch
 * - For pushes: compares HEAD against HEAD^
 * - Excludes certain folders and file types from "code changes" detection
 *
 * Multi-language repository support:
 * - Detects Rust-specific changes (rust/ folder and .rs files)
 * - Detects JS-specific changes (js/ folder and JS-related files)
 * - Scripts folder is shared between languages (scripts/)
 *
 * Excluded from code changes (don't require changelog fragments):
 * - Markdown files (*.md) in any folder
 * - changelog.d/ folder (changelog fragments)
 * - .changeset/ folder (JS changesets)
 * - docs/ folder (documentation)
 * - experiments/ folder (experimental scripts)
 * - examples/ folder (example scripts)
 *
 * Usage:
 *   node scripts/detect-code-changes.mjs
 *
 * Environment variables (set by GitHub Actions):
 *   - GITHUB_EVENT_NAME: 'pull_request' or 'push'
 *   - GITHUB_BASE_SHA: Base commit SHA for PR
 *   - GITHUB_HEAD_SHA: Head commit SHA for PR
 *
 * Outputs (written to GITHUB_OUTPUT):
 *   - rs-changed: 'true' if any .rs files changed (in rust/ folder)
 *   - toml-changed: 'true' if any .toml files changed (in rust/ folder)
 *   - js-changed: 'true' if any JS files changed (in js/ folder)
 *   - package-changed: 'true' if package.json changed (in js/ folder)
 *   - mjs-changed: 'true' if any .mjs files changed (shared scripts)
 *   - docs-changed: 'true' if any .md files changed
 *   - workflow-changed: 'true' if any .github/workflows/ files changed
 *   - rust-workflow-changed: 'true' if rust.yml workflow changed
 *   - js-workflow-changed: 'true' if js.yml workflow changed
 *   - any-code-changed: 'true' if any code files changed (excludes docs, changelog.d, experiments, examples)
 *   - rust-code-changed: 'true' if any Rust-related code changed
 *   - js-code-changed: 'true' if any JS-related code changed
 */

import { execSync } from 'child_process';
import { appendFileSync } from 'fs';

/**
 * Execute a shell command and return trimmed output
 * @param {string} command - The command to execute
 * @returns {string} - The trimmed command output
 */
function exec(command) {
  try {
    return execSync(command, { encoding: 'utf-8' }).trim();
  } catch (error) {
    console.error(`Error executing command: ${command}`);
    console.error(error.message);
    return '';
  }
}

/**
 * Write output to GitHub Actions output file
 * @param {string} name - Output name
 * @param {string} value - Output value
 */
function setOutput(name, value) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    appendFileSync(outputFile, `${name}=${value}\n`);
  }
  console.log(`${name}=${value}`);
}

/**
 * Get the list of changed files between two commits
 * @returns {string[]} Array of changed file paths
 */
function getChangedFiles() {
  const eventName = process.env.GITHUB_EVENT_NAME || 'local';

  if (eventName === 'pull_request') {
    const baseSha = process.env.GITHUB_BASE_SHA;
    const headSha = process.env.GITHUB_HEAD_SHA;

    if (baseSha && headSha) {
      console.log(`Comparing PR: ${baseSha}...${headSha}`);
      try {
        // Ensure we have the base commit
        try {
          execSync(`git cat-file -e ${baseSha}`, { stdio: 'ignore' });
        } catch {
          console.log('Base commit not available locally, attempting fetch...');
          execSync(`git fetch origin ${baseSha}`, { stdio: 'inherit' });
        }
        const output = exec(`git diff --name-only ${baseSha} ${headSha}`);
        return output ? output.split('\n').filter(Boolean) : [];
      } catch (error) {
        console.error(`Git diff failed: ${error.message}`);
      }
    }
  }

  // For push events or fallback
  console.log('Comparing HEAD^ to HEAD');
  try {
    const output = exec('git diff --name-only HEAD^ HEAD');
    return output ? output.split('\n').filter(Boolean) : [];
  } catch {
    // If HEAD^ doesn't exist (first commit), list all files in HEAD
    console.log('HEAD^ not available, listing all files in HEAD');
    const output = exec('git ls-tree --name-only -r HEAD');
    return output ? output.split('\n').filter(Boolean) : [];
  }
}

/**
 * Check if a file should be excluded from code changes detection
 * @param {string} filePath - The file path to check
 * @returns {boolean} True if the file should be excluded
 */
function isExcludedFromCodeChanges(filePath) {
  // Exclude markdown files in any folder
  if (filePath.endsWith('.md')) {
    return true;
  }

  // Exclude specific folders from code changes
  // Note: Support both root-level and language-specific subdirectory paths
  const excludedFolders = [
    'changelog.d/',
    'rust/changelog.d/',
    '.changeset/',
    'js/.changeset/',
    'docs/',
    'experiments/',
    'examples/',
  ];

  for (const folder of excludedFolders) {
    if (filePath.startsWith(folder)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a file is Rust-related (for triggering Rust CI/CD)
 * @param {string} filePath - The file path to check
 * @returns {boolean} True if the file is Rust-related
 */
function isRustRelated(filePath) {
  // Files in rust/ folder
  if (filePath.startsWith('rust/')) {
    return true;
  }
  // .rs files anywhere
  if (filePath.endsWith('.rs')) {
    return true;
  }
  // Rust workflow
  if (filePath === '.github/workflows/rust.yml') {
    return true;
  }
  return false;
}

/**
 * Check if a file is JS-related (for triggering JS CI/CD)
 * @param {string} filePath - The file path to check
 * @returns {boolean} True if the file is JS-related
 */
function isJsRelated(filePath) {
  // Files in js/ folder
  if (filePath.startsWith('js/')) {
    return true;
  }
  // JS workflow
  if (filePath === '.github/workflows/js.yml') {
    return true;
  }
  return false;
}

/**
 * Check if a file is part of Rust package code (requires changelog fragment)
 * @param {string} filePath - The file path to check
 * @returns {boolean} True if the file is part of Rust package code
 */
function isRustPackageCode(filePath) {
  // Only files in rust/ folder that are not docs/changelog
  if (filePath.startsWith('rust/')) {
    // Exclude changelog fragments and docs
    if (filePath.startsWith('rust/changelog.d/')) {
      return false;
    }
    return true;
  }
  return false;
}

/**
 * Check if a file is part of JS package code (requires changeset)
 * @param {string} filePath - The file path to check
 * @returns {boolean} True if the file is part of JS package code
 */
function isJsPackageCode(filePath) {
  // Only files in js/ folder that are not docs/changeset
  if (filePath.startsWith('js/')) {
    // Exclude changeset files
    if (filePath.startsWith('js/.changeset/')) {
      return false;
    }
    return true;
  }
  return false;
}

/**
 * Main function to detect changes
 */
function detectChanges() {
  console.log('Detecting file changes for CI/CD...\n');

  const changedFiles = getChangedFiles();

  console.log('Changed files:');
  if (changedFiles.length === 0) {
    console.log('  (none)');
  } else {
    changedFiles.forEach((file) => console.log(`  ${file}`));
  }
  console.log('');

  // Detect .rs file changes (Rust source in rust/ folder)
  const rsChanged = changedFiles.some(
    (file) => file.endsWith('.rs') && file.startsWith('rust/')
  );
  setOutput('rs-changed', rsChanged ? 'true' : 'false');

  // Detect .toml file changes (Cargo.toml, etc. in rust/ folder)
  const tomlChanged = changedFiles.some(
    (file) => file.endsWith('.toml') && file.startsWith('rust/')
  );
  setOutput('toml-changed', tomlChanged ? 'true' : 'false');

  // Detect JS file changes (in js/ folder)
  const jsChanged = changedFiles.some(
    (file) =>
      file.startsWith('js/') &&
      (file.endsWith('.js') ||
        file.endsWith('.mjs') ||
        file.endsWith('.ts') ||
        file.endsWith('.json'))
  );
  setOutput('js-changed', jsChanged ? 'true' : 'false');

  // Detect package.json changes (in js/ folder)
  const packageChanged = changedFiles.some(
    (file) => file === 'js/package.json' || file === 'js/package-lock.json'
  );
  setOutput('package-changed', packageChanged ? 'true' : 'false');

  // Detect .mjs file changes (shared scripts in scripts/)
  const mjsChanged = changedFiles.some(
    (file) => file.endsWith('.mjs') && file.startsWith('scripts/')
  );
  setOutput('mjs-changed', mjsChanged ? 'true' : 'false');

  // Detect documentation changes (any .md file)
  const docsChanged = changedFiles.some((file) => file.endsWith('.md'));
  setOutput('docs-changed', docsChanged ? 'true' : 'false');

  // Detect workflow changes (any workflow file)
  const workflowChanged = changedFiles.some((file) =>
    file.startsWith('.github/workflows/')
  );
  setOutput('workflow-changed', workflowChanged ? 'true' : 'false');

  // Detect Rust workflow changes specifically
  const rustWorkflowChanged = changedFiles.some(
    (file) => file === '.github/workflows/rust.yml'
  );
  setOutput('rust-workflow-changed', rustWorkflowChanged ? 'true' : 'false');

  // Detect JS workflow changes specifically
  const jsWorkflowChanged = changedFiles.some(
    (file) => file === '.github/workflows/js.yml'
  );
  setOutput('js-workflow-changed', jsWorkflowChanged ? 'true' : 'false');

  // Detect code changes (excluding docs, changelog.d, experiments, examples folders, and markdown files)
  const codeChangedFiles = changedFiles.filter(
    (file) => !isExcludedFromCodeChanges(file)
  );

  console.log('\nFiles considered as code changes:');
  if (codeChangedFiles.length === 0) {
    console.log('  (none)');
  } else {
    codeChangedFiles.forEach((file) => console.log(`  ${file}`));
  }
  console.log('');

  // Check if any code files changed (.rs, .toml, .mjs, .js, .yml, .yaml, or workflow files)
  const codePattern = /\.(rs|toml|mjs|js|ts|json|yml|yaml)$|\.github\/workflows\//;
  const codeChanged = codeChangedFiles.some((file) => codePattern.test(file));
  setOutput('any-code-changed', codeChanged ? 'true' : 'false');

  // Detect Rust-specific code changes (triggers Rust CI/CD)
  const rustCodeChanged = codeChangedFiles.some(
    (file) => isRustRelated(file) && codePattern.test(file)
  );
  setOutput('rust-code-changed', rustCodeChanged ? 'true' : 'false');

  // Detect JS-specific code changes (triggers JS CI/CD)
  const jsCodeChanged = codeChangedFiles.some(
    (file) => isJsRelated(file) && codePattern.test(file)
  );
  setOutput('js-code-changed', jsCodeChanged ? 'true' : 'false');

  // Detect Rust package code changes (requires changelog fragment)
  // This excludes workflow file changes - only actual package code matters
  const rustPackageChanged = codeChangedFiles.some(
    (file) => isRustPackageCode(file) && codePattern.test(file)
  );
  setOutput('rust-package-changed', rustPackageChanged ? 'true' : 'false');

  // Detect JS package code changes (requires changeset)
  // This excludes workflow file changes - only actual package code matters
  const jsPackageChanged = codeChangedFiles.some(
    (file) => isJsPackageCode(file) && codePattern.test(file)
  );
  setOutput('js-package-changed', jsPackageChanged ? 'true' : 'false');

  // Log summary for debugging
  console.log('\nLanguage-specific detection:');
  console.log(`  Rust-related changes: ${rustCodeChanged}`);
  console.log(`  JS-related changes: ${jsCodeChanged}`);
  console.log(`  Rust package code changes: ${rustPackageChanged}`);
  console.log(`  JS package code changes: ${jsPackageChanged}`);
  console.log(`  Shared scripts changed: ${mjsChanged}`);

  console.log('\nChange detection completed.');
}

// Run the detection
detectChanges();
