import { describe, it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { makeConfig } from '../src/index.js';

const processArgv = ['node', 'tool.js'];
const configure = ({ yargs }) =>
  yargs.exitProcess(false).help(false).version(false);
const run = (args = [], settings = {}) =>
  makeConfig({
    env: {},
    lenv: { enabled: false },
    argv: [...processArgv, ...args],
    yargs: configure,
    ...settings,
  });

describe('makeConfig positional arguments', () => {
  it('keeps the options-only result by default and when disabled', () => {
    for (const settings of [{}, { includePositionals: false }]) {
      assert.deepEqual(run(['collect', 'url', '--api-key', 'key'], settings), {
        apiKey: 'key',
      });
    }
  });

  it('supports the issue reproduction with legacy process defaults', () => {
    const config = makeConfig({
      lenv: { enabled: false },
      argv: [...processArgv, 'collect', 'https://example.com/product'],
      yargs: configure,
      includePositionals: true,
    });
    assert.deepEqual(config, {
      positionals: ['collect', 'https://example.com/product'],
    });
  });

  it('returns an empty array for empty argv and options-only input', () => {
    for (const argv of [[], processArgv]) {
      assert.deepEqual(run([], { argv, includePositionals: true }), {
        positionals: [],
      });
    }
    assert.deepEqual(run(['--api-key', 'key'], { includePositionals: true }), {
      apiKey: 'key',
      positionals: [],
    });
  });

  for (const args of [
    ['collect', 'https://example.com/product'],
    ['compare', 'first', 'second'],
    ['export', 'products.csv'],
    ['export', 'my products.csv', 'a "quoted" value', ''],
  ]) {
    it(`preserves the source order of ${JSON.stringify(args)}`, () => {
      assert.deepEqual(run(args, { includePositionals: true }), {
        positionals: args,
      });
    });
  }

  it('preserves positional types from the configured yargs parser', () => {
    assert.deepEqual(
      run(['compare', '42', '3.5'], { includePositionals: true }).positionals,
      ['compare', 42, 3.5]
    );
    assert.deepEqual(
      run(['compare', '42', '3.5'], {
        includePositionals: true,
        yargs: ({ yargs }) =>
          configure({ yargs }).parserConfiguration({
            'parse-positional-numbers': false,
          }),
      }).positionals,
      ['compare', '42', '3.5']
    );
  });

  it('accepts options before and after the command without treating values as positionals', () => {
    const config = run(
      ['--api-key', 'key', 'collect', 'url', '--limit', '2', '--verbose'],
      {
        includePositionals: true,
        yargs: ({ yargs }) =>
          configure({ yargs })
            .option('api-key', { type: 'string' })
            .option('limit', { type: 'number' })
            .option('verbose', { type: 'boolean' }),
      }
    );
    assert.deepEqual(config, {
      apiKey: 'key',
      limit: 2,
      verbose: true,
      positionals: ['collect', 'url'],
    });
  });

  it('preserves -- passthrough without parsing forwarded flags as options', () => {
    assert.deepEqual(
      run(['collect', 'url', '--', '--api-key', 'my key', '-v'], {
        includePositionals: true,
      }),
      { positionals: ['collect', 'url', '--api-key', 'my key', '-v'] }
    );
  });

  it('respects yargs populate-- when passthrough is stored separately', () => {
    let parsed;
    const config = run(['collect', '--', '--forwarded', 'value'], {
      includePositionals: true,
      yargs: ({ yargs }) =>
        configure({ yargs })
          .parserConfiguration({ 'populate--': true })
          .check((argv) => {
            parsed = argv;
            return true;
          }),
    });
    assert.deepEqual(config.positionals, ['collect']);
    assert.deepEqual(config.positionals, parsed._);
    assert.deepEqual(parsed['--'], ['--forwarded', 'value']);
  });

  it('retains environment mapping and CLI precedence alongside positionals', () => {
    const config = run(['--port', '9090', 'collect', 'url'], {
      env: { values: { PORT: '8080', API_KEY: 'key' }, autoMap: true },
      includePositionals: true,
      yargs: ({ yargs }) =>
        configure({ yargs })
          .option('port', { type: 'number', default: 3000 })
          .option('api-key', { type: 'string' }),
    });
    assert.deepEqual(config, {
      port: 9090,
      apiKey: 'key',
      positionals: ['collect', 'url'],
    });
  });

  it('uses the final command parse and runs its callbacks once', () => {
    let checks = 0;
    let handlers = 0;
    let parsed;
    const config = run(['collect', 'https://example.com/product'], {
      includePositionals: true,
      yargs: ({ yargs }) =>
        configure({ yargs }).command(
          'collect <url>',
          'Collect a product',
          (parser) =>
            parser.positional('url', { type: 'string' }).check((argv) => {
              checks++;
              parsed = argv;
              return true;
            }),
          () => {
            handlers++;
          }
        ),
    });
    assert.equal(checks, 1);
    assert.equal(handlers, 1);
    assert.deepEqual(config.positionals, parsed._);
    assert.deepEqual(config.positionals, ['collect']);
    assert.equal(config.url, 'https://example.com/product');
    assert.equal(Object.hasOwn(config, '_'), false);
    assert.equal(Object.hasOwn(config, '$0'), false);
  });

  it('copies the positional array rather than sharing it with yargs callbacks', () => {
    let parsed;
    const config = run(['compare', 'first'], {
      includePositionals: true,
      yargs: ({ yargs }) =>
        configure({ yargs }).check((argv) => {
          parsed = argv;
          return true;
        }),
    });
    assert.notEqual(config.positionals, parsed._);
    parsed._.push('later');
    assert.deepEqual(config.positionals, ['compare', 'first']);
  });

  it('keeps existing positionals options when the feature is disabled', () => {
    for (const settings of [{}, { includePositionals: false }]) {
      assert.deepEqual(run(['--positionals', 'option', 'collect'], settings), {
        positionals: 'option',
      });
    }
  });

  it('rejects a result key or alias that collides with enabled positionals', () => {
    for (const yargs of [
      ({ yargs }) =>
        configure({ yargs }).option('positionals', { type: 'string' }),
      ({ yargs }) =>
        configure({ yargs }).option('target', {
          type: 'string',
          alias: 'positionals',
        }),
      ({ yargs }) =>
        configure({ yargs }).option('POSITIONALS', {
          type: 'string',
          default: 'private',
        }),
    ]) {
      assert.throws(
        () =>
          run(['--positionals', 'private', 'collect'], {
            includePositionals: true,
            yargs,
          }),
        (error) => /positionals.*reserved/i.test(error.message)
      );
    }
  });
});
