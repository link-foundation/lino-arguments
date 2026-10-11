import { makeConfig } from '../src/index.js';

// Run: node js/examples/positional-commands.js collect https://example.com/product
// Run: node js/examples/positional-commands.js compare --verbose
// Run: node js/examples/positional-commands.js export "my products.csv"
const config = makeConfig({
  env: {},
  lenv: { enabled: false },
  includePositionals: true,
  yargs: ({ yargs }) =>
    yargs
      .exitProcess(false)
      .help(false)
      .version(false)
      .option('verbose', { type: 'boolean', default: false })
      .command('collect <url>', 'Collect a product', (parser) =>
        parser.positional('url', { type: 'string' })
      )
      .command('compare', 'Compare collected products')
      .command('export <file>', 'Export collected products', (parser) =>
        parser.positional('file', { type: 'string' })
      )
      .demandCommand(1)
      .strict(),
});

const [command] = config.positionals;
console.log(JSON.stringify({ command, config }, null, 2));
