// crates.io publishing: trusted publishing (OIDC) first, token secret as fallback.
// Runs the real scripts/publish-crate.mjs with finite local stand-ins for cargo
// and curl, and checks the release jobs in .github/workflows/rust.yml.
// No registry or GitHub mutation is performed.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const publishScript = join(root, 'scripts', 'publish-crate.mjs');
const workflow = readFileSync(
  join(root, '.github', 'workflows', 'rust.yml'),
  'utf8'
);

const AUTH_ACTION =
  'rust-lang/crates-io-auth-action@c6f97d42243bad5fab37ca0427f495c86d5b1a18 # v1.0.5';
const TOKEN_EXPRESSION =
  '${{ steps.crates_auth.outputs.token || secrets.CARGO_REGISTRY_TOKEN || secrets.CARGO_TOKEN }}';

// cargoMode: 'success' | 'already' | 'fail'
function publish({ env: extraEnv = {}, cargoMode = 'success', args = [] }) {
  const directory = mkdtempSync(join(tmpdir(), 'lino-crates-publish-'));
  try {
    const rust = join(directory, 'rust');
    const bin = join(directory, 'bin');
    mkdirSync(rust);
    mkdirSync(bin);
    writeFileSync(
      join(rust, 'Cargo.toml'),
      '[package]\nname = "fixture-crate"\nversion = "1.2.3"\n'
    );
    const handler = join(directory, 'stand-in.cjs');
    writeFileSync(
      handler,
      `
      const fs = require('node:fs');
      const [tool, ...args] = process.argv.slice(2);
      if (tool === 'curl') {
        console.log('{"errors":[{"detail":"crate not found"}]}');
        process.exit(0);
      }
      fs.writeFileSync(process.env.FIXTURE_CARGO, JSON.stringify({
        args,
        cwd: process.cwd(),
        hasRegistryToken: 'CARGO_REGISTRY_TOKEN' in process.env,
        registryToken: process.env.CARGO_REGISTRY_TOKEN,
      }));
      if (process.env.FIXTURE_MODE === 'already') {
        console.error('error: crate version 1.2.3 is already uploaded');
        process.exit(101);
      }
      if (process.env.FIXTURE_MODE === 'fail') {
        console.error('error: failed to publish to registry: 403 Forbidden');
        process.exit(101);
      }
      console.error('Uploaded fixture-crate v1.2.3');
      `
    );
    for (const tool of ['cargo', 'curl']) {
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
      FIXTURE_CARGO: join(directory, 'cargo.json'),
      FIXTURE_MODE: cargoMode,
      GITHUB_OUTPUT: join(directory, 'outputs'),
      RUST_ROOT: 'rust',
    };
    delete env.CARGO_REGISTRY_TOKEN;
    delete env.CARGO_TOKEN;
    Object.assign(env, extraEnv);
    const result = spawnSync(process.execPath, [publishScript, ...args], {
      cwd: directory,
      env,
      encoding: 'utf8',
      timeout: 20000,
    });
    return {
      status: result.status,
      output: result.stdout + result.stderr,
      outputs: existsSync(env.GITHUB_OUTPUT)
        ? readFileSync(env.GITHUB_OUTPUT, 'utf8')
        : '',
      cargo: existsSync(env.FIXTURE_CARGO)
        ? JSON.parse(readFileSync(env.FIXTURE_CARGO, 'utf8'))
        : null,
      rust,
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test(
  'trusted publishing token reaches cargo only through its environment',
  { timeout: 30000 },
  () => {
    const result = publish({
      env: { CARGO_REGISTRY_TOKEN: 'oidc-short-lived', CARGO_TOKEN: 'legacy' },
    });
    assert.equal(result.status, 0, result.output);
    assert.deepEqual(result.cargo.args, ['publish', '--allow-dirty']);
    assert.equal(result.cargo.registryToken, 'oidc-short-lived');
    assert.equal(result.cargo.cwd, result.rust);
    assert.match(result.outputs, /publish_result=success/);
    assert.doesNotMatch(result.output, /oidc-short-lived/);
  }
);

test(
  'CARGO_TOKEN still works as the fallback secret',
  { timeout: 30000 },
  () => {
    const result = publish({ env: { CARGO_TOKEN: 'legacy-secret' } });
    assert.equal(result.status, 0, result.output);
    assert.equal(result.cargo.registryToken, 'legacy-secret');
    assert.ok(!result.cargo.args.includes('--token'));
  }
);

test(
  '--token argument is passed to cargo through its environment',
  { timeout: 30000 },
  () => {
    const result = publish({ args: ['--token', 'cli-token'] });
    assert.equal(result.status, 0, result.output);
    assert.equal(result.cargo.registryToken, 'cli-token');
    assert.deepEqual(result.cargo.args, ['publish', '--allow-dirty']);
  }
);

test('a failed publish never prints the token', { timeout: 30000 }, () => {
  const result = publish({
    env: { CARGO_REGISTRY_TOKEN: 'secret-must-not-leak' },
    cargoMode: 'fail',
  });
  assert.equal(result.status, 1);
  assert.match(result.outputs, /publish_result=failed/);
  assert.match(result.output, /403 Forbidden/);
  assert.doesNotMatch(result.output, /secret-must-not-leak/);
});

test('an already uploaded version is not a failure', { timeout: 30000 }, () => {
  const result = publish({
    env: { CARGO_REGISTRY_TOKEN: 'token' },
    cargoMode: 'already',
  });
  assert.equal(result.status, 0, result.output);
  assert.match(result.outputs, /publish_result=already_exists/);
});

test(
  'an empty token (no OIDC and no secrets) does not shadow cargo credentials',
  { timeout: 30000 },
  () => {
    // GitHub Actions sets the variable to '' when every alternative is empty.
    const result = publish({ env: { CARGO_REGISTRY_TOKEN: '' } });
    assert.equal(result.status, 0, result.output);
    assert.equal(result.cargo.hasRegistryToken, false);
    assert.match(result.output, /::warning::No crates.io token/);
  }
);

test(
  'a successful trusted publishing step is reported',
  { timeout: 30000 },
  () => {
    const result = publish({
      env: { CARGO_REGISTRY_TOKEN: 'oidc', CRATES_AUTH_OUTCOME: 'success' },
    });
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /Using the crates.io trusted publishing/);
    assert.doesNotMatch(result.output, /::warning::/);
  }
);

test(
  'falling back to the token secret warns with what to configure',
  { timeout: 30000 },
  () => {
    const result = publish({
      env: {
        CARGO_REGISTRY_TOKEN: 'secret',
        CRATES_AUTH_OUTCOME: 'failure',
        GITHUB_REPOSITORY: 'link-foundation/lino-arguments',
      },
    });
    assert.equal(result.status, 0, result.output);
    assert.equal(result.cargo.registryToken, 'secret');
    assert.match(
      result.output,
      /::warning::crates.io trusted publishing is unavailable \(auth step outcome: failure\)/
    );
    assert.match(
      result.output,
      /trusted publisher on crates.io .* link-foundation\/lino-arguments and workflow rust.yml/
    );
  }
);

// Minimal structural reader for the workflow: job blocks are indented by two
// spaces under `jobs:`, steps start with `      - ` inside a job.
function jobBlock(name) {
  const jobs = workflow.slice(workflow.indexOf('\njobs:\n'));
  const match = jobs.match(
    new RegExp(`\\n  ${name}:\\n([\\s\\S]*?)(?=\\n  [\\w-]+:\\n|$)`)
  );
  assert.ok(match, `job ${name} exists`);
  return match[1];
}

function steps(job) {
  return job.split(/\n(?=      - )/).slice(1);
}

for (const jobName of ['auto-release', 'manual-release']) {
  test(`${jobName} authenticates with trusted publishing before the token fallback`, () => {
    const job = jobBlock(jobName);
    assert.match(
      job,
      /\n    permissions:\n(?:      .*\n)*?      id-token: write\n/
    );
    const all = steps(job);
    const auth = all.findIndex((step) => step.includes('id: crates_auth'));
    const publishStep = all.findIndex((step) =>
      step.includes('node scripts/publish-crate.mjs')
    );
    assert.ok(auth >= 0, 'auth step present');
    assert.ok(publishStep > auth, 'auth step runs before publish');
    assert.ok(all[auth].includes(`uses: ${AUTH_ACTION}`), 'auth action pinned');
    assert.match(all[auth], /\n        continue-on-error: true/);
    const condition = (step) => step.match(/\n        if: (.*)/)?.[1];
    assert.equal(condition(all[auth]), condition(all[publishStep]));
    assert.ok(
      all[publishStep].includes(`CARGO_REGISTRY_TOKEN: ${TOKEN_EXPRESSION}`),
      'publish prefers the OIDC token and falls back to both secrets'
    );
    assert.ok(
      all[publishStep].includes(
        'CRATES_AUTH_OUTCOME: ${{ steps.crates_auth.outcome }}'
      ),
      'publish reports whether trusted publishing was used'
    );
  });
}

test('token secrets are only read by the publish steps', () => {
  const uses = workflow.match(/secrets\.CARGO_\w+/g) ?? [];
  const expressions = workflow.split(TOKEN_EXPRESSION).length - 1;
  assert.equal(expressions, 2);
  assert.equal(uses.length, expressions * 2);
});
