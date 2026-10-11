// Assess issue #46 using registry dependencies and an actual npm package tarball.
// --require-deduplicated reproduces the currently unsupported single-parser graph.
// --assess-lino-env-range changes only a temporary copy of upstream metadata.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const jsRoot = fileURLToPath(new URL('../js/', import.meta.url));
const fixture = fileURLToPath(
  new URL('./grammar-consumer.mjs', import.meta.url)
);
const directory = mkdtempSync(join(tmpdir(), 'lino-grammar-consumer-'));
const assess = process.argv.includes('--assess-lino-env-range');
const requireDeduplicated = process.argv.includes('--require-deduplicated');
const npm = (args, cwd = directory) =>
  execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
const pack = (cwd) => {
  const [result] = JSON.parse(
    npm(
      ['pack', '--ignore-scripts', '--json', '--pack-destination', directory],
      cwd
    )
  );
  return `file:${join(directory, result.filename)}`;
};

try {
  const latest = JSON.parse(
    npm(['view', 'links-notation', 'version', '--json'])
  );
  const dependencies = {
    'links-notation': latest,
    'lino-arguments': pack(jsRoot),
  };
  if (assess) {
    const upstream = join(directory, 'lino-env-range-assessment');
    cpSync(join(jsRoot, 'node_modules/lino-env'), upstream, {
      recursive: true,
      filter: (path) => basename(path) !== 'node_modules',
    });
    const manifestPath = join(upstream, 'package.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    manifest.dependencies['links-notation'] = `^${latest}`;
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    dependencies['lino-env'] = pack(upstream);
    console.log(
      `Assessing lino-env ${manifest.version} with range ^${latest}.`
    );
  }
  writeFileSync(
    join(directory, 'package.json'),
    JSON.stringify({ private: true, type: 'module', dependencies }, null, 2)
  );
  npm(['install', '--ignore-scripts', '--no-audit', '--no-fund']);
  cpSync(fixture, join(directory, 'consumer.mjs'));
  console.log(
    execFileSync(process.execPath, ['consumer.mjs'], {
      cwd: directory,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  );
  const lock = JSON.parse(readFileSync(join(directory, 'package-lock.json')));
  const grammars = Object.entries(lock.packages)
    .filter(([path]) => path.endsWith('node_modules/links-notation'))
    .map(([path, entry]) => ({ path, version: entry.version }));
  console.log(JSON.stringify({ latest, grammars }, null, 2));
  if (assess || requireDeduplicated) {
    assert.equal(
      grammars.length,
      1,
      'Full deduplication requires the upstream lino-env range migration (#33)'
    );
    assert.equal(grammars[0].version, latest);
  } else {
    // Until upstream releases its range migration, the old metadata may add
    // exactly one legacy copy. Accept a future compatible upstream release too.
    assert.ok(grammars.length >= 1 && grammars.length <= 2);
    assert.equal(grammars[0].version, latest);
    if (grammars.length === 2) {
      assert.equal(grammars[1].version, '0.11.2');
      assert.ok(grammars[1].path.includes('lino-env/node_modules/'));
    }
  }
} catch (error) {
  if (error.stdout) {
    console.error(error.stdout.toString());
  }
  if (error.stderr) {
    console.error(error.stderr.toString());
  }
  throw error;
} finally {
  rmSync(directory, { recursive: true, force: true });
}
