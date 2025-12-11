import { Parser } from 'links-notation';
import { LinoEnv } from 'lino-env';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import baseGetenv from 'getenv';

/**
 * lino-arguments - A unified configuration library
 *
 * Combines Links Notation Environment (lenv), dotenvx, and yargs into a single
 * easy-to-use configuration system with clear priority ordering.
 *
 * Priority (highest to lowest):
 * 1. CLI arguments (manually entered options)
 * 2. getenv defaults (from process.env, set by previous steps)
 * 3. --configuration option (lenv file specified via CLI)
 * 4. .lenv file (local environment overrides)
 * 5. dotenvx/.env file (base configuration, DEPRECATED)
 */

// ============================================================================
// Case Conversion Utilities
// ============================================================================

/**
 * Convert string to UPPER_CASE (for environment variables)
 * @param {string} str - Input string
 * @returns {string} UPPER_CASE string
 */
export function toUpperCase(str) {
  // If already all uppercase, just replace separators
  if (str === str.toUpperCase()) {
    return str.replace(/[-\s]/g, '_');
  }

  return str
    .replace(/([A-Z])/g, '_$1') // PascalCase/camelCase
    .replace(/[-\s]/g, '_') // kebab-case/spaces
    .toUpperCase()
    .replace(/^_/, '') // Remove leading underscore
    .replace(/__+/g, '_'); // Remove double underscores
}

/**
 * Convert string to camelCase (for config object keys)
 * @param {string} str - Input string
 * @returns {string} camelCase string
 */
export function toCamelCase(str) {
  return str
    .toLowerCase()
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
    .replace(/^[A-Z]/, (c) => c.toLowerCase());
}

/**
 * Convert string to kebab-case (for CLI options)
 * @param {string} str - Input string
 * @returns {string} kebab-case string
 */
export function toKebabCase(str) {
  // If already all uppercase, handle specially
  if (str === str.toUpperCase() && str.includes('_')) {
    return str.replace(/_/g, '-').toLowerCase();
  }

  return str
    .replace(/([A-Z])/g, '-$1')
    .replace(/[_\s]/g, '-')
    .toLowerCase()
    .replace(/^-/, '')
    .replace(/--+/g, '-');
}

/**
 * Convert string to snake_case
 * @param {string} str - Input string
 * @returns {string} snake_case string
 */
export function toSnakeCase(str) {
  // If already all uppercase, just lowercase
  if (str === str.toUpperCase() && str.includes('_')) {
    return str.toLowerCase();
  }

  return str
    .replace(/([A-Z])/g, '_$1')
    .replace(/[-\s]/g, '_')
    .toLowerCase()
    .replace(/^_/, '')
    .replace(/__+/g, '_');
}

/**
 * Convert string to PascalCase
 * @param {string} str - Input string
 * @returns {string} PascalCase string
 */
export function toPascalCase(str) {
  return str
    .toLowerCase()
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
    .replace(/^[a-z]/, (c) => c.toUpperCase());
}

// ============================================================================
// Environment Variable Helper
// ============================================================================

/**
 * Get environment variable with default value and case conversion
 * Uses the official getenv npm package internally, with enhanced case-insensitive lookup.
 * Tries multiple case formats to find the variable.
 *
 * @param {string} key - Variable name (any case format)
 * @param {string|number|boolean} [defaultValue=''] - Default value if not found
 * @returns {string|number|boolean} Environment variable value or default (preserves type of default)
 *
 * @example
 * // Try to get API_KEY, apiKey, api-key, etc.
 * const apiKey = getenv('apiKey', 'default-key');
 * const port = getenv('PORT', 3000); // Returns number if env var is numeric
 */
export function getenv(key, defaultValue = '') {
  // Try different case formats
  const variants = [
    key, // Original
    toUpperCase(key), // UPPER_CASE
    toCamelCase(key), // camelCase
    toKebabCase(key), // kebab-case
    toSnakeCase(key), // snake_case
    toPascalCase(key), // PascalCase
  ];

  // Try to find the variable using any case variant
  for (const variant of variants) {
    if (process.env[variant] !== undefined) {
      // Use the official getenv package based on the type of defaultValue
      try {
        if (typeof defaultValue === 'number') {
          // Use getenv.int or getenv.float
          const isFloat = !Number.isInteger(defaultValue);
          return isFloat
            ? baseGetenv.float(variant, defaultValue)
            : baseGetenv.int(variant, defaultValue);
        }

        if (typeof defaultValue === 'boolean') {
          // Use getenv.boolish for flexible boolean parsing
          return baseGetenv.boolish(variant, defaultValue);
        }

        // Otherwise use getenv.string
        return baseGetenv.string(variant, defaultValue);
      } catch {
        // If getenv throws, return the default value
        return defaultValue;
      }
    }
  }

  return defaultValue;
}

// ============================================================================
// Lino-env Loading Functions
// ============================================================================

/**
 * Load environment configuration from a .lenv file
 *
 * @param {string} filePath - Path to the .lenv file (default: '.lenv')
 * @returns {LinoEnv|null} LinoEnv instance with loaded data, or null if failed
 */
function loadLinoEnv(filePath = '.lenv') {
  try {
    const env = new LinoEnv(filePath);
    env.read();
    return env;
  } catch {
    return null;
  }
}

/**
 * Apply .lenv configuration to process.env with case conversion
 * All values are stored as UPPER_CASE in process.env
 *
 * @param {string} filePath - Path to the .lenv file
 * @param {Object} options - Options for applying configuration
 * @param {boolean} options.override - Whether to override existing values (default: false)
 * @param {boolean} options.quiet - Suppress output (default: false)
 * @returns {Object} Object containing all loaded environment variables
 */
function applyLinoEnv(filePath = '.lenv', options = {}) {
  const { override = false, quiet = false } = options;

  try {
    const env = loadLinoEnv(filePath);
    if (!env) {
      return {};
    }

    const envObject = env.toObject();
    const loaded = {};

    for (const [key, value] of Object.entries(envObject)) {
      // Convert all keys to UPPER_CASE for process.env
      const upperKey = toUpperCase(key);

      if (override || !process.env[upperKey]) {
        process.env[upperKey] = value;
        loaded[upperKey] = value;
      }
    }

    if (!quiet && Object.keys(loaded).length > 0) {
      console.log(
        `📝 Loaded ${Object.keys(loaded).length} variables from ${filePath}`
      );
    }

    return loaded;
  } catch (error) {
    if (!quiet) {
      console.error(`⚠️  Failed to load ${filePath}:`, error.message);
    }
    return {};
  }
}

/**
 * Load dotenvx configuration (DEPRECATED)
 *
 * @param {Object} options - Options to pass to dotenvx
 * @param {boolean} options.quiet - Suppress warnings (default: false)
 * @returns {Object} Result from dotenvx.config()
 */
async function loadDotenvx(options = {}) {
  const { quiet = false } = options;

  if (!quiet) {
    console.warn(
      '\x1b[33m⚠️  DEPRECATED: dotenvx/.env files are deprecated.\x1b[0m\n' +
        '   Please use Links Notation (.lenv files) for environment configuration instead.\n' +
        '   See: https://github.com/link-foundation/lino-env'
    );
  }

  try {
    const dotenvx = await import('@dotenvx/dotenvx');
    return dotenvx.config({ ...options, quiet: true });
  } catch {
    if (!quiet) {
      console.error('⚠️  dotenvx not installed, skipping .env loading');
    }
    return { parsed: {} };
  }
}

// ============================================================================
// Main Configuration Function
// ============================================================================

/**
 * Create unified configuration from multiple sources
 *
 * Priority (highest to lowest):
 * 1. CLI arguments (manually entered)
 * 2. getenv defaults (from process.env)
 * 3. --configuration flag (dynamic .lenv file)
 * 4. .lenv file
 * 5. dotenvx/.env file (DEPRECATED)
 *
 * @param {Object} config - Configuration object
 * @param {Function} config.yargs - Yargs configuration function: ({ yargs, getenv }) => yargs
 * @param {Object} [config.lenv] - Lino-env configuration
 * @param {boolean} [config.lenv.enabled=true] - Enable .lenv loading
 * @param {string} [config.lenv.path='.lenv'] - Path to .lenv file
 * @param {boolean} [config.lenv.override=true] - Override existing env vars
 * @param {Object} [config.env] - Dotenvx/.env configuration (DEPRECATED)
 * @param {boolean} [config.env.enabled=false] - Enable .env loading
 * @param {Object} [config.getenv] - Getenv configuration
 * @param {boolean} [config.getenv.enabled=true] - Enable getenv helper
 * @param {string[]} [config.argv] - Custom argv to parse (default: process.argv)
 * @returns {Object} Parsed configuration object with camelCase keys
 *
 * @example
 * // Hero example (defaults)
 * const config = makeConfig({
 *   yargs: ({ yargs, getenv }) => yargs
 *     .option('port', { type: 'number', default: getenv('PORT', 3000) })
 *     .option('verbose', { type: 'boolean', default: false })
 * });
 *
 * @example
 * // Explicit configuration
 * const config = makeConfig({
 *   lenv: { enabled: true },
 *   env: { enabled: true },
 *   getenv: { enabled: true },
 *   yargs: ({ yargs, getenv }) => yargs
 *     .option('api-key', { type: 'string', default: getenv('API_KEY', '') })
 *     .option('port', { type: 'number', default: getenv('PORT', 3000) })
 * });
 */
export function makeConfig(config = {}) {
  const {
    yargs: yargsConfigFn,
    lenv = {},
    env = {},
    getenv: getenvConfig = {},
    argv = process.argv,
  } = config;

  // Default options
  const lenvEnabled = lenv.enabled !== false; // Default: true
  const lenvPath = lenv.path || '.lenv';
  const lenvOverride = lenv.override !== false; // Default: true

  const envEnabled = env.enabled === true; // Default: false
  const envQuiet = env.quiet !== false; // Default: true

  const getenvEnabled = getenvConfig.enabled !== false; // Default: true

  // Step 1: Load dotenvx/.env (DEPRECATED, lowest priority)
  if (envEnabled) {
    loadDotenvx({ quiet: envQuiet });
  }

  // Step 2: Load .lenv file (overrides .env)
  if (lenvEnabled) {
    applyLinoEnv(lenvPath, { override: lenvOverride, quiet: false });
  }

  // Step 3: Parse initial CLI args to check for --configuration
  const initialYargs = yargs(hideBin(argv))
    .option('configuration', {
      type: 'string',
      describe: 'Path to configuration .lenv file',
      alias: 'c',
    })
    .help(false) // Disable help for initial parse
    .version(false) // Disable version for initial parse
    .exitProcess(false); // Don't exit on parse errors

  let initialParsed;
  try {
    initialParsed = initialYargs.parseSync();
  } catch {
    initialParsed = {};
  }

  // Step 4: Load --configuration file if specified (overrides default .lenv)
  if (initialParsed.configuration) {
    applyLinoEnv(initialParsed.configuration, { override: true, quiet: false });
  }

  // Step 5: Configure yargs with user options + getenv helper
  const yargsInstance = yargs(hideBin(argv))
    .option('configuration', {
      type: 'string',
      describe: 'Path to configuration .lenv file',
      alias: 'c',
    })
    .version(false) // Disable built-in version flag to allow user-defined --version
    .help(false); // Disable built-in help flag (users should call .help() explicitly)

  // Pass getenv helper if enabled
  const getenvHelper = getenvEnabled ? getenv : () => '';
  const configuredYargs = yargsConfigFn
    ? yargsConfigFn({ yargs: yargsInstance, getenv: getenvHelper })
    : yargsInstance;

  // Step 6: Parse final configuration (CLI args have highest priority)
  const parsed = configuredYargs.parseSync();

  // Step 7: Convert kebab-case keys to camelCase for result object
  const result = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (key !== '_' && key !== '$0') {
      const camelKey = toCamelCase(key);
      result[camelKey] = value;
    }
  }

  return result;
}

// ============================================================================
// Legacy API (for backwards compatibility)
// ============================================================================

/**
 * Parse arguments from links notation format
 * @deprecated Use makeConfig() instead
 */
export function parseLinoArguments(linoString) {
  if (!linoString || typeof linoString !== 'string') {
    return [];
  }

  const parser = new Parser();

  try {
    const parsed = parser.parse(linoString);
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
  } catch {
    return linoString
      .split('\n')
      .map((line) => line.trim())
      .filter(
        (line) => line && !line.startsWith('#') && line !== '(' && line !== ')'
      );
  }
}

// Export all components for advanced usage
export { Parser } from 'links-notation';
export { LinoEnv } from 'lino-env';
export { yargs };
