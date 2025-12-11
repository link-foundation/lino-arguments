import { makeConfig } from '../src/index.js';
import assert from 'assert';

console.log('Testing custom --version option...');

const config = makeConfig({
  yargs: ({ yargs }) =>
    yargs.option('version', {
      type: 'string',
      default: '',
      describe: 'Version number (e.g., 1.0.0)',
    }),
  argv: ['node', 'script.js', '--version', '1.0.0'],
});

console.log('config.version:', config.version);
console.log('typeof config.version:', typeof config.version);

try {
  assert.strictEqual(config.version, '1.0.0');
  assert.strictEqual(typeof config.version, 'string');
  console.log('✅ Test PASSED');
} catch (err) {
  console.log('❌ Test FAILED:', err.message);
  process.exit(1);
}
