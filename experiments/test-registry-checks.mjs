#!/usr/bin/env node

/**
 * Test the registry-check functions from version-and-commit.mjs
 * Verifies that:
 * 1. checkVersionOnCratesIo returns true for published versions
 * 2. checkVersionOnCratesIo returns false for unpublished versions
 * 3. checkVersionOnNpm returns true for published versions
 * 4. checkVersionOnNpm returns false for unpublished versions
 * 5. getMaxPublishedCratesIoVersion returns correct max version
 * 6. getMaxPublishedNpmVersion returns correct max version
 * 7. ensureVersionExceedsPublished auto-recovers stuck versions
 */

import { execSync } from 'child_process';

let passed = 0;
let failed = 0;

function exec(command) {
  return execSync(command, { encoding: 'utf-8' });
}

function assert(condition, message) {
  if (condition) {
    console.log(`  PASS: ${message}`);
    passed++;
  } else {
    console.error(`  FAIL: ${message}`);
    failed++;
  }
}

function checkVersionOnCratesIo(crateName, version) {
  try {
    const response = exec(
      `curl -s -o /dev/null -w "%{http_code}" -H "User-Agent: test-registry-checks" https://crates.io/api/v1/crates/${crateName}/${version}`
    ).trim();
    return response === '200';
  } catch {
    return false;
  }
}

function checkVersionOnNpm(packageName, version) {
  try {
    exec(`npm view "${packageName}@${version}" version`);
    return true;
  } catch {
    return false;
  }
}

function getMaxPublishedCratesIoVersion(crateName) {
  try {
    const response = exec(
      `curl -s -H "User-Agent: test-registry-checks" https://crates.io/api/v1/crates/${crateName}`
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

function ensureVersionExceedsPublished(versionStr, registryType, packageName, maxPublished) {
  const parts = versionStr.split('-')[0].split('.');
  if (parts.length !== 3) return versionStr;

  let [major, minor, patch] = parts.map(Number);

  if (maxPublished) {
    const { major: pubMajor, minor: pubMinor, patch: pubPatch } = maxPublished;
    if (major < pubMajor || (major === pubMajor && minor < pubMinor) || (major === pubMajor && minor === pubMinor && patch <= pubPatch)) {
      major = pubMajor;
      minor = pubMinor;
      patch = pubPatch + 1;
    }
  }

  const checkRegistry = registryType === 'crates.io'
    ? (v) => checkVersionOnCratesIo(packageName, v)
    : (v) => checkVersionOnNpm(packageName, v);

  let safetyCounter = 0;
  let candidate = `${major}.${minor}.${patch}`;
  while (checkRegistry(candidate) && safetyCounter < 100) {
    patch += 1;
    candidate = `${major}.${minor}.${patch}`;
    safetyCounter += 1;
  }

  return candidate;
}

// === Tests ===

console.log('\n=== Testing crates.io registry checks ===');

// lino-arguments 0.3.0 is published on crates.io
const cratesResult = checkVersionOnCratesIo('lino-arguments', '0.3.0');
assert(cratesResult === true, 'lino-arguments@0.3.0 exists on crates.io');

const cratesResultFake = checkVersionOnCratesIo('lino-arguments', '999.999.999');
assert(cratesResultFake === false, 'lino-arguments@999.999.999 does NOT exist on crates.io');

const cratesResultBadName = checkVersionOnCratesIo('this-crate-definitely-does-not-exist-xyz', '1.0.0');
assert(cratesResultBadName === false, 'nonexistent crate returns false');

console.log('\n=== Testing npm registry checks ===');

// lino-arguments 0.3.0 is published on npm
const npmResult = checkVersionOnNpm('lino-arguments', '0.3.0');
assert(npmResult === true, 'lino-arguments@0.3.0 exists on npm');

const npmResultFake = checkVersionOnNpm('lino-arguments', '999.999.999');
assert(npmResultFake === false, 'lino-arguments@999.999.999 does NOT exist on npm');

console.log('\n=== Testing getMaxPublishedCratesIoVersion ===');

const maxCrates = getMaxPublishedCratesIoVersion('lino-arguments');
assert(maxCrates !== null, 'lino-arguments has published versions on crates.io');
if (maxCrates) {
  assert(maxCrates.major >= 0, `max crates.io version major >= 0 (got ${maxCrates.major}.${maxCrates.minor}.${maxCrates.patch})`);
  assert(maxCrates.minor >= 0, 'max crates.io version minor >= 0');
  assert(maxCrates.patch >= 0, 'max crates.io version patch >= 0');
}

console.log('\n=== Testing getMaxPublishedNpmVersion ===');

const maxNpm = getMaxPublishedNpmVersion('lino-arguments');
assert(maxNpm !== null, 'lino-arguments has published versions on npm');
if (maxNpm) {
  assert(maxNpm.major >= 0, `max npm version major >= 0 (got ${maxNpm.major}.${maxNpm.minor}.${maxNpm.patch})`);
}

console.log('\n=== Testing ensureVersionExceedsPublished (recovery logic) ===');

// Simulate stuck scenario: proposed version is <= max published
if (maxCrates) {
  const stuckVersion = `${maxCrates.major}.${maxCrates.minor}.${maxCrates.patch}`;
  const recovered = ensureVersionExceedsPublished(stuckVersion, 'crates.io', 'lino-arguments', maxCrates);
  const recoveredParts = recovered.split('.').map(Number);
  const isGreater = recoveredParts[0] > maxCrates.major ||
    (recoveredParts[0] === maxCrates.major && recoveredParts[1] > maxCrates.minor) ||
    (recoveredParts[0] === maxCrates.major && recoveredParts[1] === maxCrates.minor && recoveredParts[2] > maxCrates.patch);
  assert(isGreater, `Recovered version ${recovered} exceeds max published ${stuckVersion}`);
}

// Simulate with lower version
const lowVersion = ensureVersionExceedsPublished('0.0.1', 'crates.io', 'lino-arguments', maxCrates);
if (maxCrates) {
  const lowParts = lowVersion.split('.').map(Number);
  const isGreater = lowParts[0] > maxCrates.major ||
    (lowParts[0] === maxCrates.major && lowParts[1] > maxCrates.minor) ||
    (lowParts[0] === maxCrates.major && lowParts[1] === maxCrates.minor && lowParts[2] > maxCrates.patch);
  assert(isGreater, `Version 0.0.1 auto-recovered to ${lowVersion} (exceeds published)`);
}

// Test with a version that's already higher than published
const highVersion = ensureVersionExceedsPublished('999.0.0', 'crates.io', 'lino-arguments', maxCrates);
assert(highVersion === '999.0.0', `High version 999.0.0 stays unchanged (got ${highVersion})`);

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
