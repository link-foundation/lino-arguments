import { describe, it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { createConfigContext, resolveConfig } from 'lino-arguments/pure';

describe('filesystem-free object resolution', () => {
  it('resolves typed object sources with independent contexts', () => {
    const options = {
      port: { type: 'number', default: 3000 },
      verbose: { type: 'boolean', default: true },
      'api-key': { type: 'string', env: 'TOKEN', default: 'fallback' },
    };
    const env = Object.freeze({ PORT: 0, VERBOSE: false, TOKEN: '' });
    assert.deepEqual(resolveConfig({ options, env }), {
      port: 0,
      verbose: false,
      apiKey: '',
    });
    assert.deepEqual(resolveConfig({ options }), {
      port: 3000,
      verbose: true,
      apiKey: 'fallback',
    });
    assert.equal(
      resolveConfig({
        options,
        lenv: { PORT: 10 },
        configuration: { port: 20 },
        env: { port: 30 },
        argv: { port: 40 },
      }).port,
      40
    );
    assert.equal(
      resolveConfig({ options, env: { PORT: 10 }, autoMap: false }).port,
      3000
    );
  });

  it('snapshots maps and retains integer/float/boolish fallback behavior', () => {
    const env = { PORT: '12.5', VERBOSE: 'invalid' };
    const context = createConfigContext({ env });
    env.PORT = '20';
    assert.equal(context.getenv('port', 0), 0);
    assert.equal(context.getenv('port', 0.1), 12.5);
    assert.equal(context.getenv('verbose', true), true);
    assert.equal(
      createConfigContext({ env: { VERBOSE: 'FALSE' } }).getenv(
        'verbose',
        true
      ),
      false
    );
  });

  it('selects the winning source before resolving direct/file conflicts', () => {
    const secrets = {
      keys: ['TOKEN'],
      readFile: () => assert.fail('unused file'),
    };
    const context = createConfigContext({
      env: { TOKEN: '' },
      lenv: { TOKEN_FILE: 'path' },
      secrets,
    });
    assert.equal(context.getenv('token', 'fallback'), '');
    const reverse = createConfigContext({
      env: { TOKEN_FILE: 'path' },
      lenv: { TOKEN: 'lower' },
      secrets: { keys: ['TOKEN'], readFile: () => 'from-file\n' },
    });
    assert.equal(reverse.getenv('token'), 'from-file');
    assert.equal(
      resolveConfig({
        options: { token: { type: 'string' } },
        env: { TOKEN_FILE: 'path' },
        argv: { token: 'cli' },
        secrets,
      }).token,
      'cli'
    );
  });

  it('rejects aliases in each source and schema, including equal values', () => {
    assert.throws(
      () => createConfigContext({ lenv: { API_KEY: 'same', apiKey: 'same' } }),
      /ambiguous/i
    );
    assert.throws(
      () => resolveConfig({ options: { 'api-key': {}, apiKey: {} } }),
      /ambiguous/i
    );
    assert.throws(
      () =>
        resolveConfig({
          options: { port: {} },
          argv: { PORT: '1', port: '2' },
        }),
      /ambiguous/i
    );
    assert.throws(
      () => createConfigContext({ secrets: { keys: ['TOKEN', 'token'] } }),
      /ambiguous/i
    );
  });

  it('uses injected byte readers, preserves BOM/spaces, caches reads and redacts tracing', () => {
    const trace = [];
    let reads = 0;
    const context = createConfigContext({
      env: { TOKEN_FILE: 'private-path' },
      cwd: '/base',
      secrets: {
        keys: ['TOKEN'],
        readFile: () => {
          reads++;
          return new TextEncoder().encode('\uFEFF secret \r\n');
        },
      },
      trace: (event) => trace.push(event),
    });
    assert.equal(context.getenv('token'), '\uFEFF secret ');
    assert.equal(context.getenv('TOKEN'), '\uFEFF secret ');
    assert.equal(reads, 1);
    assert.deepEqual(trace, [{ key: 'TOKEN', source: 'env', file: true }]);
    assert.throws(
      () =>
        createConfigContext({
          env: { TOKEN_FILE: 'private' },
          secrets: { keys: ['TOKEN'] },
        }).getenv('token'),
      /Cannot read/
    );
  });

  it('rejects async readers, invalid encoding, and invalid policies without disclosure', () => {
    for (const readFile of [
      () => Promise.resolve('secret'),
      () => new Uint8Array([255]),
    ]) {
      assert.throws(
        () =>
          createConfigContext({
            env: { TOKEN_FILE: 'path' },
            secrets: { keys: ['TOKEN'], readFile },
          }).getenv('token'),
        /Invalid/
      );
    }
    assert.throws(
      () => createConfigContext({ secrets: { conflict: 'unknown' } }),
      /policy/
    );
    assert.throws(
      () => createConfigContext({ secrets: { newline: 'unknown' } }),
      /policy/
    );
    assert.throws(
      () => createConfigContext({ secrets: { keys: { TOKEN: '' } } }),
      /variable/
    );
  });

  it('keeps special property names as data and supports array types', () => {
    const config = resolveConfig({
      options: JSON.parse('{"__proto__":{"type":"string","env":"VALUE"}}'),
      env: { VALUE: 'text' },
    });
    assert.equal(Object.getPrototypeOf(config), Object.prototype);
    assert.deepEqual(
      resolveConfig({
        options: { names: { type: 'array' } },
        env: { NAMES: 'a, b' },
      }),
      { names: ['a', 'b'] }
    );
  });
});
