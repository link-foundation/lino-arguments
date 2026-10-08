// This entry deliberately has no runtime, filesystem, or parser dependencies.
import { toUpperCase, toCamelCase, toKebabCase } from './case.js';
export * from './case.js';

export function normalizeEnvironment(source = {}) {
  const result = Object.create(null);
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) {
      continue;
    }
    const name = toUpperCase(key);
    if (Object.hasOwn(result, name)) {
      throw new Error(`Ambiguous environment aliases for ${name}`);
    }
    result[name] = value;
  }
  return result;
}

// Mirrors getenv's integer/float/boolish contracts without its process binding.
export function convertValue(value, type, key, integer = false) {
  if (type === 'array') {
    return Array.isArray(value) ? [...value] : String(value).split(/\s*,\s*/);
  }
  const text = String(value);
  if (type === 'boolean') {
    if (/^(true|false)$/i.test(text)) {
      return text.toLowerCase() === 'true';
    }
    if (text === '1' || text === '0') {
      return text === '1';
    }
  } else if (type === 'number') {
    if (
      text !== '' &&
      (!integer || /^-?\d+$/.test(text)) &&
      Number.isFinite(Number(text))
    ) {
      return Number(text);
    }
  } else {
    return text;
  }
  throw new Error(`Invalid ${type} configuration for ${toUpperCase(key)}`);
}

function secretSchema(secrets = {}) {
  const keys = secrets.keys ?? [];
  const schema = Object.create(null);
  for (const [key, fileKey] of Array.isArray(keys)
    ? keys.map((key) => [key, `${toUpperCase(key)}_FILE`])
    : Object.entries(keys)) {
    const name = toUpperCase(key);
    if (Object.hasOwn(schema, name)) {
      throw new Error(`Ambiguous secret aliases for ${name}`);
    }
    if (typeof fileKey !== 'string' || fileKey.length === 0) {
      throw new Error(`Invalid secret file variable for ${name}`);
    }
    schema[name] = toUpperCase(fileKey);
  }
  return schema;
}

export function createConfigContext({
  env = {},
  lenv = {},
  configuration = {},
  cwd = '.',
  secrets = {},
  readFile,
  resolvePath = (base, path) =>
    /^(\/|[A-Za-z]:[/\\])/.test(path) ? path : `${base}/${path}`,
  trace,
} = {}) {
  const sources = [env, configuration, lenv].map(normalizeEnvironment);
  const schema = secretSchema(secrets);
  const maxBytes = secrets.maxBytes ?? 65536;
  const conflict = secrets.conflict ?? 'error';
  const newline = secrets.newline ?? 'strip';
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0 || maxBytes > 16777216) {
    throw new Error('Secret maxBytes must be an integer from 1 to 16777216');
  }
  if (!['error', 'value', 'file'].includes(conflict)) {
    throw new Error('Invalid secret conflict policy');
  }
  if (!['strip', 'preserve'].includes(newline)) {
    throw new Error('Invalid secret newline policy');
  }
  const cache = new Map();
  const reader = secrets.readFile ?? readFile;
  function lookup(key) {
    const name = toUpperCase(key);
    if (cache.has(name)) {
      return cache.get(name);
    }
    for (let index = 0; index < sources.length; index++) {
      const source = sources[index];
      const direct = Object.hasOwn(source, name);
      const fileKey = schema[name];
      const file = fileKey !== undefined && Object.hasOwn(source, fileKey);
      if (!direct && !file) {
        continue;
      }
      if (direct && file && conflict === 'error') {
        throw new Error(`Secret value/file conflict for ${name}`);
      }
      let value = source[name];
      if (file && (!direct || conflict === 'file')) {
        let contents;
        try {
          if (
            typeof reader !== 'function' ||
            typeof source[fileKey] !== 'string'
          ) {
            throw new Error();
          }
          contents = reader(resolvePath(cwd, source[fileKey]), { maxBytes });
        } catch {
          throw new Error(`Cannot read secret file for ${name}`);
        }
        if (typeof contents !== 'string' && !(contents instanceof Uint8Array)) {
          throw new Error(`Invalid secret reader result for ${name}`);
        }
        // Avoid allocating a large UTF-8 copy for an oversized custom result.
        if (typeof contents === 'string' && contents.length > maxBytes) {
          throw new Error(`Secret file exceeds size limit for ${name}`);
        }
        const bytes =
          typeof contents === 'string'
            ? new TextEncoder().encode(contents)
            : contents;
        if (bytes.byteLength > maxBytes) {
          throw new Error(`Secret file exceeds size limit for ${name}`);
        }
        try {
          value = new TextDecoder('utf-8', {
            fatal: true,
            ignoreBOM: true,
          }).decode(bytes);
        } catch {
          throw new Error(`Invalid secret file encoding for ${name}`);
        }
        if (newline === 'strip') {
          value = value.replace(/\r?\n$/, '');
        }
      }
      trace?.({
        key: name,
        source: ['env', 'configuration', 'lenv'][index],
        file: Boolean(file && (!direct || conflict === 'file')),
      });
      const result = { found: true, value };
      cache.set(name, result);
      return result;
    }
    return { found: false };
  }
  function getenv(key, defaultValue = '') {
    const result = lookup(key);
    if (!result.found) {
      return defaultValue;
    }
    try {
      return convertValue(
        result.value,
        typeof defaultValue,
        key,
        Number.isInteger(defaultValue)
      );
    } catch {
      return defaultValue;
    }
  }
  return { lookup, getenv };
}

/** Resolve a declared option schema from plain objects (argv is already parsed). */
export function resolveConfig({
  options = {},
  argv = {},
  autoMap = true,
  ...inputs
} = {}) {
  const context = createConfigContext(inputs);
  const cli = normalizeEnvironment(argv);
  const result = {};
  const names = new Set();
  for (const [key, option] of Object.entries(options)) {
    const name = toUpperCase(key);
    if (names.has(name)) {
      throw new Error(`Ambiguous option aliases for ${name}`);
    }
    names.add(name);
    const variable =
      option.env === false
        ? undefined
        : (option.env ?? (autoMap ? name : undefined));
    const value = Object.hasOwn(cli, name)
      ? { found: true, value: cli[name] }
      : variable
        ? context.lookup(variable)
        : { found: false };
    const resolved = value.found
      ? convertValue(value.value, option.type, key)
      : option.default;
    if (resolved !== undefined) {
      Object.defineProperty(result, toCamelCase(toKebabCase(key)), {
        value: resolved,
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
  }
  return result;
}
