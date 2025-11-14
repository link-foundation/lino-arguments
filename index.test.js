import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import {
  parseLinoArguments,
  loadLinoEnv,
  applyLinoEnv,
  parseEnvArguments,
  createYargsConfig,
  mergeAndParse,
} from './index.js';

describe('parseLinoArguments', () => {
  it('should parse simple links notation format', () => {
    const input = '(\n  --verbose\n  --port 3000\n)';
    const result = parseLinoArguments(input);
    assert.deepStrictEqual(result, ['--verbose', '--port', '3000']);
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

  it('should handle complex arguments with values', () => {
    const input = '--config /path/to/config.json\n--output ./dist';
    const result = parseLinoArguments(input);
    assert.ok(result.includes('--config'));
    assert.ok(result.includes('/path/to/config.json'));
    assert.ok(result.includes('--output'));
    assert.ok(result.includes('./dist'));
  });
});

describe('loadLinoEnv', () => {
  const testEnvFile = join(process.cwd(), '.test.lenv');

  afterEach(() => {
    if (existsSync(testEnvFile)) {
      unlinkSync(testEnvFile);
    }
  });

  it('should load environment variables from .lenv file', () => {
    writeFileSync(testEnvFile, 'TEST_VAR: test_value\nAPI_KEY: secret123\n');

    const env = loadLinoEnv(testEnvFile);
    assert.strictEqual(env.get('TEST_VAR'), 'test_value');
    assert.strictEqual(env.get('API_KEY'), 'secret123');
  });

  it('should handle non-existent file gracefully', () => {
    const env = loadLinoEnv('non-existent.lenv');
    assert.strictEqual(env.get('ANY_VAR'), undefined);
  });

  it('should handle empty .lenv file', () => {
    writeFileSync(testEnvFile, '');
    const env = loadLinoEnv(testEnvFile);
    assert.strictEqual(env.keys().length, 0);
  });
});

describe('applyLinoEnv', () => {
  const testEnvFile = join(process.cwd(), '.test-apply.lenv');
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clean up test variables before each test
    delete process.env.TEST_APPLY_VAR;
    delete process.env.ANOTHER_VAR;
  });

  afterEach(() => {
    if (existsSync(testEnvFile)) {
      unlinkSync(testEnvFile);
    }
    // Restore original environment
    process.env = { ...originalEnv };
  });

  it('should apply .lenv variables to process.env', () => {
    writeFileSync(
      testEnvFile,
      'TEST_APPLY_VAR: applied_value\nANOTHER_VAR: another_value\n'
    );

    applyLinoEnv(testEnvFile);
    assert.strictEqual(process.env.TEST_APPLY_VAR, 'applied_value');
    assert.strictEqual(process.env.ANOTHER_VAR, 'another_value');
  });

  it('should not override existing process.env by default', () => {
    process.env.EXISTING_VAR = 'original';
    writeFileSync(testEnvFile, 'EXISTING_VAR: new_value\n');

    applyLinoEnv(testEnvFile);
    assert.strictEqual(process.env.EXISTING_VAR, 'original');
  });

  it('should override existing process.env when override option is true', () => {
    process.env.EXISTING_VAR = 'original';
    writeFileSync(testEnvFile, 'EXISTING_VAR: new_value\n');

    applyLinoEnv(testEnvFile, { override: true });
    assert.strictEqual(process.env.EXISTING_VAR, 'new_value');
  });

  it('should handle non-existent file gracefully', () => {
    const result = applyLinoEnv('non-existent-apply.lenv');
    assert.deepStrictEqual(result, {});
  });
});

describe('parseEnvArguments', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.TEST_OVERRIDES;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('should parse arguments from environment variable', () => {
    process.env.TEST_OVERRIDES = '--verbose\n--port 8080';
    const result = parseEnvArguments('TEST_OVERRIDES');
    assert.ok(result.includes('--verbose'));
    assert.ok(result.includes('--port'));
    assert.ok(result.includes('8080'));
  });

  it('should use default value when env var is not set', () => {
    const result = parseEnvArguments('NON_EXISTENT_VAR', '--default');
    assert.ok(result.includes('--default'));
  });

  it('should return empty array for non-existent var without default', () => {
    const result = parseEnvArguments('NON_EXISTENT_VAR');
    assert.deepStrictEqual(result, []);
  });
});

describe('createYargsConfig', () => {
  it('should create a yargs instance', () => {
    const yargsInstance = createYargsConfig();
    assert.ok(yargsInstance);
    assert.ok(typeof yargsInstance.parse === 'function');
  });

  it('should accept custom argv', () => {
    const customArgv = ['node', 'script.js', '--test'];
    const yargsInstance = createYargsConfig(customArgv);
    assert.ok(yargsInstance);
  });
});

describe('mergeAndParse', () => {
  const testEnvFile = join(process.cwd(), '.test-merge.lenv');
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.MERGE_TEST_VAR;
    delete process.env.CLI_OVERRIDES;
  });

  afterEach(() => {
    if (existsSync(testEnvFile)) {
      unlinkSync(testEnvFile);
    }
    process.env = { ...originalEnv };
  });

  it('should merge .lenv file and parse arguments', async () => {
    writeFileSync(testEnvFile, 'MERGE_TEST_VAR: from_lenv\n');

    const args = await mergeAndParse({
      yargsConfig: (yargs) =>
        yargs.option('verbose', { type: 'boolean', default: false }),
      lenvPath: testEnvFile,
      additionalArgs: ['--verbose'],
    });

    assert.strictEqual(args.verbose, true);
    assert.strictEqual(process.env.MERGE_TEST_VAR, 'from_lenv');
  });

  it('should handle environment variable overrides', async () => {
    process.env.CLI_OVERRIDES = '--debug\n--port 9000';

    const args = await mergeAndParse({
      yargsConfig: (yargs) =>
        yargs
          .option('debug', { type: 'boolean', default: false })
          .option('port', { type: 'number', default: 3000 }),
      overridesEnvVar: 'CLI_OVERRIDES',
    });

    assert.strictEqual(args.debug, true);
    assert.strictEqual(args.port, 9000);
  });

  it('should work without .lenv file', async () => {
    const args = await mergeAndParse({
      yargsConfig: (yargs) =>
        yargs.option('test', { type: 'boolean', default: false }),
      lenvPath: 'non-existent.lenv',
      additionalArgs: ['--test'],
    });

    assert.strictEqual(args.test, true);
  });

  it('should not apply env to process when applyEnvToProcess is false', async () => {
    writeFileSync(testEnvFile, 'NO_APPLY_VAR: should_not_appear\n');

    await mergeAndParse({
      yargsConfig: (yargs) => yargs,
      lenvPath: testEnvFile,
      applyEnvToProcess: false,
    });

    assert.strictEqual(process.env.NO_APPLY_VAR, undefined);
  });

  it('should merge multiple sources correctly', async () => {
    writeFileSync(testEnvFile, 'MERGE_VAR: from_file\n');
    process.env.CLI_OVERRIDES = '--override-flag';

    const args = await mergeAndParse({
      yargsConfig: (yargs) =>
        yargs
          .option('local', { type: 'boolean', default: false })
          .option('override-flag', { type: 'boolean', default: false }),
      lenvPath: testEnvFile,
      overridesEnvVar: 'CLI_OVERRIDES',
      additionalArgs: ['--local'],
    });

    assert.strictEqual(args.local, true);
    assert.strictEqual(args['override-flag'], true);
    assert.strictEqual(process.env.MERGE_VAR, 'from_file');
  });
});

describe('integration tests', () => {
  const testEnvFile = join(process.cwd(), '.integration.lenv');
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.APP_PORT;
    delete process.env.APP_HOST;
    delete process.env.INTEGRATION_OVERRIDES;
  });

  afterEach(() => {
    if (existsSync(testEnvFile)) {
      unlinkSync(testEnvFile);
    }
    process.env = { ...originalEnv };
  });

  it('should support full workflow: .lenv + env overrides + CLI args', async () => {
    // Step 1: Create .lenv file with defaults
    writeFileSync(
      testEnvFile,
      'APP_PORT: 3000\nAPP_HOST: localhost\nAPP_NAME: test-app\n'
    );

    // Step 2: Set environment override
    process.env.INTEGRATION_OVERRIDES = '--verbose\n--debug';

    // Step 3: Parse everything together
    const args = await mergeAndParse({
      yargsConfig: (yargs) =>
        yargs
          .option('verbose', { type: 'boolean', default: false })
          .option('debug', { type: 'boolean', default: false })
          .option('production', { type: 'boolean', default: false }),
      lenvPath: testEnvFile,
      overridesEnvVar: 'INTEGRATION_OVERRIDES',
      additionalArgs: ['--production'],
    });

    // Verify all sources were merged
    assert.strictEqual(args.verbose, true); // from env override
    assert.strictEqual(args.debug, true); // from env override
    assert.strictEqual(args.production, true); // from additional args
    assert.strictEqual(process.env.APP_PORT, '3000'); // from .lenv
    assert.strictEqual(process.env.APP_HOST, 'localhost'); // from .lenv
    assert.strictEqual(process.env.APP_NAME, 'test-app'); // from .lenv
  });
});
