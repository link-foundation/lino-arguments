#!/usr/bin/env node

/** Format release notes using the sibling script, from any working directory. */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const getArg = (name, fallback = '') => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
};
const version = getArg('release-version', process.env.VERSION);
const repository = getArg('repository', process.env.REPOSITORY);
const commitSha = getArg('commit-sha', process.env.COMMIT_SHA);
const tagPrefix = getArg('tag-prefix', process.env.TAG_PREFIX || 'js_');

if (!version || !repository || !commitSha) {
  console.error(
    'Usage: format-github-release.mjs --release-version <version> --repository <repository> --commit-sha <sha>'
  );
  process.exit(1);
}
const tag = `${tagPrefix || 'js_'}${version}`;
let releaseId;
try {
  releaseId = execFileSync(
    'gh',
    ['api', `repos/${repository}/releases/tags/${tag}`, '--jq', '.id'],
    { encoding: 'utf8' }
  ).trim();
} catch {
  console.log(`Could not find release for ${tag}`);
  process.exit(0);
}
if (releaseId) {
  try {
    const script = fileURLToPath(
      new URL('./format-release-notes.mjs', import.meta.url)
    );
    execFileSync(
      process.execPath,
      [
        script,
        '--release-id',
        releaseId,
        '--release-version',
        tag,
        '--repository',
        repository,
        '--commit-sha',
        commitSha,
      ],
      { stdio: 'inherit' }
    );
    console.log(`Formatted release notes for ${tag}`);
  } catch (error) {
    console.error('Error formatting release:', error.message);
    process.exit(1);
  }
}
