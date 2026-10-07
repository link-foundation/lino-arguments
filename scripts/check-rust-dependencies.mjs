#!/usr/bin/env node

// A dependency may be blocked only by an open GitHub issue linked in its
// manifest-line comment. Closing the issue automatically removes the exemption.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, URL } from 'node:url';
import { resolve } from 'node:path';

async function fetchIssue(owner, repository, number) {
  const token = process.env.GITHUB_TOKEN;
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repository}/issues/${number}`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }
  );
  if (!response.ok) {
    throw new Error(`Cannot verify blocker issue: HTTP ${response.status}`);
  }
  return response.json();
}

export async function getIgnoredDependencies(manifest, lookup = fetchIssue) {
  const ignored = [];
  let dependencySection = false;
  for (const line of manifest.split('\n')) {
    if (line.trim().startsWith('[')) {
      dependencySection = /^\[(?:.*\.)?(?:dev-|build-)?dependencies\]$/.test(
        line.trim()
      );
    }
    if (!dependencySection) {
      continue;
    }
    const declaration = line.match(/^\s*([\w-]+)\s*=.*?#(.*)$/);
    if (!declaration) {
      continue;
    }
    const issue = declaration[2].match(
      /https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/issues\/(\d+)\b/
    );
    if (!issue) {
      continue;
    }
    const [, owner, repository, number] = issue;
    const blocker = await lookup(owner, repository, number);
    if (blocker.state === 'open' && !blocker.pull_request) {
      ignored.push(declaration[1]);
      console.log(`Blocked ${declaration[1]}: ${issue[0]}`);
    }
  }
  return ignored;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const rustRoot = fileURLToPath(new URL('../rust/', import.meta.url));
    const manifest = readFileSync(
      new URL('../rust/Cargo.toml', import.meta.url),
      'utf8'
    );
    const ignored = await getIgnoredDependencies(manifest);
    const args = ['outdated', '--root-deps-only', '--exit-code', '1'];
    for (const dependency of ignored) {
      args.push('--ignore', dependency);
    }
    const result = spawnSync('cargo', args, {
      cwd: rustRoot,
      stdio: 'inherit',
    });
    if (result.error) {
      throw result.error;
    }
    process.exitCode = result.status ?? 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
