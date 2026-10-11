import { describe, it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Parser as ConsumerParser } from 'links-notation';
import { LinoEnv as ConsumerLinoEnv } from 'lino-env';
import {
  Parser,
  LinoEnv,
  parseLinoArguments,
  makeConfig,
  applyLinoEnv,
} from '../src/index.js';

const configure = ({ yargs }) =>
  yargs
    .exitProcess(false)
    .help(false)
    .version(false)
    .option('port', { type: 'number', default: 3000 })
    .option('verbose', { type: 'boolean', default: true })
    .option('label', { type: 'string', default: 'fallback' });

describe('maintained grammar interoperability', () => {
  it('reexports the consumer parser and environment classes unchanged', () => {
    assert.equal(Parser, ConsumerParser);
    assert.equal(LinoEnv, ConsumerLinoEnv);
    const [link] = new Parser().parse('(port: 8080)');
    assert.equal(link.id, 'port');
    assert.equal(link.values[0].id, '8080');
  });

  for (const [name, text, expected] of [
    ['inline', '(--port 8080 --verbose)', ['--port', '8080', '--verbose']],
    [
      'nested multiline groups',
      '(\n  (--port 8080)\n  (\n    --label "Hà Nội room"\n    --verbose false\n  )\n)',
      ['--port', '8080', '--label', 'Hà Nội room', '--verbose', 'false'],
    ],
    ['indexed links', '(--port: 8080)', ['--port', '8080']],
    [
      'comments and embedded hashes',
      '# heading\n--label room#2 # note\n--port 8080',
      ['--label', 'room#2', '--port', '8080'],
    ],
    [
      'quoted values',
      `(--label 'room: two beds' --port "8080")`,
      ['--label', 'room: two beds', '--port', '8080'],
    ],
  ]) {
    it(`preserves flat arguments from ${name}`, () => {
      assert.deepEqual(parseLinoArguments(text), expected);
    });
  }

  it('passes parsed notation tokens to the CLI with types and precedence', () => {
    const args = parseLinoArguments(
      '(\n  (--port 9090)\n  (--label "two beds")\n  (--verbose false)\n)'
    );
    const config = makeConfig({
      env: { values: { PORT: '8080', LABEL: 'environment' }, autoMap: true },
      lenv: { enabled: false },
      argv: ['node', 'tool.js', ...args],
      yargs: configure,
    });
    assert.deepEqual(config, { port: 9090, label: 'two beds', verbose: false });
  });

  it('retains the legacy line fallback on invalid notation', () => {
    assert.throws(() => new Parser().parse('(--port 8080'));
    assert.deepEqual(parseLinoArguments('(--port 8080'), ['(--port 8080']);
  });

  it('roundtrips lenv strings without interpreting them as grammar tokens', () => {
    const directory = mkdtempSync(join(tmpdir(), 'lino-grammar-roundtrip-'));
    const path = join(directory, '.lenv');
    const values = {
      LABEL: '  Hà Nội: two beds # literal  ',
      URL: 'https://example.test/room?beds=2',
      QUOTED: '"keep these quotes"',
      EMPTY: '',
      PORT: '8080',
      VERBOSE: 'false',
    };
    try {
      const env = new LinoEnv(path);
      for (const [key, value] of Object.entries(values)) {
        env.set(key, value);
      }
      env.write();
      assert.deepEqual(new LinoEnv(path).read().toObject(), values);
      const config = makeConfig({
        env: { values: {}, autoMap: true },
        cwd: directory,
        argv: ['node', 'tool.js'],
        yargs: configure,
      });
      assert.deepEqual(config, {
        port: 8080,
        verbose: false,
        label: values.LABEL,
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('preserves lenv, selected file, environment and CLI priority', () => {
    const directory = mkdtempSync(join(tmpdir(), 'lino-grammar-priority-'));
    try {
      writeFileSync(join(directory, '.lenv'), 'PORT: 4000\nLABEL: base\n');
      writeFileSync(
        join(directory, 'selected.lenv'),
        '# comment\nPORT: 5000\nPORT: 6000\nVERBOSE: false\n'
      );
      const run = (env, args = []) =>
        makeConfig({
          env: { values: env, autoMap: true },
          cwd: directory,
          argv: ['node', 'tool.js', '-c', 'selected.lenv', ...args],
          yargs: configure,
        });
      assert.equal(run({}).port, 6000);
      assert.equal(run({}).label, 'base');
      assert.equal(run({}).verbose, false);
      assert.equal(run({ PORT: '7000' }).port, 7000);
      assert.equal(run({ PORT: '7000' }, ['--port', '8000']).port, 8000);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('keeps the explicit process exporter override behavior', () => {
    const directory = mkdtempSync(join(tmpdir(), 'lino-grammar-export-'));
    const key = 'LINO_GRAMMAR_INTEROP_LABEL';
    const previous = process.env[key];
    try {
      const path = join(directory, '.lenv');
      writeFileSync(path, `${key}: two beds\n`);
      process.env[key] = 'existing';
      assert.deepEqual(applyLinoEnv(path, { quiet: true }), {});
      assert.equal(process.env[key], 'existing');
      assert.deepEqual(applyLinoEnv(path, { quiet: true, override: true }), {
        [key]: 'two beds',
      });
      assert.equal(process.env[key], 'two beds');
    } finally {
      if (previous === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous;
      }
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
