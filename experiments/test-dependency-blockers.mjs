import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getIgnoredDependencies } from '../scripts/check-rust-dependencies.mjs';

const manifest = `[package]
name = "fixture" # https://github.com/example/project/issues/1
[dependencies]
ctor = "0.4.3" # Waiting for startup fix: https://github.com/example/project/issues/2
serde = "1.0"
[dev-dependencies]
tempfile = "3" # Blocked: https://github.com/example/project/issues/3
`;

test('only dependency comments with an open issue grant exceptions', async () => {
  const lookedUp = [];
  const ignored = await getIgnoredDependencies(manifest, (owner, repo, id) => {
    lookedUp.push([owner, repo, id]);
    return { state: id === '2' ? 'open' : 'closed' };
  });
  assert.deepEqual(ignored, ['ctor']);
  assert.deepEqual(lookedUp, [
    ['example', 'project', '2'],
    ['example', 'project', '3'],
  ]);
});

test('a pull request URL disguised as an issue cannot grant an exception', async () => {
  assert.deepEqual(
    await getIgnoredDependencies(manifest, () => ({
      state: 'open',
      pull_request: {},
    })),
    []
  );
});

test('registry/API failures fail the check instead of suppressing updates', async () => {
  await assert.rejects(
    getIgnoredDependencies(manifest, () => {
      throw new Error('HTTP 403');
    }),
    /HTTP 403/
  );
});

test('an ordinary comment cannot exempt an outdated dependency', async () => {
  const ignored = await getIgnoredDependencies(
    '[dependencies]\nctor = "0.4.3" # TODO upgrade\n',
    () => assert.fail('No issue URL should be looked up')
  );
  assert.deepEqual(ignored, []);
});
