import { mergeAndParse, parseEnvArguments } from '../index.js';

/**
 * Advanced usage example demonstrating the full power of lino-arguments
 * This shows how to merge configuration from multiple sources:
 * 1. .lenv files (environment configuration)
 * 2. Environment variable overrides (using links notation)
 * 3. Command-line arguments
 */

console.log('=== Advanced lino-arguments Usage ===\n');

// Example 1: Parse environment variable overrides
console.log('1. Parsing overrides from environment variables:');
console.log('Set: export CLI_OVERRIDES="--debug\\n--port 9000"');

// Simulate environment variable
process.env.CLI_OVERRIDES = `(
  --debug
  --trace
  --output ./logs
)`;

const overrides = parseEnvArguments('CLI_OVERRIDES');
console.log('Parsed overrides:', overrides);
console.log();

// Example 2: Merge all sources
console.log('2. Merging configuration from multiple sources:');

async function runApp() {
  const config = await mergeAndParse({
    // Configure yargs with all your options
    yargsConfig: (yargs) =>
      yargs
        .option('debug', {
          type: 'boolean',
          description: 'Enable debug mode',
          default: false,
        })
        .option('trace', {
          type: 'boolean',
          description: 'Enable trace logging',
          default: false,
        })
        .option('port', {
          type: 'number',
          description: 'Server port',
          default: 3000,
        })
        .option('output', {
          type: 'string',
          description: 'Output directory',
          default: './output',
        })
        .option('env', {
          type: 'string',
          description: 'Environment',
          default: 'development',
        }),

    // Load from .lenv file (if it exists)
    lenvPath: '.lenv',

    // Parse overrides from environment variable
    overridesEnvVar: 'CLI_OVERRIDES',

    // Additional arguments from code
    additionalArgs: ['--env', 'production'],

    // Apply .lenv to process.env
    applyEnvToProcess: true,
  });

  console.log('\nMerged configuration:');
  console.log('  Debug:', config.debug);
  console.log('  Trace:', config.trace);
  console.log('  Port:', config.port);
  console.log('  Output:', config.output);
  console.log('  Environment:', config.env);

  return config;
}

// Example 3: Simulate a real CLI application
console.log('\n3. Simulating a real CLI application:');

async function startServer() {
  try {
    const config = await runApp();

    console.log('\n--- Server Starting ---');
    console.log(`Environment: ${config.env}`);
    console.log(`Port: ${config.port}`);
    console.log(`Output Directory: ${config.output}`);
    console.log(`Debug Mode: ${config.debug ? 'ON' : 'OFF'}`);
    console.log(`Trace Mode: ${config.trace ? 'ON' : 'OFF'}`);
    console.log('--- Server Configuration Complete ---\n');

    // Here you would actually start your server with this config
    console.log(
      'In a real application, you would now start your server with this configuration.'
    );
  } catch (error) {
    console.error('Error starting server:', error.message);
    process.exit(1);
  }
}

startServer();
