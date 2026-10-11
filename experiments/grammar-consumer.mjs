// Copied into a fresh production-only consumer by test-latest-grammar-consumer.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Parser as RootParser } from 'links-notation';
import {
  Parser,
  LinoEnv,
  makeConfig,
  parseLinoArguments,
  applyLinoEnv,
} from 'lino-arguments';

assert.equal(Parser, RootParser, 'Consumer and library must share the parser');
const require = createRequire(import.meta.url);
const libraryRequire = createRequire(require.resolve('lino-arguments'));
assert.equal(
  require.resolve('links-notation'),
  libraryRequire.resolve('links-notation'),
  'The modern grammar must be deduplicated between consumer and library'
);
const [link] = new Parser().parse('(room: two beds)');
assert.equal(link.id, 'room');
assert.deepEqual(
  link.values.map((value) => value.id),
  ['two', 'beds']
);

const env = new LinoEnv('.lenv');
env.set('PORT', '8080').set('LABEL', '  Hà Nội: two beds # literal  ').write();
assert.deepEqual(new LinoEnv('.lenv').read().toObject(), {
  PORT: '8080',
  LABEL: '  Hà Nội: two beds # literal  ',
});
writeFileSync('selected.lenv', 'PORT: 8181\nVERBOSE: false\n');
const run = (values, extra = []) =>
  makeConfig({
    env: { values, autoMap: true },
    argv: ['node', 'tool.js', '-c', 'selected.lenv', ...extra],
    yargs: ({ yargs }) =>
      yargs
        .exitProcess(false)
        .help(false)
        .version(false)
        .option('port', { type: 'number', default: 3000 })
        .option('verbose', { type: 'boolean', default: true })
        .option('label', { type: 'string' }),
  });
assert.equal(run({}).port, 8181);
assert.equal(run({}).label, '  Hà Nội: two beds # literal  ');
assert.equal(run({}).verbose, false);
assert.equal(run({ PORT: '8282' }).port, 8282);
const args = parseLinoArguments(
  '(\n  (--port 9090)\n  (--label "two beds")\n  (--verbose false)\n)'
);
assert.deepEqual(args, [
  '--port',
  '9090',
  '--label',
  'two beds',
  '--verbose',
  'false',
]);
const config = run({ PORT: '8282' }, args);
assert.equal(config.port, 9090);
assert.equal(config.label, 'two beds');
assert.equal(config.verbose, false);

writeFileSync('export.lenv', 'LINO_GRAMMAR_CONSUMER_LABEL: exported\n');
delete process.env.LINO_GRAMMAR_CONSUMER_LABEL;
assert.deepEqual(applyLinoEnv('export.lenv', { quiet: true }), {
  LINO_GRAMMAR_CONSUMER_LABEL: 'exported',
});
assert.equal(process.env.LINO_GRAMMAR_CONSUMER_LABEL, 'exported');
console.log('Packed consumer parser, CLI, lenv roundtrip and precedence pass.');
