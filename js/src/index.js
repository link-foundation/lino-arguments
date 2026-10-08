import { Parser } from 'links-notation';
import { LinoEnv } from 'lino-env';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import baseGetenv from 'getenv';
import { resolve } from 'node:path';
import {
  toUpperCase,
  toCamelCase,
  toKebabCase,
  toSnakeCase,
  toPascalCase,
} from './case.js';
import { createConfigContext, normalizeEnvironment } from './pure.js';
import { readSecretFile } from './files.js';
import { mapEnvironmentOptions } from './options.js';

/**
 * lino-arguments - A unified configuration library
 *
 * Combines Links Notation Environment (lenv), dotenvx, and yargs into a single
 * easy-to-use configuration system with clear priority ordering.
 *
 * Isolated priority: CLI > env > --configuration > .lenv > defaults.
 * Legacy calls preserve process exports and lenv.override semantics.
 */

// ============================================================================
// Case Conversion Utilities
// ============================================================================

export {
  toUpperCase,
  toCamelCase,
  toKebabCase,
  toSnakeCase,
  toPascalCase,
} from './case.js';

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
export function getenv(key, defaultValue = '', options) {
  if (options) {
    return createConfigContext({
      readFile: readSecretFile,
      resolvePath: resolve,
      cwd: process.cwd(),
      ...options,
      env: Object.hasOwn(options, 'env') ? options.env : process.env,
    }).getenv(key, defaultValue);
  }
  // Try different case formats
  const variants = [
    key, // Original
    toUpperCase(key), // UPPER_CASE
    toCamelCase(key), // camelCase
    toKebabCase(key), // kebab-case
    toSnakeCase(key), // snake_case
    toPascalCase(key), // PascalCase
  ];

  // Windows can resolve several spellings to a single environment entry.
  // Count stored keys, rather than successful lookups, to detect ambiguity.
  const matches = Object.keys(process.env).filter(
    (name) => toUpperCase(name) === toUpperCase(key)
  );
  if (matches.length > 1) {
    throw new Error(`Ambiguous environment aliases for ${toUpperCase(key)}`);
  }

  // Try to find the variable using any case variant
  for (const variant of new Set([...variants, ...matches])) {
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
export function applyLinoEnv(filePath = '.lenv', options = {}) {
  const { override = false, quiet = false } = options;

  try {
    const env = loadLinoEnv(filePath);
    if (!env) {
      return {};
    }

    const envObject = normalizeEnvironment(env.toObject());
    const loaded = {};

    for (const [key, value] of Object.entries(envObject)) {
      // Convert all keys to UPPER_CASE for process.env
      const upperKey = toUpperCase(key);

      if (override || process.env[upperKey] === undefined) {
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
  } catch {
    throw new Error('Invalid .lenv environment aliases');
  }
}

/**
 * Load dotenvx configuration (DEPRECATED)
 *
 * @param {Object} options - Options to pass to dotenvx
 * @param {boolean} options.quiet - Suppress warnings (default: false)
 * @returns {Object} Result from dotenvx.config()
 */
export async function loadDotenvx(options = {}) {
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
 * Resolve CLI options using an injected env/cwd context or legacy process defaults.
 * Isolated precedence: CLI > env > --configuration > .lenv > option defaults.
 * Legacy mode keeps process exports and lenv.override semantics.
 *
 * @param {Object} config
 * @param {Object} [config.env] Environment map, or {values, autoMap, enabled, quiet}
 * @param {string} [config.cwd] Base directory (default: process.cwd())
 * @param {string[]} [config.argv] Full process-style argv (default: process.argv)
 * @param {Function} [config.yargs] Callback receiving { yargs, getenv }
 * @param {Object} [config.lenv] Default file settings: enabled, path, override, quiet
 * @param {Object} [config.getenv] Callback helper settings: enabled
 * @param {Object} [config.secrets] Allowlist, bounded reader, conflict/newline policies
 * @param {Function} [config.trace] Optional key/source tracing, without values
 * @returns {Object} Parsed camelCase options
 */
export function makeConfig(config = {}) {
  const {
    yargs: configure,
    lenv = {},
    getenv: getenvOptions = {},
    secrets,
    argv = process.argv,
    cwd = process.cwd(),
  } = config;
  const input = config.env;
  // Keep the deprecated env settings object, while accepting env maps directly.
  const settingsKeys = ['enabled', 'quiet', 'autoMap', 'values'];
  const isSettings =
    input &&
    Object.keys(input).length > 0 &&
    Object.keys(input).every((key) => settingsKeys.includes(key)) &&
    Object.entries(input).every(
      ([key, value]) => key === 'values' || typeof value === 'boolean'
    );
  const envSettings = isSettings ? input : {};
  const isolated =
    Object.hasOwn(envSettings, 'values') ||
    (Object.hasOwn(config, 'env') && !isSettings);
  const environment = isolated
    ? Object.hasOwn(envSettings, 'values')
      ? (envSettings.values ?? {})
      : (input ?? {})
    : process.env;
  if (isolated && envSettings.enabled) {
    throw new Error(
      'Use loadDotenvx separately; isolated configuration accepts parsed env values'
    );
  }
  if (!isolated && envSettings.enabled) {
    loadDotenvx({
      quiet: envSettings.quiet !== false,
      path: resolve(cwd, '.env'),
    });
  }
  const initial = yargs(hideBin(argv), cwd)
    .detectLocale(!isolated)
    .option('configuration', {
      type: 'string',
      alias: 'c',
    })
    .help(false)
    .version(false)
    .exitProcess(false);
  let initialParsed;
  try {
    initialParsed = initial.parseSync();
  } catch {
    initialParsed = {};
  }
  const defaultPath = resolve(cwd, lenv.path || '.lenv');
  const selectedPath = initialParsed.configuration
    ? resolve(cwd, initialParsed.configuration)
    : undefined;
  let context;
  if (isolated) {
    context = createConfigContext({
      env: environment,
      lenv: lenv.enabled === false ? {} : loadLinoEnv(defaultPath)?.toObject(),
      configuration: selectedPath ? loadLinoEnv(selectedPath)?.toObject() : {},
      cwd,
      resolvePath: resolve,
      readFile: readSecretFile,
      secrets,
      trace: config.trace,
    });
  } else {
    if (lenv.enabled !== false) {
      applyLinoEnv(defaultPath, {
        override: lenv.override !== false,
        quiet: lenv.quiet !== false,
      });
    }
    if (selectedPath) {
      applyLinoEnv(selectedPath, {
        override: true,
        quiet: lenv.quiet !== false,
      });
    }
    context = createConfigContext({
      env: process.env,
      cwd,
      resolvePath: resolve,
      readFile: readSecretFile,
      secrets,
      trace: config.trace,
    });
  }
  const instance = yargs(hideBin(argv), cwd)
    .detectLocale(!isolated)
    .option('configuration', {
      type: 'string',
      describe: 'Path to configuration .lenv file',
      alias: 'c',
    });
  if (isolated) {
    const nativeEnv = instance.env.bind(instance);
    instance.env = (prefix) => {
      if (prefix !== false) {
        throw new Error(
          'Native yargs.env reads the host; use env.autoMap or option env instead'
        );
      }
      return nativeEnv(false);
    };
  }
  // Wrap only metadata registration; yargs still parses and validates arguments.
  const applyMapping = mapEnvironmentOptions(instance, context, {
    autoMap: envSettings.autoMap === true,
    cli: initialParsed,
    redactDefaults: Boolean(secrets?.keys),
  });
  const helper = getenvOptions.enabled === false ? () => '' : context.getenv;
  const parser = configure
    ? configure({ yargs: instance, getenv: helper })
    : instance;
  applyMapping(parser);
  if (secrets?.keys) {
    // yargs otherwise prints values in choices/coercion errors and help defaults.
    parser.fail(() => {
      throw new Error('Invalid configuration for declared options');
    });
  }
  const parsed = parser.parseSync();
  const result = {};
  const normalized = new Map();
  for (const [key, value] of Object.entries(parsed)) {
    if (key !== '_' && key !== '$0') {
      const camelKey = toCamelCase(toKebabCase(key));
      if (normalized.has(camelKey) && normalized.get(camelKey) !== value) {
        throw new Error(
          `Ambiguous configuration aliases for ${toUpperCase(key)}`
        );
      }
      normalized.set(camelKey, value);
      Object.defineProperty(result, camelKey, {
        value,
        enumerable: true,
        configurable: true,
        writable: true,
      });
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
    const pending = [...parsed].reverse();

    // links-notation 0.23 preserves nested line/group nodes. Traverse every
    // child in source order so the legacy flat argument API stays unchanged.
    while (pending.length > 0) {
      const link = pending.pop();
      if (typeof link === 'string') {
        args.push(link);
        continue;
      }

      if (link.id) {
        args.push(link.id);
      }

      if (link.values && Array.isArray(link.values)) {
        for (let index = link.values.length - 1; index >= 0; index--) {
          if (link.values[index]) {
            pending.push(link.values[index]);
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
export { createConfigContext, resolveConfig } from './pure.js';
