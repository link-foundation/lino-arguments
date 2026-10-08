import { makeConfig } from '../src/index.js';

// Generic schema: application code owns settings, the library owns resolution.
const schema = ({ yargs }) =>
  yargs
    .option('port', { type: 'number', default: 3000 })
    .option('verbose', { type: 'boolean', default: true })
    .option('api-key', { type: 'string' });

const create = (values, extra = []) =>
  makeConfig({
    env: { values, autoMap: true },
    cwd: '/application',
    argv: ['node', 'app.js', ...extra],
    lenv: { enabled: false },
    secrets: {
      keys: ['API_KEY'],
      readFile: () => 'generic-fixture\n',
    },
    yargs: schema,
  });

const first = create({ PORT: '0', VERBOSE: 'false', API_KEY_FILE: 'key' });
const second = create({ PORT: '8080' }, ['--api-key', 'cli-fixture']);
// Print application settings only; avoid logging secrets.
console.log({
  firstPort: first.port,
  secondPort: second.port,
  verbose: first.verbose,
});
