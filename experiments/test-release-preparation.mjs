// Verify Changesets 3 can prepare the next npm release without changing the repo.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const jsRoot = fileURLToPath(new URL('../js/', import.meta.url));
const directory = mkdtempSync(join(tmpdir(), 'lino-release-preparation-'));
try {
  cpSync(join(jsRoot, 'package.json'), join(directory, 'package.json'));
  cpSync(join(jsRoot, '.changeset'), join(directory, '.changeset'), {
    recursive: true,
  });
  symlinkSync(
    join(jsRoot, 'node_modules'),
    join(directory, 'node_modules'),
    'junction'
  );
  const previous = JSON.parse(readFileSync(join(directory, 'package.json')));
  const [major, minor] = previous.version.split('.').map(Number);
  const expected = `${major}.${minor + 1}.0`;
  execFileSync(
    'node',
    [join(jsRoot, 'node_modules/@changesets/cli/bin.js'), 'version'],
    {
      cwd: directory,
      stdio: 'pipe',
    }
  );
  const release = JSON.parse(readFileSync(join(directory, 'package.json')));
  assert.equal(release.version, expected);
  assert.match(readFileSync(join(directory, 'CHANGELOG.md'), 'utf8'), /latest/);
  console.log(`Changesets 3 prepared npm ${expected} and its changelog.`);
} finally {
  rmSync(directory, { recursive: true, force: true });
}
