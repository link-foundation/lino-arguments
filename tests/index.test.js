import { describe, it } from 'node:test';
import assert from 'node:assert';
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
      assert.strictEqual(toUpperCase('apiKey'), 'API_KEY');
      assert.strictEqual(toUpperCase('myVariableName'), 'MY_VARIABLE_NAME');
    });

    it('should convert kebab-case to UPPER_CASE', () => {
      assert.strictEqual(toUpperCase('api-key'), 'API_KEY');
      assert.strictEqual(toUpperCase('my-variable-name'), 'MY_VARIABLE_NAME');
    });

    it('should convert snake_case to UPPER_CASE', () => {
      assert.strictEqual(toUpperCase('api_key'), 'API_KEY');
      assert.strictEqual(toUpperCase('my_variable_name'), 'MY_VARIABLE_NAME');
    });

    it('should convert PascalCase to UPPER_CASE', () => {
      assert.strictEqual(toUpperCase('ApiKey'), 'API_KEY');
      assert.strictEqual(toUpperCase('MyVariableName'), 'MY_VARIABLE_NAME');
    });

    it('should handle already UPPER_CASE', () => {
      assert.strictEqual(toUpperCase('API_KEY'), 'API_KEY');
    });
  });

  describe('toCamelCase', () => {
    it('should convert kebab-case to camelCase', () => {
      assert.strictEqual(toCamelCase('api-key'), 'apiKey');
      assert.strictEqual(toCamelCase('my-variable-name'), 'myVariableName');
    });

    it('should convert UPPER_CASE to camelCase', () => {
      assert.strictEqual(toCamelCase('API_KEY'), 'apiKey');
      assert.strictEqual(toCamelCase('MY_VARIABLE_NAME'), 'myVariableName');
    });

    it('should convert snake_case to camelCase', () => {
      assert.strictEqual(toCamelCase('api_key'), 'apiKey');
      assert.strictEqual(toCamelCase('my_variable_name'), 'myVariableName');
    });

    it('should convert PascalCase to camelCase', () => {
      assert.strictEqual(toCamelCase('ApiKey'), 'apikey');
      assert.strictEqual(toCamelCase('MyVariableName'), 'myvariablename');
    });

    it('should handle already camelCase', () => {
      assert.strictEqual(toCamelCase('apiKey'), 'apikey');
    });
  });

  describe('toKebabCase', () => {
    it('should convert camelCase to kebab-case', () => {
      assert.strictEqual(toKebabCase('apiKey'), 'api-key');
      assert.strictEqual(toKebabCase('myVariableName'), 'my-variable-name');
    });

    it('should convert UPPER_CASE to kebab-case', () => {
      assert.strictEqual(toKebabCase('API_KEY'), 'api-key');
      assert.strictEqual(toKebabCase('MY_VARIABLE_NAME'), 'my-variable-name');
    });

    it('should convert PascalCase to kebab-case', () => {
      assert.strictEqual(toKebabCase('ApiKey'), 'api-key');
      assert.strictEqual(toKebabCase('MyVariableName'), 'my-variable-name');
    });

    it('should handle already kebab-case', () => {
      assert.strictEqual(toKebabCase('api-key'), 'api-key');
    });
  });

  describe('toSnakeCase', () => {
    it('should convert camelCase to snake_case', () => {
      assert.strictEqual(toSnakeCase('apiKey'), 'api_key');
      assert.strictEqual(toSnakeCase('myVariableName'), 'my_variable_name');
    });

    it('should convert kebab-case to snake_case', () => {
      assert.strictEqual(toSnakeCase('api-key'), 'api_key');
      assert.strictEqual(toSnakeCase('my-variable-name'), 'my_variable_name');
    });

    it('should convert UPPER_CASE to snake_case', () => {
      assert.strictEqual(toSnakeCase('API_KEY'), 'api_key');
    });

    it('should handle already snake_case', () => {
      assert.strictEqual(toSnakeCase('api_key'), 'api_key');
    });
  });

  describe('toPascalCase', () => {
    it('should convert camelCase to PascalCase', () => {
      assert.strictEqual(toPascalCase('apiKey'), 'Apikey');
    });

    it('should convert kebab-case to PascalCase', () => {
      assert.strictEqual(toPascalCase('api-key'), 'ApiKey');
      assert.strictEqual(toPascalCase('my-variable-name'), 'MyVariableName');
    });

    it('should convert snake_case to PascalCase', () => {
      assert.strictEqual(toPascalCase('api_key'), 'ApiKey');
      assert.strictEqual(toPascalCase('my_variable_name'), 'MyVariableName');
    });

    it('should handle already PascalCase', () => {
      assert.strictEqual(toPascalCase('ApiKey'), 'Apikey');
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
      assert.strictEqual(getenv('testVar'), 'value');
      assert.strictEqual(getenv('test-var'), 'value');
      assert.strictEqual(getenv('TEST_VAR'), 'value');
    } finally {
      restoreEnv();
    }
  });

  it('should find variable in camelCase', () => {
    cleanupTestVars();
    try {
      process.env.testVar = 'value';
      assert.strictEqual(getenv('TEST_VAR'), 'value');
      assert.strictEqual(getenv('test-var'), 'value');
    } finally {
      restoreEnv();
    }
  });

  it('should find variable in kebab-case', () => {
    cleanupTestVars();
    try {
      process.env['test-var'] = 'value';
      assert.strictEqual(getenv('testVar'), 'value');
    } finally {
      restoreEnv();
    }
  });

  it('should return default value when not found', () => {
    cleanupTestVars();
    try {
      assert.strictEqual(getenv('NON_EXISTENT', 'default'), 'default');
    } finally {
      restoreEnv();
    }
  });

  it('should return empty string as default when not specified', () => {
    cleanupTestVars();
    try {
      assert.strictEqual(getenv('NON_EXISTENT'), '');
    } finally {
      restoreEnv();
    }
  });

  it('should try original key first', () => {
    cleanupTestVars();
    try {
      process.env.myKey = 'original';
      process.env.MY_KEY = 'upper';
      assert.strictEqual(getenv('myKey'), 'original');
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

        assert.strictEqual(config.port, 3000);
        assert.strictEqual(config.verbose, false);
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

        assert.strictEqual(config.port, 8080);
        assert.strictEqual(config.verbose, true);
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

        assert.strictEqual(config.apiKey, 'key123');
        assert.strictEqual(config['api-key'], undefined);
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

        assert.strictEqual(config.port, 5000);
        assert.strictEqual(process.env.APP_PORT, '5000');
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
        assert.strictEqual(config.port, 9000);
        assert.strictEqual(process.env.APP_PORT, '9000');
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
        assert.strictEqual(config.port, 7000);
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

        assert.strictEqual(config.port, 3000);
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

        assert.strictEqual(process.env.API_KEY, 'key123');
        assert.strictEqual(process.env.MY_PORT, '3000');
        assert.strictEqual(process.env.MY_HOST, 'localhost');
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
        assert.strictEqual(config.apiKey, 'secret');
        // Non-existent should use default
        assert.strictEqual(config.anotherKey, 'default');
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
        assert.strictEqual(config.port, 3000);
        assert.strictEqual(process.env.APP_PORT, undefined);
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

        assert.strictEqual(config.test, false);
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

        assert.strictEqual(config.port, 3000);
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

        assert.strictEqual(config.port, 9000);
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

        assert.strictEqual(config.port, 3000);
        assert.strictEqual(config.host, 'localhost');
        assert.strictEqual(config.name, 'base');

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

        assert.strictEqual(config.port, 5000); // from --configuration
        assert.strictEqual(config.host, 'override-host'); // from --configuration
        assert.strictEqual(config.name, 'base'); // from .lenv (not in --configuration)

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

        assert.strictEqual(config.port, 9000); // from CLI (highest priority)
        assert.strictEqual(config.host, 'override-host'); // from --configuration
        assert.strictEqual(config.name, 'base'); // from .lenv
      } finally {
        cleanup();
      }
    });
  });
});

// ============================================================================
// Built-in Flag Conflict Tests (issue #13)
// ============================================================================

describe('Built-in Flag Conflicts', () => {
  describe('Custom --version option', () => {
    it('should allow custom --version option without conflict', () => {
      const config = makeConfig({
        yargs: ({ yargs }) =>
          yargs.option('version', {
            type: 'string',
            default: '',
            describe: 'Version number (e.g., 1.0.0)',
          }),
        argv: ['node', 'script.js', '--version', '1.0.0'],
      });

      // Should parse the custom --version option value, not trigger yargs' built-in version
      assert.strictEqual(config.version, '1.0.0');
      assert.strictEqual(typeof config.version, 'string');
    });

    it('should work with custom --version option without value', () => {
      const config = makeConfig({
        yargs: ({ yargs }) =>
          yargs.option('version', {
            type: 'string',
            default: '0.0.0',
            describe: 'Version number',
          }),
        argv: ['node', 'script.js'],
      });

      // Should use default value
      assert.strictEqual(config.version, '0.0.0');
    });

    it('should parse --version from environment via getenv', () => {
      const originalEnv = { ...process.env };
      try {
        process.env.VERSION = '2.0.0';

        const config = makeConfig({
          yargs: ({ yargs, getenv }) =>
            yargs.option('version', {
              type: 'string',
              default: getenv('VERSION', ''),
              describe: 'Version number',
            }),
          argv: ['node', 'script.js'],
        });

        assert.strictEqual(config.version, '2.0.0');
      } finally {
        process.env = { ...originalEnv };
      }
    });
  });

  describe('Custom --help option', () => {
    it('should allow custom --help option without conflict', () => {
      const config = makeConfig({
        yargs: ({ yargs }) =>
          yargs.option('help', {
            type: 'string',
            default: '',
            describe: 'Help text or documentation URL',
          }),
        argv: ['node', 'script.js', '--help', 'https://docs.example.com'],
      });

      // Should parse the custom --help option value, not trigger yargs' built-in help
      assert.strictEqual(config.help, 'https://docs.example.com');
      assert.strictEqual(typeof config.help, 'string');
    });

    it('should work with custom --help option without value', () => {
      const config = makeConfig({
        yargs: ({ yargs }) =>
          yargs.option('help', {
            type: 'string',
            default: 'default-help',
            describe: 'Help text',
          }),
        argv: ['node', 'script.js'],
      });

      // Should use default value
      assert.strictEqual(config.help, 'default-help');
    });

    it('should parse --help from environment via getenv', () => {
      const originalEnv = { ...process.env };
      try {
        process.env.HELP = 'https://help.example.com';

        const config = makeConfig({
          yargs: ({ yargs, getenv }) =>
            yargs.option('help', {
              type: 'string',
              default: getenv('HELP', ''),
              describe: 'Help URL',
            }),
          argv: ['node', 'script.js'],
        });

        assert.strictEqual(config.help, 'https://help.example.com');
      } finally {
        process.env = { ...originalEnv };
      }
    });
  });

  describe('Both --version and --help custom options', () => {
    it('should allow both custom --version and --help options simultaneously', () => {
      const config = makeConfig({
        yargs: ({ yargs }) =>
          yargs
            .option('version', {
              type: 'string',
              default: '',
              describe: 'Version number',
            })
            .option('help', {
              type: 'string',
              default: '',
              describe: 'Help URL',
            }),
        argv: [
          'node',
          'script.js',
          '--version',
          '3.0.0',
          '--help',
          'https://help.example.com',
        ],
      });

      assert.strictEqual(config.version, '3.0.0');
      assert.strictEqual(config.help, 'https://help.example.com');
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
    assert.ok(result.includes('--verbose'));
    assert.ok(result.includes('--port'));
    assert.ok(result.includes('3000'));
  });

  it('should parse arguments without parentheses', () => {
    const input = '--debug\n--host localhost';
    const result = parseLinoArguments(input);
    assert.ok(result.includes('--debug'));
    assert.ok(result.includes('--host'));
    assert.ok(result.includes('localhost'));
  });

  it('should handle empty input', () => {
    const result = parseLinoArguments('');
    assert.deepStrictEqual(result, []);
  });

  it('should handle null input', () => {
    const result = parseLinoArguments(null);
    assert.deepStrictEqual(result, []);
  });

  it('should filter out comments', () => {
    const input = '# Comment\n--verbose\n# Another comment\n--debug';
    const result = parseLinoArguments(input);
    assert.ok(!result.some((arg) => arg.startsWith('#')));
    assert.ok(result.includes('--verbose'));
    assert.ok(result.includes('--debug'));
  });
});
