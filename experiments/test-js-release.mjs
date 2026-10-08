// Execute the real release CLIs with finite local stand-ins for external tools.
// No git remote, registry, or GitHub mutation is performed by these fixtures.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';

const scripts = fileURLToPath(new URL('../scripts/', import.meta.url));
function fixture(run) {
  const directory = mkdtempSync(join(tmpdir(), 'lino-js-release-'));
  const js = join(directory, 'js');
  const bin = join(directory, 'bin');
  mkdirSync(js);
  mkdirSync(bin);
  writeFileSync(
    join(js, 'package.json'),
    JSON.stringify({ name: 'fixture', version: '0.3.0' })
  );
  writeFileSync(
    join(js, 'CHANGELOG.md'),
    '# Changelog\n\n## 0.4.0\n\n### Minor Changes\n\n- JS-only release fixture\n\n## 0.3.0\n\n- Old notes\n'
  );
  const handler = join(directory, 'stand-in.cjs');
  writeFileSync(
    handler,
    `
    const fs = require('node:fs');
    const path = require('node:path');
    const [tool, ...args] = process.argv.slice(2);
    fs.appendFileSync(process.env.FIXTURE_LOG, JSON.stringify([tool, ...args]) + '\\n');
    if (tool === 'npm') {
      if (args[0] === 'view') {
        if (args.includes('--json')) console.log('["0.3.0"]');
        else process.exit(1);
      } else {
        const pkg = JSON.parse(fs.readFileSync('package.json'));
        pkg.version = '0.4.0';
        fs.writeFileSync('package.json', JSON.stringify(pkg));
      }
    } else if (tool === 'git') {
      if (args[0] === 'diff' || args[0] === 'rev-parse') process.exit(1);
    } else if (tool === 'gh') {
      if (args.includes('POST')) fs.writeFileSync(process.env.FIXTURE_PAYLOAD, fs.readFileSync(0));
      else if (args.includes('--jq')) console.log('123');
      else console.log(JSON.stringify({ body: 'img.shields.io: already formatted' }));
    }
  `
  );
  for (const tool of ['npm', 'git', 'gh']) {
    const quote = (value) => "'" + value.replaceAll("'", "'\\''") + "'";
    writeFileSync(
      join(bin, tool),
      `#!/bin/sh\nexec ${quote(process.execPath)} ${quote(handler)} ${tool} "$@"\n`,
      { mode: 0o755 }
    );
  }
  const env = {
    ...process.env,
    PATH: `${bin}${delimiter}${process.env.PATH}`,
    FIXTURE_LOG: join(directory, 'calls.jsonl'),
    FIXTURE_PAYLOAD: join(directory, 'payload.json'),
    GITHUB_OUTPUT: join(directory, 'outputs'),
    RUST_ROOT: '',
    VERSION_MODE: '',
  };
  try {
    run({ directory, js, env });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

for (const mode of ['changeset', 'instant']) {
  for (const location of ['root', 'js']) {
    test(
      `JavaScript ${mode} release from ${location} needs no Rust manifest`,
      { timeout: 30000 },
      () =>
        fixture(({ directory, js, env }) => {
          const result = spawnSync(
            process.execPath,
            [
              join(scripts, 'version-and-commit.mjs'),
              '--mode',
              mode,
              '--bump-type',
              'minor',
              '--tag-prefix',
              'js_',
              '--release-label',
              'JavaScript',
            ],
            { cwd: location === 'js' ? js : directory, env, encoding: 'utf8' }
          );
          assert.equal(result.status, 0, result.stdout + result.stderr);
          assert.match(
            readFileSync(env.GITHUB_OUTPUT, 'utf8'),
            /version_committed=true/
          );
          assert.match(
            readFileSync(env.GITHUB_OUTPUT, 'utf8'),
            /new_version=0\.4\.0/
          );
          assert.match(readFileSync(env.FIXTURE_LOG, 'utf8'), /js_0\.4\.0/);
          assert.equal(
            JSON.parse(readFileSync(join(js, 'package.json'))).version,
            '0.4.0'
          );
        })
    );
  }
}

for (const location of ['root', 'js']) {
  test(
    `JavaScript GitHub release from ${location} uses JS changelog without Cargo`,
    { timeout: 30000 },
    () =>
      fixture(({ directory, js, env }) => {
        const result = spawnSync(
          process.execPath,
          [
            join(scripts, 'create-github-release.mjs'),
            '--release-version',
            '0.4.0',
            '--repository',
            'fixture/repo',
            '--tag-prefix',
            'js_',
            '--release-label',
            'JavaScript',
          ],
          { cwd: location === 'js' ? js : directory, env, encoding: 'utf8' }
        );
        assert.equal(result.status, 0, result.stdout + result.stderr);
        const payload = JSON.parse(readFileSync(env.FIXTURE_PAYLOAD));
        assert.equal(payload.tag_name, 'js_0.4.0');
        assert.equal(payload.name, '[JavaScript] 0.4.0');
        assert.match(payload.body, /JS-only release fixture/);
        assert.doesNotMatch(payload.body, /Old notes/);
      })
  );
}

for (const location of ['root', 'js']) {
  test(
    `release note formatter finds its sibling from ${location}`,
    { timeout: 30000 },
    () =>
      fixture(({ directory, js, env }) => {
        const result = spawnSync(
          process.execPath,
          [
            join(scripts, 'format-github-release.mjs'),
            '--release-version',
            '0.4.0',
            '--repository',
            'fixture/repo',
            '--commit-sha',
            'fixture-sha',
          ],
          { cwd: location === 'js' ? js : directory, env, encoding: 'utf8' }
        );
        assert.equal(result.status, 0, result.stdout + result.stderr);
        assert.match(result.stdout, /already formatted/);
        assert.match(readFileSync(env.FIXTURE_LOG, 'utf8'), /releases\/123/);
      })
  );
}
