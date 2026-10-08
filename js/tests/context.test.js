import { describe, it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeConfig, getenv } from '../src/index.js';

const argv = ['node', 'app.js'];
const options = ({ yargs }) =>
  yargs
    .exitProcess(false)
    .option('port', { type: 'number', default: 3000 })
    .option('verbose', { type: 'boolean', default: true })
    .option('api-key', { type: 'string', default: 'fallback' });

describe('isolated configuration contexts', () => {
  it('keeps two frozen environments and directories independent', () => {
    const directory = mkdtempSync(join(tmpdir(), 'lino-context-'));
    const before = { ...process.env };
    const workingDirectory = process.cwd();
    try {
      for (const [name, port] of [
        ['first', 10],
        ['second', 20],
      ]) {
        mkdirSync(join(directory, name));
        writeFileSync(join(directory, name, '.lenv'), `PORT: ${port}\n`);
      }
      const run = (name, env) =>
        makeConfig({
          env,
          cwd: join(directory, name),
          argv,
          yargs: ({ yargs, getenv }) =>
            yargs.option('port', {
              type: 'number',
              default: getenv('PORT', 1),
            }),
        });
      assert.equal(run('first', Object.freeze({})).port, 10);
      assert.equal(run('second', Object.freeze({ PORT: '30' })).port, 30);
      assert.equal(run('first', Object.freeze({})).port, 10);
      assert.equal(
        Object.keys(process.env).length === Object.keys(before).length &&
          Object.entries(before).every(
            ([key, value]) => process.env[key] === value
          ),
        true,
        'host environment changed'
      );
      assert.equal(process.cwd(), workingDirectory);
    } finally {
      rmSync(directory, { recursive: true, force: true });
      process.env = before;
    }
  });

  it('uses argv > env > selected lenv > default lenv > defaults', () => {
    const directory = mkdtempSync(join(tmpdir(), 'lino-precedence-'));
    try {
      writeFileSync(join(directory, '.lenv'), 'PORT: 10\nAPI_KEY: base\n');
      writeFileSync(join(directory, 'custom.lenv'), 'PORT: 20\n');
      const run = (env, extra = []) =>
        makeConfig({
          env: { values: env, autoMap: true },
          cwd: directory,
          argv: [...argv, '-c', 'custom.lenv', ...extra],
          yargs: options,
        });
      assert.equal(run({}).port, 20);
      assert.equal(run({ port: '0' }).port, 0);
      assert.equal(run({ PORT: '30' }, ['--port', '40']).port, 40);
      assert.equal(run({}).apiKey, 'base');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('supports an injected standalone getenv and preserves falsy values', () => {
    const env = Object.freeze({ PORT: 0, VERBOSE: false, API_KEY: '' });
    assert.equal(getenv('port', 1, { env }), 0);
    assert.equal(getenv('verbose', true, { env }), false);
    assert.equal(getenv('apiKey', 'fallback', { env }), '');
    assert.equal(getenv('missing', 'fallback', { env: {} }), 'fallback');
  });

  it('rejects normalized aliases without disclosing their values', () => {
    assert.throws(
      () =>
        makeConfig({
          env: {
            values: { API_KEY: 'private-one', apiKey: 'private-two' },
            autoMap: true,
          },
          argv,
          lenv: { enabled: false },
          yargs: options,
        }),
      (error) =>
        /ambiguous/i.test(error.message) && !/private/.test(error.message)
    );
  });

  it('retains empty legacy env values when override is disabled', () => {
    const directory = mkdtempSync(join(tmpdir(), 'lino-legacy-'));
    const before = { ...process.env };
    try {
      process.env.LINO_CONTEXT_EMPTY = '';
      const path = join(directory, '.lenv');
      writeFileSync(path, 'LINO_CONTEXT_EMPTY: replacement\n');
      makeConfig({ lenv: { path, override: false, quiet: true }, argv });
      assert.equal(process.env.LINO_CONTEXT_EMPTY, '');
    } finally {
      process.env = before;
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe('selective option environment mapping', () => {
  it('maps typed options only, including decimals, false, zero and empty', () => {
    const config = makeConfig({
      env: {
        values: {
          PORT: '1.5',
          VERBOSE: '0',
          API_KEY: '',
          UNRELATED: 'ignored',
        },
        autoMap: true,
      },
      argv,
      lenv: { enabled: false },
      yargs: options,
    });
    assert.equal(config.port, 1.5);
    assert.equal(config.verbose, false);
    assert.equal(config.apiKey, '');
    assert.equal(config.unrelated, undefined);
  });

  it('supports bulk options, renamed variables, disabling mapping and aliases', () => {
    const config = makeConfig({
      env: {
        values: { START_URL: 'from-env', VERBOSE: 'false' },
        autoMap: true,
      },
      argv: [...argv, '-u', 'cli'],
      lenv: { enabled: false },
      yargs: ({ yargs }) =>
        yargs.options({
          'start-url': {
            type: 'string',
            alias: 'u',
            env: 'START_URL',
            default: 'fallback',
          },
          verbose: { type: 'boolean', env: false, default: true },
        }),
    });
    assert.equal(config.startUrl, 'cli');
    assert.equal(config.verbose, true);
    const renamed = makeConfig({
      env: { APP_URL: 'renamed' },
      argv,
      lenv: { enabled: false },
      yargs: ({ yargs }) =>
        yargs.option('start-url', { type: 'string', env: 'APP_URL' }),
    });
    assert.equal(renamed.startUrl, 'renamed');
  });

  it('supports shorthand declarations and commands with local options', () => {
    const config = makeConfig({
      env: { values: { PORT: '42' }, autoMap: true },
      argv: [...argv, 'serve'],
      lenv: { enabled: false },
      yargs: ({ yargs }) =>
        yargs.command('serve', 'serve', (parser) =>
          parser.number('port').default('port', 10)
        ),
    });
    assert.equal(config.port, 42);
  });

  it('is opt-in and rejects invalid typed values without their contents', () => {
    assert.equal(
      makeConfig({
        env: { PORT: '20' },
        argv,
        lenv: { enabled: false },
        yargs: options,
      }).port,
      3000
    );
    assert.throws(
      () =>
        makeConfig({
          env: { values: { PORT: 'private-invalid' }, autoMap: true },
          argv,
          lenv: { enabled: false },
          yargs: options,
        }),
      (error) =>
        /invalid/i.test(error.message) && !/private-invalid/.test(error.message)
    );
  });
});

describe('allowlisted secret files', () => {
  const run = (env, secrets, extra = []) =>
    makeConfig({
      env: { values: env, autoMap: true },
      secrets,
      cwd: '/context',
      argv: [...argv, ...extra],
      lenv: { enabled: false },
      yargs: options,
    });

  it('reads only requested keys and strips exactly one terminal newline', () => {
    const paths = [];
    const config = run(
      { API_KEY_FILE: 'key', UNRELATED_FILE: 'never' },
      {
        keys: ['API_KEY'],
        readFile: (path, { maxBytes }) => {
          paths.push(path);
          assert.equal(maxBytes, 65536);
          return '  private\n\r\n';
        },
      }
    );
    assert.equal(config.apiKey, '  private\n');
    assert.equal(paths.length, 1);
    assert.match(paths[0], /context[/\\]key$/);
    assert.equal(
      run(
        { API_KEY_FILE: 'key' },
        { keys: ['API_KEY'], newline: 'preserve', readFile: () => 'x\n' }
      ).apiKey,
      'x\n'
    );
  });

  it('supports custom file variables and preserves empty file contents', () => {
    assert.equal(
      run(
        { TOKEN_PATH: 'key' },
        {
          keys: { API_KEY: 'TOKEN_PATH' },
          readFile: () => '',
        }
      ).apiKey,
      ''
    );
  });

  it('uses explicit conflict policies, including empty direct values', () => {
    const env = { API_KEY: '', API_KEY_FILE: 'key' };
    assert.throws(
      () => run(env, { keys: ['API_KEY'], readFile: () => 'secret' }),
      /conflict/i
    );
    assert.equal(
      run(env, {
        keys: ['API_KEY'],
        conflict: 'value',
        readFile: () => assert.fail('unused'),
      }).apiKey,
      ''
    );
    assert.equal(
      run(env, {
        keys: ['API_KEY'],
        conflict: 'file',
        readFile: () => 'secret',
      }).apiKey,
      'secret'
    );
  });

  it('skips overridden files and conflicts for CLI values and later aliases', () => {
    assert.equal(
      run(
        { API_KEY_FILE: 'missing' },
        {
          keys: ['API_KEY'],
          readFile: () => assert.fail('CLI should win'),
        },
        ['--api-key', 'cli']
      ).apiKey,
      'cli'
    );
    const config = makeConfig({
      env: { values: { API_KEY_FILE: 'missing' }, autoMap: true },
      argv: [...argv, '-k', 'cli'],
      lenv: { enabled: false },
      secrets: {
        keys: ['API_KEY'],
        readFile: () => assert.fail('alias should win'),
      },
      yargs: ({ yargs }) =>
        yargs.option('api-key', { type: 'string' }).alias('api-key', 'k'),
    });
    assert.equal(config.apiKey, 'cli');
  });

  it('rejects missing/unreadable/oversized secrets without reader details', () => {
    for (const readFile of [
      () => {
        throw new Error('ENOENT private-path private-value');
      },
      () => {
        throw new Error('EACCES private-value');
      },
      () => 'éé',
    ]) {
      assert.throws(
        () =>
          run(
            { API_KEY_FILE: 'private-path' },
            {
              keys: ['API_KEY'],
              maxBytes: 3,
              readFile,
            }
          ),
        (error) => !/private-path|private-value|é/.test(error.message)
      );
    }
    assert.throws(
      () => run({ API_KEY_FILE: 'key' }, { keys: ['API_KEY'], maxBytes: 0 }),
      /maxBytes/
    );
  });

  it('uses bounded real filesystem reading and redacts yargs failures', () => {
    const directory = mkdtempSync(join(tmpdir(), 'lino-secret-'));
    try {
      writeFileSync(join(directory, 'key'), 'secret\r\n');
      const config = makeConfig({
        env: { values: { API_KEY_FILE: 'key' }, autoMap: true },
        cwd: directory,
        argv,
        lenv: { enabled: false },
        secrets: { keys: ['API_KEY'] },
        yargs: options,
      });
      assert.equal(config.apiKey, 'secret');
      assert.equal(
        getenv('API_KEY', '', {
          env: { API_KEY_FILE: 'key' },
          cwd: directory,
          secrets: { keys: ['API_KEY'] },
        }),
        'secret'
      );
      assert.throws(
        () =>
          makeConfig({
            env: { values: { API_KEY_FILE: 'key' }, autoMap: true },
            cwd: directory,
            argv,
            lenv: { enabled: false },
            secrets: { keys: ['API_KEY'], maxBytes: 2 },
            yargs: options,
          }),
        /size/i
      );
      assert.throws(
        () =>
          makeConfig({
            env: { values: { API_KEY_FILE: 'missing' }, autoMap: true },
            cwd: directory,
            argv,
            lenv: { enabled: false },
            secrets: { keys: ['API_KEY'] },
            yargs: options,
          }),
        /read/i
      );
      assert.throws(
        () =>
          makeConfig({
            env: { values: { API_KEY_FILE: 'key' }, autoMap: true },
            cwd: directory,
            argv,
            lenv: { enabled: false },
            secrets: { keys: ['API_KEY'] },
            yargs: ({ yargs }) =>
              yargs.option('api-key', { type: 'string', choices: ['allowed'] }),
          }),
        (error) => !/secret/.test(error.message)
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe('additional precedence and alias regressions', () => {
  it('counts actual keys when the host environment lookup ignores case', () => {
    const previous = process.env;
    process.env = new Proxy(
      { TEST_VAR: '7' },
      {
        get: (target, key) =>
          Object.entries(target).find(
            ([name]) => name.toLowerCase() === String(key).toLowerCase()
          )?.[1],
      }
    );
    try {
      assert.equal(getenv('testVar', 1), 7);
    } finally {
      process.env = previous;
    }
  });

  it('keeps built-in help/version flags out of environment mapping and redaction', () => {
    const warnings = [];
    const original = process.emitWarning;
    process.emitWarning = (message) => warnings.push(String(message));
    try {
      const config = makeConfig({
        env: { values: { VERSION: 'private-version' }, autoMap: true },
        argv,
        lenv: { enabled: false },
        secrets: { keys: ['API_KEY'] },
        yargs: options,
      });
      assert.equal(config.version, undefined);
      assert.equal(
        makeConfig({
          env: { values: { VERSION: 'application' }, autoMap: true },
          argv,
          lenv: { enabled: false },
          yargs: ({ yargs }) =>
            yargs.version(false).option('version', { type: 'string' }),
        }).version,
        'application'
      );
      assert.deepEqual(warnings, []);
    } finally {
      process.emitWarning = original;
    }
  });

  it('keeps absent injected variables independent of host values', () => {
    const previous = process.env.LINO_HOST_ONLY;
    process.env.LINO_HOST_ONLY = 'host';
    try {
      assert.equal(
        makeConfig({
          env: {},
          lenv: { enabled: false },
          argv,
          yargs: ({ yargs, getenv }) =>
            yargs.option('value', {
              default: getenv('LINO_HOST_ONLY', 'isolated'),
            }),
        }).value,
        'isolated'
      );
      assert.throws(
        () =>
          makeConfig({
            env: {},
            lenv: { enabled: false },
            argv,
            yargs: ({ yargs }) => yargs.env(''),
          }),
        /host/
      );
    } finally {
      if (previous === undefined) {
        delete process.env.LINO_HOST_ONLY;
      } else {
        process.env.LINO_HOST_ONLY = previous;
      }
    }
  });

  it('maps camelCase CLI aliases and boolean negation with priority', () => {
    const config = makeConfig({
      env: {
        values: { API_KEY_FILE: 'unused', VERBOSE: 'true' },
        autoMap: true,
      },
      secrets: { keys: ['API_KEY'], readFile: () => assert.fail('unused') },
      lenv: { enabled: false },
      argv: [...argv, '--apiKey', 'cli', '--no-verbose'],
      yargs: options,
    });
    assert.equal(config.apiKey, 'cli');
    assert.equal(config.verbose, false);
  });

  it('rejects conflicting option names and shared CLI aliases', () => {
    assert.throws(
      () =>
        makeConfig({
          env: {},
          argv,
          lenv: { enabled: false },
          yargs: ({ yargs }) =>
            yargs
              .option('api-key', { type: 'string' })
              .option('apiKey', { type: 'string' }),
        }),
      /ambiguous/i
    );
    assert.throws(
      () =>
        makeConfig({
          env: {},
          argv,
          lenv: { enabled: false },
          yargs: ({ yargs }) =>
            yargs
              .option('first', { alias: 'a' })
              .option('second', { alias: 'a' }),
        }),
      /ambiguous/i
    );
  });

  it('uses independent real secret files and source precedence', () => {
    const directory = mkdtempSync(join(tmpdir(), 'lino-file-context-'));
    try {
      for (const name of ['first', 'second']) {
        mkdirSync(join(directory, name));
        writeFileSync(join(directory, name, '.lenv'), 'API_KEY_FILE: key\n');
        writeFileSync(join(directory, name, 'key'), `${name}\n`);
      }
      const run = (name, env) =>
        makeConfig({
          env: { values: env, autoMap: true },
          cwd: join(directory, name),
          argv,
          secrets: { keys: ['API_KEY'] },
          yargs: options,
        });
      assert.equal(run('first', {}).apiKey, 'first');
      assert.equal(run('second', {}).apiKey, 'second');
      assert.equal(run('first', { API_KEY: '' }).apiKey, '');
      assert.equal(run('first', {}).apiKey, 'first');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('retains explicit mappings inside object and array command builders', () => {
    for (const command of [
      {
        command: 'serve',
        builder: { url: { type: 'string', env: 'APP_URL' } },
      },
      [
        {
          command: 'serve',
          builder: (yargs) =>
            yargs.option('url', { type: 'string', env: 'APP_URL' }),
        },
      ],
    ]) {
      assert.equal(
        makeConfig({
          env: { APP_URL: 'mapped' },
          argv: [...argv, 'serve'],
          lenv: { enabled: false },
          yargs: ({ yargs }) => yargs.command(command),
        }).url,
        'mapped'
      );
    }
  });

  it('redacts help defaults from manual secret getenv calls', () => {
    const messages = [];
    const original = console.log;
    console.log = (...args) => messages.push(args.join(' '));
    try {
      makeConfig({
        env: { TOKEN_FILE: 'path' },
        argv: [...argv, '--help'],
        lenv: { enabled: false },
        secrets: { keys: ['TOKEN'], readFile: () => 'private-help-value' },
        yargs: ({ yargs, getenv }) =>
          yargs
            .exitProcess(false)
            .option('token', { type: 'string', default: getenv('TOKEN') }),
      });
      assert.equal(messages.join(' ').includes('private-help-value'), false);
    } finally {
      console.log = original;
    }
  });
});
