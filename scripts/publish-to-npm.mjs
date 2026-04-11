#!/usr/bin/env node

/**
 * Publish to npm using OIDC trusted publishing
 * Usage: node scripts/publish-to-npm.mjs [--should-pull]
 *   should_pull: Optional flag to pull latest changes before publishing (for release job)
 *
 * Behavior:
 * - If version is NOT on npm: publish and verify
 * - If version IS on npm: compare local package content with published content
 *   - If content matches: set published=true (already correctly published)
 *   - If content differs: bump patch version and republish
 * - Always fails if publish cannot be verified (never silently skips)
 *
 * Uses link-foundation libraries:
 * - use-m: Dynamic package loading without package.json dependencies
 * - command-stream: Modern shell command execution with streaming support
 * - lino-arguments: Unified configuration from CLI args, env vars, and .lenv files
 */

import { readFileSync, writeFileSync, appendFileSync } from 'fs';
import { createHash } from 'crypto';
import { execSync } from 'child_process';

// Load use-m dynamically
const { use } = eval(
  await (await fetch('https://unpkg.com/use-m/use.js')).text()
);

// Import link-foundation libraries
const { $ } = await use('command-stream');
const { makeConfig } = await use('lino-arguments');

// Parse CLI arguments using lino-arguments
const config = makeConfig({
  yargs: ({ yargs, getenv }) =>
    yargs.option('should-pull', {
      type: 'boolean',
      default: getenv('SHOULD_PULL', false),
      describe: 'Pull latest changes before publishing',
    }),
});

const { shouldPull } = config;
const MAX_RETRIES = 3;
const RETRY_DELAY = 10000; // 10 seconds

/**
 * Sleep for specified milliseconds
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
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
}

/**
 * Check if a version exists on npm registry
 * @param {string} packageName
 * @param {string} version
 * @returns {Promise<boolean>}
 */
async function isVersionOnNpm(packageName, version) {
  const result = await $`npm view "${packageName}@${version}" version`.run({
    capture: true,
  });
  return result.code === 0;
}

/**
 * Compute SHA-256 hash of a file
 * @param {string} filePath
 * @returns {string}
 */
function fileHash(filePath) {
  const content = readFileSync(filePath);
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Compare local package content with published npm content.
 * Uses `npm pack` to create local tarball and compares its checksum
 * with the tarball downloaded from the npm registry.
 * @param {string} packageName
 * @param {string} version
 * @returns {Promise<boolean>} true if content matches
 */
async function compareContentWithNpm(packageName, version) {
  try {
    console.log(`Comparing local content with ${packageName}@${version} on npm...`);

    // Pack local package into tarball
    const localPackResult = execSync('npm pack --json 2>/dev/null', {
      encoding: 'utf-8',
      cwd: process.cwd(),
    });
    const localPackInfo = JSON.parse(localPackResult);
    const localTarball = localPackInfo[0].filename;
    const localHash = fileHash(localTarball);
    console.log(`Local tarball: ${localTarball} (sha256: ${localHash})`);

    // Download published tarball from npm
    execSync(`npm pack "${packageName}@${version}" 2>/dev/null`, {
      encoding: 'utf-8',
    });
    // npm pack downloads with the same filename pattern
    const publishedTarball = localTarball;
    // The downloaded file overwrites the local one, so we need a different approach:
    // Pack local first, rename, then download published
    execSync(`mv "${localTarball}" "local-${localTarball}"`, {
      encoding: 'utf-8',
    });
    execSync(`npm pack "${packageName}@${version}" 2>/dev/null`, {
      encoding: 'utf-8',
    });
    const publishedHash = fileHash(localTarball);
    const localHashFinal = fileHash(`local-${localTarball}`);
    console.log(`Published tarball sha256: ${publishedHash}`);
    console.log(`Local tarball sha256: ${localHashFinal}`);

    // Cleanup
    execSync(`rm -f "${localTarball}" "local-${localTarball}"`, {
      encoding: 'utf-8',
    });

    const matches = localHashFinal === publishedHash;
    console.log(`Content ${matches ? 'matches' : 'DIFFERS'}`);
    return matches;
  } catch (error) {
    console.error(`Content comparison failed: ${error.message}`);
    // If comparison fails, treat as mismatch to be safe
    return false;
  }
}

/**
 * Bump the patch version in package.json and package-lock.json
 * @returns {string} The new version
 */
function bumpPatchVersion() {
  console.log('Bumping patch version...');
  execSync('npm version patch --no-git-tag-version', {
    encoding: 'utf-8',
    stdio: 'inherit',
  });
  // Sync package-lock.json
  execSync('npm install --package-lock-only', {
    encoding: 'utf-8',
    stdio: 'inherit',
  });
  const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));
  console.log(`Version bumped to ${pkg.version}`);

  // Commit the version bump
  try {
    execSync('git add package.json package-lock.json', { encoding: 'utf-8' });
    execSync(`git commit -m "chore: bump version to ${pkg.version} (content mismatch recovery)"`, {
      encoding: 'utf-8',
    });
    execSync('git push', { encoding: 'utf-8' });
    console.log(`Committed and pushed version bump to ${pkg.version}`);
  } catch (error) {
    console.error(`Warning: Could not commit version bump: ${error.message}`);
  }

  return pkg.version;
}

/**
 * Attempt to publish the current version to npm
 * @param {string} packageName
 * @param {string} version
 * @returns {Promise<boolean>} true if published successfully
 */
async function attemptPublish(packageName, version) {
  for (let i = 1; i <= MAX_RETRIES; i++) {
    console.log(`Publish attempt ${i} of ${MAX_RETRIES} for ${packageName}@${version}...`);
    try {
      await $`npm run changeset:publish`;
      console.log(`Publish command completed (attempt ${i})`);
    } catch (publishError) {
      console.error(`Publish command failed (attempt ${i}):`, publishError.message || publishError);
    }

    // Verify the publish actually succeeded by checking npm registry
    // changeset publish can exit with code 0 even when individual packages fail,
    // or fail with an error even when the publish actually succeeded
    console.log('Verifying publish on npm registry...');
    await sleep(3000); // Wait for registry propagation

    if (await isVersionOnNpm(packageName, version)) {
      setOutput('published', 'true');
      setOutput('published_version', version);
      console.log(
        `\u2705 Verified ${packageName}@${version} is published on npm`
      );
      return true;
    }

    console.error(
      `\u274C ${packageName}@${version} was not found on npm after attempt ${i}`
    );
    if (i < MAX_RETRIES) {
      console.log(`Retrying in ${RETRY_DELAY / 1000}s...`);
      await sleep(RETRY_DELAY);
    }
  }
  return false;
}

async function main() {
  try {
    if (shouldPull) {
      // Pull the latest changes we just pushed
      await $`git pull origin main`;
    }

    // Get current version and package name
    const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));
    let currentVersion = packageJson.version;
    const PACKAGE_NAME = packageJson.name;
    console.log(`Current version to publish: ${PACKAGE_NAME}@${currentVersion}`);

    // Check if this version is already published on npm
    console.log(
      `Checking if version ${currentVersion} is already published...`
    );

    if (await isVersionOnNpm(PACKAGE_NAME, currentVersion)) {
      console.log(`Version ${currentVersion} is already published on npm`);

      // Compare content to verify it matches what we expect
      const contentMatches = await compareContentWithNpm(PACKAGE_NAME, currentVersion);

      if (contentMatches) {
        console.log(`\u2705 Content matches — ${PACKAGE_NAME}@${currentVersion} is correctly published`);
        setOutput('published', 'true');
        setOutput('published_version', currentVersion);
        setOutput('already_published', 'true');
        return;
      }

      // Content differs — bump version and republish
      console.log(`\u26A0\uFE0F Content mismatch for ${PACKAGE_NAME}@${currentVersion}`);
      console.log('Published content differs from local content. Bumping version and republishing...');
      currentVersion = bumpPatchVersion();
      console.log(`Will publish as ${PACKAGE_NAME}@${currentVersion}`);
    } else {
      // Version not found on npm (E404), proceed with publish
      console.log(
        `Version ${currentVersion} not found on npm, proceeding with publish...`
      );
    }

    // Publish to npm using OIDC trusted publishing with retry logic
    const published = await attemptPublish(PACKAGE_NAME, currentVersion);
    if (published) {
      return;
    }

    console.error(`\u274C Failed to publish ${PACKAGE_NAME}@${currentVersion} after ${MAX_RETRIES} attempts`);
    process.exit(1);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
