// Verify Changesets 3 can prepare the next npm release without changing the repo.
// The fixture keeps js/'s Deno files: Changesets must not spawn `deno`, which
// the npm release job does not install (`Error: spawn deno ENOENT`).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const jsRoot = fileURLToPath(new URL('../js/', import.meta.url));
const versionScript = fileURLToPath(
  new URL('../scripts/changeset-version.mjs', import.meta.url)
);
const root = mkdtempSync(join(tmpdir(), 'lino-release-preparation-'));
const directory = join(root, 'js');
const bin = join(root, 'bin');
try {
  mkdirSync(directory);
  mkdirSync(bin);
  for (const file of [
    'package.json',
    'package-lock.json',
    'CHANGELOG.md',
    'deno.json',
    'deno.lock',
    '.prettierrc',
  ]) {
    cpSync(join(jsRoot, file), join(directory, file));
  }
  cpSync(join(jsRoot, '.changeset'), join(directory, '.changeset'), {
    recursive: true,
  });
  // Stand-ins: any `deno` call fails; `npm install --package-lock-only` is
  // recorded instead of touching the registry. npx stays the real one.
  const calls = join(root, 'calls.log');
  writeFileSync(
    join(bin, 'deno'),
    `#!/bin/sh\necho "deno $*" >> '${calls}'\necho 'spawned deno' >&2\nexit 1\n`,
    { mode: 0o755 }
  );
  writeFileSync(
    join(bin, 'npm'),
    `#!/bin/sh\necho "npm $*" >> '${calls}'\n[ "$1" = install ] || exit 1\n`,
    { mode: 0o755 }
  );
  symlinkSync(
    join(jsRoot, 'node_modules'),
    join(directory, 'node_modules'),
    'junction'
  );
  const previous = JSON.parse(readFileSync(join(directory, 'package.json')));
  const [major, minor] = previous.version.split('.').map(Number);
  const expected = `${major}.${minor + 1}.0`;
  execFileSync(process.execPath, [versionScript], {
    cwd: directory,
    env: { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH}` },
    encoding: 'utf8',
    stdio: 'pipe',
    timeout: 120000,
  });
  const release = JSON.parse(readFileSync(join(directory, 'package.json')));
  assert.equal(release.version, expected);
  assert.match(readFileSync(join(directory, 'CHANGELOG.md'), 'utf8'), /latest/);
  assert.equal(
    readFileSync(calls, 'utf8'),
    'npm install --package-lock-only\n',
    'only the lockfile sync runs; deno is never spawned'
  );
  execFileSync(
    process.execPath,
    [
      join(jsRoot, 'node_modules/prettier/bin/prettier.cjs'),
      '--check',
      'CHANGELOG.md',
      'package.json',
    ],
    { cwd: directory, stdio: 'pipe' }
  );
  console.log(`Changesets 3 prepared npm ${expected} and its changelog.`);
} finally {
  rmSync(root, { recursive: true, force: true });
}
