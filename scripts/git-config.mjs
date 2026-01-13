#!/usr/bin/env node

/**
 * Configure git user for CI/CD pipeline
 *
 * This script sets up the git user name and email for automated commits.
 * It's used by the CI/CD pipeline before making commits.
 *
 * Usage: node scripts/git-config.mjs [--name <name>] [--email <email>]
 *
 * Environment variables:
 *   - GIT_USER_NAME: Git user name (default: github-actions[bot])
 *   - GIT_USER_EMAIL: Git user email (default: github-actions[bot]@users.noreply.github.com)
 */

import { execSync } from 'child_process';

/**
 * Execute a shell command
 * @param {string} command - The command to execute
 */
function exec(command) {
  execSync(command, { encoding: 'utf-8', stdio: 'inherit' });
}

// Parse CLI arguments
const args = process.argv.slice(2);
const getArg = (name, defaultValue) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : defaultValue;
};

const name = getArg('name', process.env.GIT_USER_NAME || 'github-actions[bot]');
const email = getArg(
  'email',
  process.env.GIT_USER_EMAIL || 'github-actions[bot]@users.noreply.github.com'
);

try {
  console.log(`Configuring git user: ${name} <${email}>`);

  exec(`git config user.name "${name}"`);
  exec(`git config user.email "${email}"`);

  console.log('Git configuration complete');
} catch (error) {
  console.error('Error configuring git:', error.message);
  process.exit(1);
}
