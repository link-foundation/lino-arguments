import { describe, it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { makeConfig, getenv } from '../src/index.js';
import { createConfigContext, resolveConfig } from 'lino-arguments/pure';

const argv = ['node', 'app.js'];
const ambiguous = /Ambiguous environment aliases for HTTP_PROXY/;

describe('environment aliases are validated on lookup', () => {
  for (const second of ['private-one', 'private-two']) {
    it(`ignores unrelated host aliases with ${second === 'private-one' ? 'equal' : 'different'} values`, () => {
      const previous = process.env;
      // A plain snapshot retains both spellings on Windows as well as POSIX.
      process.env = {
        ...previous,
        http_proxy: 'private-one',
        HTTP_PROXY: second,
        npm_config_cache: 'private-one',
        NPM_CONFIG_CACHE: second,
      };
      try {
        const config = makeConfig({
          argv,
          lenv: { enabled: false },
          yargs: ({ yargs, getenv }) =>
            yargs.option('verbose', {
              type: 'boolean',
              default: getenv('LINO_ALIAS_VERBOSE', false),
            }),
        });
        assert.equal(config.verbose, false);
        assert.equal(config.httpProxy, undefined);
        assert.throws(() => getenv('httpProxy'), ambiguous);
        assert.throws(
          () =>
            makeConfig({
              argv,
              lenv: { enabled: false },
              yargs: ({ yargs, getenv }) =>
                yargs.option('proxy', { default: getenv('httpProxy') }),
            }),
          ambiguous
        );
      } finally {
        process.env = previous;
      }
    });
  }

  it('snapshots unused collisions and reports only the requested key', () => {
    const env = { HTTP_PROXY: 'private-one', http_proxy: 'private-two' };
    const context = createConfigContext({ env });
    delete env.http_proxy;
    env.PORT = '99';
    assert.equal(context.getenv('port', 3000), 3000);
    assert.throws(() => context.lookup('httpProxy'), ambiguous);
    assert.throws(() => context.getenv('HTTP_PROXY', 'fallback'), ambiguous);
    assert.equal(getenv('port', 3000, { env }), 99);
    assert.equal(
      getenv('missing', 'fallback', {
        env: { HTTP_PROXY: 'private-one', http_proxy: 'private-two' },
      }),
      'fallback'
    );
  });

  it('validates mapped keys but lets CLI values bypass ambiguous env values', () => {
    const env = Object.freeze({ PORT: '10', port: '20' });
    const run = (extra = []) =>
      makeConfig({
        argv: [...argv, ...extra],
        lenv: { enabled: false },
        env: { values: env, autoMap: true },
        yargs: ({ yargs }) =>
          yargs.option('port', { type: 'number', alias: 'p' }),
      });
    assert.throws(() => run(), /Ambiguous environment aliases for PORT/);
    assert.equal(run(['-p', '30']).port, 30);
    assert.deepEqual(
      resolveConfig({
        env,
        options: { port: { type: 'number' } },
        argv: { port: 40 },
      }),
      { port: 40 }
    );
    assert.deepEqual(
      resolveConfig({ env, options: { verbose: { default: false } } }),
      { verbose: false }
    );
  });

  it('reports ambiguous secret file variables without reading or leaking paths', () => {
    const context = createConfigContext({
      env: { TOKEN_FILE: 'private-one', tokenFile: 'private-two' },
      secrets: {
        keys: ['TOKEN'],
        readFile: () => assert.fail('ambiguous file must not be read'),
      },
    });
    assert.equal(context.getenv('missing', 'fallback'), 'fallback');
    assert.throws(() => context.getenv('token'), {
      message: 'Ambiguous environment aliases for TOKEN_FILE',
    });
  });

  it('keeps configuration and lenv alias validation strict', () => {
    for (const source of ['configuration', 'lenv']) {
      assert.throws(
        () =>
          createConfigContext({
            [source]: { HTTP_PROXY: 'private-one', http_proxy: 'private-one' },
          }),
        ambiguous
      );
    }
  });
});
