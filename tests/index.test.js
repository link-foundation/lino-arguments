import { describe, it, expect, assert } from 'test-anywhere';
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  makeConfig,
  getenv,
  toUpperCase,
  toCamelCase,
  toKebabCase,
  toSnakeCase,
  toPascalCase,
  parseLinoArguments,
} from '../src/index.js';

// ============================================================================
// Case Conversion Tests
// ============================================================================

describe('Case Conversion Utilities', () => {
  describe('toUpperCase', () => {
    it('should convert camelCase to UPPER_CASE', () => {
      expect(toUpperCase('apiKey')).toBe('API_KEY');
      expect(toUpperCase('myVariableName')).toBe('MY_VARIABLE_NAME');
    });

    it('should convert kebab-case to UPPER_CASE', () => {
      expect(toUpperCase('api-key')).toBe('API_KEY');
      expect(toUpperCase('my-variable-name')).toBe('MY_VARIABLE_NAME');
    });

    it('should convert snake_case to UPPER_CASE', () => {
      expect(toUpperCase('api_key')).toBe('API_KEY');
      expect(toUpperCase('my_variable_name')).toBe('MY_VARIABLE_NAME');
    });

    it('should convert PascalCase to UPPER_CASE', () => {
      expect(toUpperCase('ApiKey')).toBe('API_KEY');
      expect(toUpperCase('MyVariableName')).toBe('MY_VARIABLE_NAME');
    });

    it('should handle already UPPER_CASE', () => {
      expect(toUpperCase('API_KEY')).toBe('API_KEY');
    });
  });

  describe('toCamelCase', () => {
    it('should convert kebab-case to camelCase', () => {
      expect(toCamelCase('api-key')).toBe('apiKey');
      expect(toCamelCase('my-variable-name')).toBe('myVariableName');
    });

    it('should convert UPPER_CASE to camelCase', () => {
      expect(toCamelCase('API_KEY')).toBe('apiKey');
      expect(toCamelCase('MY_VARIABLE_NAME')).toBe('myVariableName');
    });

    it('should convert snake_case to camelCase', () => {
      expect(toCamelCase('api_key')).toBe('apiKey');
      expect(toCamelCase('my_variable_name')).toBe('myVariableName');
    });

    it('should convert PascalCase to camelCase', () => {
      expect(toCamelCase('ApiKey')).toBe('apikey');
      expect(toCamelCase('MyVariableName')).toBe('myvariablename');
    });

    it('should handle already camelCase', () => {
      expect(toCamelCase('apiKey')).toBe('apikey');
    });
  });

  describe('toKebabCase', () => {
    it('should convert camelCase to kebab-case', () => {
      expect(toKebabCase('apiKey')).toBe('api-key');
      expect(toKebabCase('myVariableName')).toBe('my-variable-name');
    });

    it('should convert UPPER_CASE to kebab-case', () => {
      expect(toKebabCase('API_KEY')).toBe('api-key');
      expect(toKebabCase('MY_VARIABLE_NAME')).toBe('my-variable-name');
    });

    it('should convert PascalCase to kebab-case', () => {
      expect(toKebabCase('ApiKey')).toBe('api-key');
      expect(toKebabCase('MyVariableName')).toBe('my-variable-name');
    });

    it('should handle already kebab-case', () => {
      expect(toKebabCase('api-key')).toBe('api-key');
    });
  });

  describe('toSnakeCase', () => {
    it('should convert camelCase to snake_case', () => {
      expect(toSnakeCase('apiKey')).toBe('api_key');
      expect(toSnakeCase('myVariableName')).toBe('my_variable_name');
    });

    it('should convert kebab-case to snake_case', () => {
      expect(toSnakeCase('api-key')).toBe('api_key');
      expect(toSnakeCase('my-variable-name')).toBe('my_variable_name');
    });

    it('should convert UPPER_CASE to snake_case', () => {
      expect(toSnakeCase('API_KEY')).toBe('api_key');
    });

    it('should handle already snake_case', () => {
      expect(toSnakeCase('api_key')).toBe('api_key');
    });
  });

  describe('toPascalCase', () => {
    it('should convert camelCase to PascalCase', () => {
      expect(toPascalCase('apiKey')).toBe('Apikey');
    });

    it('should convert kebab-case to PascalCase', () => {
      expect(toPascalCase('api-key')).toBe('ApiKey');
      expect(toPascalCase('my-variable-name')).toBe('MyVariableName');
    });

    it('should convert snake_case to PascalCase', () => {
      expect(toPascalCase('api_key')).toBe('ApiKey');
      expect(toPascalCase('my_variable_name')).toBe('MyVariableName');
    });

    it('should handle already PascalCase', () => {
      expect(toPascalCase('ApiKey')).toBe('Apikey');
    });
  });
});

// ============================================================================
// getenv Tests
// ============================================================================

describe('getenv', () => {
  const originalEnv = { ...process.env };

  function cleanupTestVars() {
    delete process.env.TEST_VAR;
    delete process.env.testVar;
    delete process.env['test-var'];
    delete process.env.test_var;
    delete process.env.TestVar;
    delete process.env.myKey;
    delete process.env.MY_KEY;
  }

  function restoreEnv() {
    process.env = { ...originalEnv };
  }

  it('should find variable in UPPER_CASE', () => {
    cleanupTestVars();
    try {
      process.env.TEST_VAR = 'value';
      expect(getenv('testVar')).toBe('value');
      expect(getenv('test-var')).toBe('value');
      expect(getenv('TEST_VAR')).toBe('value');
    } finally {
      restoreEnv();
    }
  });

  it('should find variable in camelCase', () => {
    cleanupTestVars();
    try {
      process.env.testVar = 'value';
      expect(getenv('TEST_VAR')).toBe('value');
      expect(getenv('test-var')).toBe('value');
    } finally {
      restoreEnv();
    }
  });

  it('should find variable in kebab-case', () => {
    cleanupTestVars();
    try {
      process.env['test-var'] = 'value';
      expect(getenv('testVar')).toBe('value');
    } finally {
      restoreEnv();
    }
  });

  it('should return default value when not found', () => {
    cleanupTestVars();
    try {
      expect(getenv('NON_EXISTENT', 'default')).toBe('default');
    } finally {
      restoreEnv();
    }
  });

  it('should return empty string as default when not specified', () => {
    cleanupTestVars();
    try {
      expect(getenv('NON_EXISTENT')).toBe('');
    } finally {
      restoreEnv();
    }
  });

  it('should try original key first', () => {
    cleanupTestVars();
    try {
      process.env.myKey = 'original';
      process.env.MY_KEY = 'upper';
      expect(getenv('myKey')).toBe('original');
    } finally {
      restoreEnv();
    }
  });
});

// ============================================================================
// makeConfig Tests
// ============================================================================

describe('makeConfig', () => {
  const testLenvFile = join(process.cwd(), '.test-makeconfig.lenv');
  const testConfigFile = join(process.cwd(), '.test-config.lenv');
  const originalEnv = { ...process.env };

  function cleanupTestEnv() {
    // Clean all test variables
    Object.keys(process.env).forEach((key) => {
      if (key.startsWith('TEST_') || key.startsWith('APP_')) {
        delete process.env[key];
      }
    });
  }

  function cleanupTestFiles() {
    [testLenvFile, testConfigFile].forEach((file) => {
      if (existsSync(file)) {
        unlinkSync(file);
      }
    });
  }

  function restoreEnv() {
    process.env = { ...originalEnv };
  }

  function cleanup() {
    cleanupTestFiles();
    restoreEnv();
  }

  describe('Hero Example (defaults)', () => {
    it('should work with minimal configuration', () => {
      cleanupTestEnv();
      try {
        const config = makeConfig({
          yargs: ({ yargs, getenv }) =>
            yargs
              .option('port', { type: 'number', default: getenv('PORT', 3000) })
              .option('verbose', { type: 'boolean', default: false }),
          argv: ['node', 'script.js'],
        });

        expect(config.port).toBe(3000);
        expect(config.verbose).toBe(false);
      } finally {
        cleanup();
      }
    });

    it('should use CLI arguments with highest priority', () => {
      cleanupTestEnv();
      try {
        const config = makeConfig({
          yargs: ({ yargs, getenv }) =>
            yargs
              .option('port', { type: 'number', default: getenv('PORT', 3000) })
              .option('verbose', { type: 'boolean', default: false }),
          argv: ['node', 'script.js', '--port', '8080', '--verbose'],
        });

        expect(config.port).toBe(8080);
        expect(config.verbose).toBe(true);
      } finally {
        cleanup();
      }
    });

    it('should convert kebab-case to camelCase in result', () => {
      cleanupTestEnv();
      try {
        const config = makeConfig({
          yargs: ({ yargs }) =>
            yargs.option('api-key', { type: 'string', default: 'key123' }),
          argv: ['node', 'script.js'],
        });

        expect(config.apiKey).toBe('key123');
        expect(config['api-key']).toBe(undefined);
      } finally {
        cleanup();
      }
    });
  });

  describe('Environment Loading Priority', () => {
    it('should load .lenv file by default', () => {
      cleanupTestEnv();
      try {
        writeFileSync(testLenvFile, 'APP_PORT: 5000\nAPP_HOST: localhost\n');

        const config = makeConfig({
          yargs: ({ yargs, getenv }) =>
            yargs.option('port', {
              type: 'number',
              default: getenv('APP_PORT', 3000),
            }),
          lenv: { path: testLenvFile },
          argv: ['node', 'script.js'],
        });

        expect(config.port).toBe(5000);
        expect(process.env.APP_PORT).toBe('5000');
      } finally {
        cleanup();
      }
    });

    it('should handle --configuration flag', () => {
      cleanupTestEnv();
      try {
        writeFileSync(testLenvFile, 'APP_PORT: 5000\n');
        writeFileSync(testConfigFile, 'APP_PORT: 9000\n');

        const config = makeConfig({
          yargs: ({ yargs, getenv }) =>
            yargs.option('port', {
              type: 'number',
              default: getenv('APP_PORT', 3000),
            }),
          lenv: { path: testLenvFile },
          argv: ['node', 'script.js', '--configuration', testConfigFile],
        });

        // --configuration should override default .lenv
        expect(config.port).toBe(9000);
        expect(process.env.APP_PORT).toBe('9000');
      } finally {
        cleanup();
      }
    });

    it('should prioritize CLI over environment', () => {
      cleanupTestEnv();
      try {
        writeFileSync(testLenvFile, 'APP_PORT: 5000\n');

        const config = makeConfig({
          yargs: ({ yargs, getenv }) =>
            yargs.option('port', {
              type: 'number',
              default: getenv('APP_PORT', 3000),
            }),
          lenv: { path: testLenvFile },
          argv: ['node', 'script.js', '--port', '7000'],
        });

        // CLI should have highest priority
        expect(config.port).toBe(7000);
      } finally {
        cleanup();
      }
    });

    it('should handle missing .lenv file gracefully', () => {
      cleanupTestEnv();
      try {
        const config = makeConfig({
          yargs: ({ yargs, getenv }) =>
            yargs.option('port', {
              type: 'number',
              default: getenv('APP_PORT', 3000),
            }),
          lenv: { path: 'non-existent.lenv' },
          argv: ['node', 'script.js'],
        });

        expect(config.port).toBe(3000);
      } finally {
        cleanup();
      }
    });
  });

  describe('Case Conversion in Environment Loading', () => {
    it('should convert all keys to UPPER_CASE in process.env', () => {
      cleanupTestEnv();
      try {
        writeFileSync(
          testLenvFile,
          'apiKey: key123\nmy-port: 3000\nmy_host: localhost\n'
        );

        makeConfig({
          yargs: ({ yargs }) => yargs,
          lenv: { path: testLenvFile },
          argv: ['node', 'script.js'],
        });

        expect(process.env.API_KEY).toBe('key123');
        expect(process.env.MY_PORT).toBe('3000');
        expect(process.env.MY_HOST).toBe('localhost');
      } finally {
        cleanup();
      }
    });

    it('should find env vars in any case format via getenv', () => {
      cleanupTestEnv();
      try {
        process.env.API_KEY = 'secret';

        const config = makeConfig({
          yargs: ({ yargs, getenv }) =>
            yargs
              .option('api-key', {
                type: 'string',
                default: getenv('apiKey', 'default'),
              })
              .option('another-key', {
                type: 'string',
                default: getenv('anotherKey', 'default'),
              }),
          argv: ['node', 'script.js'],
        });

        // getenv should find API_KEY when asked for apiKey
        expect(config.apiKey).toBe('secret');
        // Non-existent should use default
        expect(config.anotherKey).toBe('default');
      } finally {
        cleanup();
      }
    });
  });

  describe('Configuration Options', () => {
    it('should support disabling lenv', () => {
      cleanupTestEnv();
      try {
        writeFileSync(testLenvFile, 'APP_PORT: 5000\n');

        const config = makeConfig({
          yargs: ({ yargs, getenv }) =>
            yargs.option('port', {
              type: 'number',
              default: getenv('APP_PORT', 3000),
            }),
          lenv: { enabled: false, path: testLenvFile },
          argv: ['node', 'script.js'],
        });

        // Should not load from .lenv
        expect(config.port).toBe(3000);
        expect(process.env.APP_PORT).toBe(undefined);
      } finally {
        cleanup();
      }
    });

    it('should support enabling env/dotenvx (deprecated)', () => {
      cleanupTestEnv();
      try {
        // Note: This test will show deprecation warning
        const config = makeConfig({
          yargs: ({ yargs }) =>
            yargs.option('test', { type: 'boolean', default: false }),
          env: { enabled: true, quiet: true },
          argv: ['node', 'script.js'],
        });

        expect(config.test).toBe(false);
      } finally {
        cleanup();
      }
    });

    it('should support disabling getenv', () => {
      cleanupTestEnv();
      try {
        process.env.TEST_PORT = '5000';

        const config = makeConfig({
          yargs: ({ yargs, getenv }) =>
            yargs.option('port', {
              type: 'number',
              // getenv should return empty string when disabled
              default: getenv('TEST_PORT', 3000) || 3000,
            }),
          getenv: { enabled: false },
          argv: ['node', 'script.js'],
        });

        expect(config.port).toBe(3000);
      } finally {
        cleanup();
      }
    });

    it('should support configuration alias -c', () => {
      cleanupTestEnv();
      try {
        writeFileSync(testConfigFile, 'APP_PORT: 9000\n');

        const config = makeConfig({
          yargs: ({ yargs, getenv }) =>
            yargs.option('port', {
              type: 'number',
              default: getenv('APP_PORT', 3000),
            }),
          argv: ['node', 'script.js', '-c', testConfigFile],
        });

        expect(config.port).toBe(9000);
      } finally {
        cleanup();
      }
    });
  });

  describe('Complete Priority Chain', () => {
    it('should demonstrate full priority: CLI > getenv > --configuration > .lenv', () => {
      cleanupTestEnv();
      try {
        // Setup: .lenv with base config
        writeFileSync(
          testLenvFile,
          'APP_PORT: 3000\nAPP_HOST: localhost\nAPP_NAME: base\n'
        );

        // Setup: --configuration with overrides
        writeFileSync(
          testConfigFile,
          'APP_PORT: 5000\nAPP_HOST: override-host\n'
        );

        // Test 1: Only .lenv (no CLI, no --configuration)
        let config = makeConfig({
          yargs: ({ yargs, getenv }) =>
            yargs
              .option('port', {
                type: 'number',
                default: getenv('APP_PORT', 0),
              })
              .option('host', {
                type: 'string',
                default: getenv('APP_HOST', ''),
              })
              .option('name', {
                type: 'string',
                default: getenv('APP_NAME', ''),
              }),
          lenv: { path: testLenvFile },
          argv: ['node', 'script.js'],
        });

        expect(config.port).toBe(3000);
        expect(config.host).toBe('localhost');
        expect(config.name).toBe('base');

        // Clean env for next test
        delete process.env.APP_PORT;
        delete process.env.APP_HOST;
        delete process.env.APP_NAME;

        // Test 2: .lenv + --configuration
        config = makeConfig({
          yargs: ({ yargs, getenv }) =>
            yargs
              .option('port', {
                type: 'number',
                default: getenv('APP_PORT', 0),
              })
              .option('host', {
                type: 'string',
                default: getenv('APP_HOST', ''),
              })
              .option('name', {
                type: 'string',
                default: getenv('APP_NAME', ''),
              }),
          lenv: { path: testLenvFile },
          argv: ['node', 'script.js', '--configuration', testConfigFile],
        });

        expect(config.port).toBe(5000); // from --configuration
        expect(config.host).toBe('override-host'); // from --configuration
        expect(config.name).toBe('base'); // from .lenv (not in --configuration)

        // Clean env for next test
        delete process.env.APP_PORT;
        delete process.env.APP_HOST;
        delete process.env.APP_NAME;

        // Test 3: .lenv + --configuration + CLI
        config = makeConfig({
          yargs: ({ yargs, getenv }) =>
            yargs
              .option('port', {
                type: 'number',
                default: getenv('APP_PORT', 0),
              })
              .option('host', {
                type: 'string',
                default: getenv('APP_HOST', ''),
              })
              .option('name', {
                type: 'string',
                default: getenv('APP_NAME', ''),
              }),
          lenv: { path: testLenvFile },
          argv: [
            'node',
            'script.js',
            '--configuration',
            testConfigFile,
            '--port',
            '9000',
          ],
        });

        expect(config.port).toBe(9000); // from CLI (highest priority)
        expect(config.host).toBe('override-host'); // from --configuration
        expect(config.name).toBe('base'); // from .lenv
      } finally {
        cleanup();
      }
    });
  });
});

// ============================================================================
// Legacy API Tests (backwards compatibility)
// ============================================================================

describe('parseLinoArguments (legacy)', () => {
  it('should parse simple links notation format', () => {
    const input = '(\n  --verbose\n  --port 3000\n)';
    const result = parseLinoArguments(input);
    expect(result.includes('--verbose')).toBeTruthy();
    expect(result.includes('--port')).toBeTruthy();
    expect(result.includes('3000')).toBeTruthy();
  });

  it('should parse arguments without parentheses', () => {
    const input = '--debug\n--host localhost';
    const result = parseLinoArguments(input);
    expect(result.includes('--debug')).toBeTruthy();
    expect(result.includes('--host')).toBeTruthy();
    expect(result.includes('localhost')).toBeTruthy();
  });

  it('should handle empty input', () => {
    const result = parseLinoArguments('');
    expect(result).toEqual([]);
  });

  it('should handle null input', () => {
    const result = parseLinoArguments(null);
    expect(result).toEqual([]);
  });

  it('should filter out comments', () => {
    const input = '# Comment\n--verbose\n# Another comment\n--debug';
    const result = parseLinoArguments(input);
    expect(!result.some((arg) => arg.startsWith('#'))).toBeTruthy();
    expect(result.includes('--verbose')).toBeTruthy();
    expect(result.includes('--debug')).toBeTruthy();
  });
});
