import {
  parseLinoArguments,
  createYargsConfig,
  applyLinoEnv,
} from '../index.js';

/**
 * Basic usage example showing how to parse links notation arguments
 * and use them with yargs
 */

console.log('=== Basic lino-arguments Usage ===\n');

// Example 1: Parse links notation format
console.log('1. Parsing links notation arguments:');
const linoString = `(
  --verbose
  --port 3000
  --host localhost
)`;

const args = parseLinoArguments(linoString);
console.log('Input:', linoString);
console.log('Parsed:', args);
console.log();

// Example 2: Use with yargs
console.log('2. Using parsed arguments with yargs:');
const yargsInstance = createYargsConfig(['node', 'script.js', ...args]).option(
  'verbose',
  {
    alias: 'v',
    type: 'boolean',
    description: 'Run with verbose logging',
    default: false,
  }
);

yargsInstance.option('port', {
  alias: 'p',
  type: 'number',
  description: 'Port to run on',
  default: 8080,
});

yargsInstance.option('host', {
  alias: 'h',
  type: 'string',
  description: 'Host to bind to',
  default: '0.0.0.0',
});

const parsedArgs = yargsInstance.parse();
console.log('Parsed with yargs:', {
  verbose: parsedArgs.verbose,
  port: parsedArgs.port,
  host: parsedArgs.host,
});
console.log();

// Example 3: Apply .lenv file (if exists)
console.log('3. Loading environment from .lenv file:');
console.log('Note: Create a .lenv file with format:');
console.log('API_KEY: your_api_key_here');
console.log('DATABASE_URL: postgresql://localhost/mydb');
console.log();

// This would load .lenv if it exists
const envVars = applyLinoEnv('.lenv');
console.log('Loaded environment variables:', Object.keys(envVars).join(', '));
