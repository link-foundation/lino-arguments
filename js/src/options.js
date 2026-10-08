import { toUpperCase, toKebabCase } from './case.js';
import { convertValue } from './pure.js';

/** Map registered options only; native yargs.env() reads the whole host env. */
export function mapEnvironmentOptions(
  instance,
  context,
  { autoMap, cli, redactDefaults }
) {
  const variables = new Map();
  const original = instance.option.bind(instance);
  instance.option = (key, option) => {
    if (typeof key === 'string' && option) {
      if (!variables.has(key) || Object.hasOwn(option, 'env')) {
        variables.set(key, option.env);
      }
    }
    return original(key, option);
  };
  const command = instance.command.bind(instance);
  instance.command = (...args) => {
    // Command builders run during parsing, after the top-level callback.
    const wrap =
      (builder) =>
      (parser, ...parameters) => {
        const apply = mapEnvironmentOptions(parser, context, {
          autoMap,
          cli,
          redactDefaults,
        });
        const configured =
          typeof builder === 'function'
            ? builder(parser, ...parameters)
            : parser.options(builder);
        apply(configured || parser);
        return configured || parser;
      };
    if (Array.isArray(args[0])) {
      args[0] = args[0].map((definition) => ({
        ...definition,
        builder: wrap(definition.builder || {}),
      }));
    } else if (typeof args[0] === 'object') {
      args[0] = { ...args[0], builder: wrap(args[0].builder || {}) };
    } else if (args[2]) {
      args[2] = wrap(args[2]);
    }
    return command(...args);
  };
  return (parser) => {
    const options = parser.getOptions();
    const aliases = options.alias;
    const owners = new Map();
    const aliasOwners = new Map();
    for (const [key, list] of Object.entries(aliases)) {
      for (const alias of list) {
        if (aliasOwners.has(alias) && aliasOwners.get(alias) !== key) {
          throw new Error(`Ambiguous option alias ${toUpperCase(alias)}`);
        }
        aliasOwners.set(alias, key);
      }
    }
    for (const key of Object.keys(options.key)) {
      // Built-in flags do not represent application configuration. Re-registering
      // version with option() also emits yargs' reserved-word warning.
      if (
        key === 'configuration' ||
        (['help', 'version'].includes(key) && !variables.has(key))
      ) {
        continue;
      }
      if (redactDefaults) {
        parser.option(key, { defaultDescription: '[redacted]' });
      }
      // Explicit aliases share their owner's mapping.
      if (Object.values(aliases).some((list) => list.includes(key))) {
        continue;
      }
      const name = toUpperCase(key);
      if (owners.has(name)) {
        throw new Error(`Ambiguous option aliases for ${name}`);
      }
      owners.set(name, key);
      const variable = variables.get(key);
      if (variable === false || (!autoMap && typeof variable !== 'string')) {
        continue;
      }
      const cliKeys = [key, toKebabCase(key), ...(aliases[key] || [])];
      if (
        Object.keys(cli).some((key) =>
          cliKeys.some(
            (candidate) => toUpperCase(candidate) === toUpperCase(key)
          )
        )
      ) {
        continue;
      }
      const found = context.lookup(
        typeof variable === 'string' ? variable : name
      );
      if (!found.found) {
        continue;
      }
      const type = options.array.includes(key)
        ? 'array'
        : options.boolean.includes(key)
          ? 'boolean'
          : options.number.includes(key)
            ? 'number'
            : 'string';
      parser.default(key, convertValue(found.value, type, key));
      // Prevent environment defaults (including secrets) appearing in --help.
      parser.option(key, { defaultDescription: '[environment]' });
    }
  };
}
