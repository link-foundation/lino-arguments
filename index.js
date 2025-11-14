import { Parser } from 'links-notation';
import { LinoEnv } from 'lino-env';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

/**
 * lino-arguments - A setup of Links Notation Environment (lenv) + yargs
 *
 * This library provides a unified configuration approach that combines:
 * - .lenv files (using lino-env)
 * - Links notation format (using links-notation)
 * - Command-line arguments (using yargs)
 */

/**
 * Parse arguments from links notation format
 * Converts links notation strings into an array of CLI arguments
 *
 * @param {string} linoString - String in links notation format
 * @returns {string[]} Array of parsed arguments
 *
 * @example
 * parseLinoArguments('(\n  --verbose\n  --port 3000\n)')
 * // Returns: ['--verbose', '--port', '3000']
 */
export function parseLinoArguments(linoString) {
  if (!linoString || typeof linoString !== 'string') {
    return [];
  }

  const parser = new Parser();

  try {
    const parsed = parser.parse(linoString);

    // Extract arguments from parsed links
    const args = [];

    for (const link of parsed) {
      if (link.id) {
        args.push(link.id);
      }

      if (link.values && Array.isArray(link.values)) {
        for (const value of link.values) {
          if (value && value.id) {
            args.push(value.id);
          } else if (typeof value === 'string') {
            args.push(value);
          }
        }
      }
    }

    return args.filter(
      (arg) => arg && arg.trim() && !arg.trim().startsWith('#')
    );
  } catch (_error) {
    // If parsing fails, fall back to simple line-based parsing
    return linoString
      .split('\n')
      .map((line) => line.trim())
      .filter(
        (line) => line && !line.startsWith('#') && line !== '(' && line !== ')'
      );
  }
}

/**
 * Load environment configuration from a .lenv file
 *
 * @param {string} filePath - Path to the .lenv file (default: '.lenv')
 * @returns {LinoEnv} LinoEnv instance with loaded data
 *
 * @example
 * const env = loadLinoEnv('.lenv');
 * const apiKey = env.get('API_KEY');
 */
export function loadLinoEnv(filePath = '.lenv') {
  const env = new LinoEnv(filePath);
  env.read();
  return env;
}

/**
 * Apply .lenv configuration to process.env
 * This makes environment variables from .lenv available via process.env
 *
 * @param {string} filePath - Path to the .lenv file (default: '.lenv')
 * @param {Object} options - Options for applying configuration
 * @param {boolean} options.override - Whether to override existing process.env values (default: false)
 * @returns {Object} Object containing all loaded environment variables
 *
 * @example
 * applyLinoEnv('.lenv', { override: false });
 */
export function applyLinoEnv(filePath = '.lenv', options = {}) {
  const { override = false } = options;

  try {
    const env = loadLinoEnv(filePath);
    const envObject = env.toObject();

    for (const [key, value] of Object.entries(envObject)) {
      if (override || !process.env[key]) {
        process.env[key] = value;
      }
    }

    return envObject;
  } catch (_error) {
    // If .lenv file doesn't exist or can't be read, return empty object
    return {};
  }
}

/**
 * DEPRECATED: Load dotenvx configuration
 *
 * @deprecated Use Links Notation (.lenv files) for environment configuration instead.
 * @param {Object} options - Options to pass to dotenvx
 * @returns {Object} Result from dotenvx.config()
 *
 * @example
 * // DEPRECATED - use applyLinoEnv() instead
 * loadDotenvx();
 */
export function loadDotenvx(options = {}) {
  console.warn(
    '⚠️  DEPRECATED: loadDotenvx() is deprecated. ' +
      'Please use Links Notation (.lenv files) for environment configuration instead. ' +
      'Use applyLinoEnv() to load .lenv files.'
  );

  try {
    // Dynamic import to support optional dependency
    return import('@dotenvx/dotenvx').then((module) => module.config(options));
  } catch (error) {
    console.error(
      'dotenvx is not installed. Install it with: npm install @dotenvx/dotenvx'
    );
    throw error;
  }
}

/**
 * Create a yargs instance pre-configured with lino-arguments helpers
 *
 * @param {string[]} argv - Command line arguments (default: process.argv)
 * @returns {Object} Configured yargs instance
 *
 * @example
 * const args = createYargsConfig()
 *   .option('verbose', {
 *     alias: 'v',
 *     type: 'boolean',
 *     description: 'Run with verbose logging'
 *   })
 *   .parse();
 */
export function createYargsConfig(argv = process.argv) {
  return yargs(hideBin(argv));
}

/**
 * Parse arguments from environment variable using links notation
 * Useful for reading configuration overrides from environment variables
 *
 * @param {string} envVarName - Name of the environment variable
 * @param {string} defaultValue - Default value if environment variable is not set
 * @returns {string[]} Parsed arguments array
 *
 * @example
 * // If process.env.CLI_OVERRIDES = '(\n  --debug\n  --port 8080\n)'
 * const overrides = parseEnvArguments('CLI_OVERRIDES');
 * // Returns: ['--debug', '--port', '8080']
 */
export function parseEnvArguments(envVarName, defaultValue = '') {
  const envValue = process.env[envVarName] || defaultValue;
  return parseLinoArguments(envValue);
}

/**
 * Merge multiple argument sources and parse with yargs
 * Combines .lenv files, environment variable overrides, and CLI arguments
 *
 * @param {Object} config - Configuration object
 * @param {Object} config.yargsConfig - Yargs configuration function
 * @param {string} config.lenvPath - Path to .lenv file (optional)
 * @param {string} config.overridesEnvVar - Environment variable name for overrides (optional)
 * @param {string[]} config.additionalArgs - Additional arguments to parse (optional)
 * @param {boolean} config.applyEnvToProcess - Apply .lenv to process.env (default: true)
 * @returns {Promise<Object>} Parsed arguments
 *
 * @example
 * const args = await mergeAndParse({
 *   yargsConfig: (yargs) => yargs
 *     .option('port', { type: 'number', default: 3000 })
 *     .option('verbose', { type: 'boolean', default: false }),
 *   lenvPath: '.lenv',
 *   overridesEnvVar: 'CLI_OVERRIDES',
 *   applyEnvToProcess: true
 * });
 */
export async function mergeAndParse(config) {
  const {
    yargsConfig,
    lenvPath = '.lenv',
    overridesEnvVar,
    additionalArgs = [],
    applyEnvToProcess = true,
  } = config;

  // Step 1: Apply .lenv configuration to process.env if requested
  if (lenvPath && applyEnvToProcess) {
    applyLinoEnv(lenvPath, { override: false });
  }

  // Step 2: Parse overrides from environment variable if specified
  const overrideArgs = overridesEnvVar
    ? parseEnvArguments(overridesEnvVar)
    : [];

  // Step 3: Merge all arguments
  const allArgs = [...additionalArgs, ...overrideArgs];

  // Step 4: Configure yargs
  const yargsInstance = createYargsConfig(
    allArgs.length > 0 ? ['node', 'script', ...allArgs] : process.argv
  );

  const configuredYargs = yargsConfig(yargsInstance);

  // Step 5: Parse and return
  return await configuredYargs.parse();
}

// Export all components for advanced usage
export { Parser } from 'links-notation';
export { LinoEnv } from 'lino-env';
export { yargs };
