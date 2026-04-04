//! Integration tests for lino-arguments

use lino_arguments::{
    getenv, getenv_bool, getenv_int, init_with, load_env_file, load_env_file_override,
    load_lenv_file, load_lenv_file_override, make_config_from, read_lino_env, to_camel_case,
    to_kebab_case, to_pascal_case, to_snake_case, to_upper_case, write_lino_env, LinoEnv,
    LinoParser, Parser,
};
use std::collections::HashMap;
use std::env;
use std::fs;
use tempfile::tempdir;

// ============================================================================
// Case Conversion Tests
// ============================================================================

mod case_conversion {
    use super::*;

    #[test]
    fn test_to_upper_case_from_camel_case() {
        assert_eq!(to_upper_case("apiKey"), "API_KEY");
        assert_eq!(to_upper_case("myVariableName"), "MY_VARIABLE_NAME");
    }

    #[test]
    fn test_to_upper_case_from_kebab_case() {
        assert_eq!(to_upper_case("api-key"), "API_KEY");
        assert_eq!(to_upper_case("my-variable-name"), "MY_VARIABLE_NAME");
    }

    #[test]
    fn test_to_upper_case_from_snake_case() {
        assert_eq!(to_upper_case("api_key"), "API_KEY");
        assert_eq!(to_upper_case("my_variable_name"), "MY_VARIABLE_NAME");
    }

    #[test]
    fn test_to_upper_case_from_pascal_case() {
        assert_eq!(to_upper_case("ApiKey"), "API_KEY");
        assert_eq!(to_upper_case("MyVariableName"), "MY_VARIABLE_NAME");
    }

    #[test]
    fn test_to_camel_case_from_kebab_case() {
        assert_eq!(to_camel_case("api-key"), "apiKey");
        assert_eq!(to_camel_case("my-variable-name"), "myVariableName");
    }

    #[test]
    fn test_to_camel_case_from_upper_case() {
        assert_eq!(to_camel_case("API_KEY"), "apiKey");
        assert_eq!(to_camel_case("MY_VARIABLE_NAME"), "myVariableName");
    }

    #[test]
    fn test_to_kebab_case_from_camel_case() {
        assert_eq!(to_kebab_case("apiKey"), "api-key");
        assert_eq!(to_kebab_case("myVariableName"), "my-variable-name");
    }

    #[test]
    fn test_to_kebab_case_from_upper_case() {
        assert_eq!(to_kebab_case("API_KEY"), "api-key");
        assert_eq!(to_kebab_case("MY_VARIABLE_NAME"), "my-variable-name");
    }

    #[test]
    fn test_to_snake_case_from_camel_case() {
        assert_eq!(to_snake_case("apiKey"), "api_key");
        assert_eq!(to_snake_case("myVariableName"), "my_variable_name");
    }

    #[test]
    fn test_to_snake_case_from_kebab_case() {
        assert_eq!(to_snake_case("api-key"), "api_key");
        assert_eq!(to_snake_case("my-variable-name"), "my_variable_name");
    }

    #[test]
    fn test_to_pascal_case_from_kebab_case() {
        assert_eq!(to_pascal_case("api-key"), "ApiKey");
        assert_eq!(to_pascal_case("my-variable-name"), "MyVariableName");
    }

    #[test]
    fn test_to_pascal_case_from_snake_case() {
        assert_eq!(to_pascal_case("api_key"), "ApiKey");
        assert_eq!(to_pascal_case("my_variable_name"), "MyVariableName");
    }
}

// ============================================================================
// Environment Variable Tests
// ============================================================================

mod getenv_tests {
    use super::*;

    #[test]
    fn test_getenv_returns_default_when_not_found() {
        let result = getenv("NON_EXISTENT_LINO_TEST_VAR", "default_value");
        assert_eq!(result, "default_value");
    }

    #[test]
    fn test_getenv_finds_variable_in_upper_case() {
        env::set_var("LINO_TEST_API_KEY", "secret123");
        let result = getenv("LINO_TEST_API_KEY", "default");
        assert_eq!(result, "secret123");
        env::remove_var("LINO_TEST_API_KEY");
    }

    #[test]
    fn test_getenv_int_parses_correctly() {
        env::set_var("LINO_TEST_PORT", "8080");
        let result = getenv_int("LINO_TEST_PORT", 3000);
        assert_eq!(result, 8080);
        env::remove_var("LINO_TEST_PORT");
    }

    #[test]
    fn test_getenv_int_returns_default_on_parse_error() {
        env::set_var("LINO_TEST_PORT_INVALID", "not_a_number");
        let result = getenv_int("LINO_TEST_PORT_INVALID", 3000);
        assert_eq!(result, 3000);
        env::remove_var("LINO_TEST_PORT_INVALID");
    }

    #[test]
    fn test_getenv_bool_parses_true_values() {
        for value in &["true", "1", "yes", "on", "TRUE", "YES", "ON"] {
            env::set_var("LINO_TEST_BOOL_TRUE", value);
            let result = getenv_bool("LINO_TEST_BOOL_TRUE", false);
            assert!(result, "Expected true for value: {}", value);
            env::remove_var("LINO_TEST_BOOL_TRUE");
        }
    }

    #[test]
    fn test_getenv_bool_parses_false_values() {
        for value in &["false", "0", "no", "off", "FALSE", "NO", "OFF"] {
            env::set_var("LINO_TEST_BOOL_FALSE", value);
            let result = getenv_bool("LINO_TEST_BOOL_FALSE", true);
            assert!(!result, "Expected false for value: {}", value);
            env::remove_var("LINO_TEST_BOOL_FALSE");
        }
    }

    #[test]
    fn test_getenv_bool_returns_default_on_invalid() {
        env::set_var("LINO_TEST_BOOL_INVALID", "maybe");
        let result = getenv_bool("LINO_TEST_BOOL_INVALID", true);
        assert!(result);
        env::remove_var("LINO_TEST_BOOL_INVALID");
    }
}

// ============================================================================
// .lenv File Loading Tests
// ============================================================================

mod lenv_file_tests {
    use super::*;

    #[test]
    fn test_load_lenv_file_sets_env_vars() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("test.lenv");
        let file_path_str = file_path.to_str().unwrap();

        // Write a test .lenv file
        fs::write(
            &file_path,
            "LINO_TEST_LENV_PORT: 9090\nLINO_TEST_LENV_HOST: localhost\n",
        )
        .unwrap();

        // Ensure env vars don't exist before loading
        env::remove_var("LINO_TEST_LENV_PORT");
        env::remove_var("LINO_TEST_LENV_HOST");

        // Load the file
        let loaded = load_lenv_file(file_path_str).unwrap();
        assert_eq!(loaded, 2);

        // Check env vars are set
        assert_eq!(env::var("LINO_TEST_LENV_PORT").unwrap(), "9090");
        assert_eq!(env::var("LINO_TEST_LENV_HOST").unwrap(), "localhost");

        // Cleanup
        env::remove_var("LINO_TEST_LENV_PORT");
        env::remove_var("LINO_TEST_LENV_HOST");
    }

    #[test]
    fn test_load_lenv_file_does_not_overwrite_existing() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("test2.lenv");
        let file_path_str = file_path.to_str().unwrap();

        // Write a test .lenv file
        fs::write(&file_path, "LINO_TEST_LENV_EXISTING: from_file\n").unwrap();

        // Set the env var before loading
        env::set_var("LINO_TEST_LENV_EXISTING", "from_env");

        // Load the file
        let loaded = load_lenv_file(file_path_str).unwrap();
        assert_eq!(loaded, 0); // Should not have loaded anything

        // Check env var was NOT overwritten
        assert_eq!(env::var("LINO_TEST_LENV_EXISTING").unwrap(), "from_env");

        // Cleanup
        env::remove_var("LINO_TEST_LENV_EXISTING");
    }

    #[test]
    fn test_load_lenv_file_override_overwrites() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("test3.lenv");
        let file_path_str = file_path.to_str().unwrap();

        // Write a test .lenv file
        fs::write(&file_path, "LINO_TEST_LENV_OVERRIDE: from_file\n").unwrap();

        // Set the env var before loading
        env::set_var("LINO_TEST_LENV_OVERRIDE", "from_env");

        // Load the file with override
        let loaded = load_lenv_file_override(file_path_str).unwrap();
        assert_eq!(loaded, 1);

        // Check env var WAS overwritten
        assert_eq!(env::var("LINO_TEST_LENV_OVERRIDE").unwrap(), "from_file");

        // Cleanup
        env::remove_var("LINO_TEST_LENV_OVERRIDE");
    }

    #[test]
    fn test_load_lenv_file_nonexistent_returns_ok() {
        // Loading a non-existent file should not error (per lino-env behavior)
        let result = load_lenv_file("/nonexistent/path/to/file.lenv");
        assert!(result.is_ok());
    }

    #[test]
    fn test_lino_env_reexport_works() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("reexport.lenv");
        let file_path_str = file_path.to_str().unwrap();

        // Test LinoEnv direct usage through re-export
        let mut lenv = LinoEnv::new(file_path_str);
        lenv.set("TEST_KEY", "test_value");
        lenv.write().unwrap();

        // Read it back using read_lino_env
        let loaded = read_lino_env(file_path_str).unwrap();
        assert_eq!(loaded.get("TEST_KEY"), Some("test_value".to_string()));
    }

    #[test]
    fn test_write_lino_env_reexport_works() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("write_test.lenv");
        let file_path_str = file_path.to_str().unwrap();

        // Test write_lino_env convenience function
        let mut data = HashMap::new();
        data.insert("KEY1".to_string(), "value1".to_string());
        data.insert("KEY2".to_string(), "value2".to_string());

        write_lino_env(file_path_str, &data).unwrap();

        // Verify the file was written
        let content = fs::read_to_string(&file_path).unwrap();
        assert!(content.contains("KEY1: value1") || content.contains("KEY2: value2"));
    }
}

// ============================================================================
// .env File Loading Tests
// ============================================================================

mod env_file_tests {
    use super::*;

    #[test]
    fn test_load_env_file_sets_env_vars() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join(".env");
        let file_path_str = file_path.to_str().unwrap();

        // Write a standard .env file
        fs::write(
            &file_path,
            "LINO_TEST_ENV_PORT=9090\nLINO_TEST_ENV_HOST=localhost\n",
        )
        .unwrap();

        // Ensure env vars don't exist before loading
        env::remove_var("LINO_TEST_ENV_PORT");
        env::remove_var("LINO_TEST_ENV_HOST");

        // Load the file
        let loaded = load_env_file(file_path_str).unwrap();
        assert_eq!(loaded, 2);

        // Check env vars are set
        assert_eq!(env::var("LINO_TEST_ENV_PORT").unwrap(), "9090");
        assert_eq!(env::var("LINO_TEST_ENV_HOST").unwrap(), "localhost");

        // Cleanup
        env::remove_var("LINO_TEST_ENV_PORT");
        env::remove_var("LINO_TEST_ENV_HOST");
    }

    #[test]
    fn test_load_env_file_does_not_overwrite_existing() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join(".env");
        let file_path_str = file_path.to_str().unwrap();

        fs::write(&file_path, "LINO_TEST_ENV_EXISTING=from_file\n").unwrap();

        // Set the env var before loading
        env::set_var("LINO_TEST_ENV_EXISTING", "from_env");

        let loaded = load_env_file(file_path_str).unwrap();
        assert_eq!(loaded, 0);

        assert_eq!(env::var("LINO_TEST_ENV_EXISTING").unwrap(), "from_env");

        env::remove_var("LINO_TEST_ENV_EXISTING");
    }

    #[test]
    fn test_load_env_file_override_overwrites() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join(".env");
        let file_path_str = file_path.to_str().unwrap();

        fs::write(&file_path, "LINO_TEST_ENV_OVERRIDE=from_file\n").unwrap();

        env::set_var("LINO_TEST_ENV_OVERRIDE", "from_env");

        let loaded = load_env_file_override(file_path_str).unwrap();
        assert_eq!(loaded, 1);

        assert_eq!(env::var("LINO_TEST_ENV_OVERRIDE").unwrap(), "from_file");

        env::remove_var("LINO_TEST_ENV_OVERRIDE");
    }

    #[test]
    fn test_load_env_file_nonexistent_returns_ok() {
        let result = load_env_file("/nonexistent/path/to/file.env");
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 0);
    }

    #[test]
    fn test_load_env_file_quoted_values() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join(".env");
        let file_path_str = file_path.to_str().unwrap();

        fs::write(
            &file_path,
            "LINO_TEST_ENV_QUOTED=\"hello world\"\nLINO_TEST_ENV_SINGLE='single quotes'\n",
        )
        .unwrap();

        env::remove_var("LINO_TEST_ENV_QUOTED");
        env::remove_var("LINO_TEST_ENV_SINGLE");

        load_env_file(file_path_str).unwrap();

        assert_eq!(env::var("LINO_TEST_ENV_QUOTED").unwrap(), "hello world");
        assert_eq!(env::var("LINO_TEST_ENV_SINGLE").unwrap(), "single quotes");

        env::remove_var("LINO_TEST_ENV_QUOTED");
        env::remove_var("LINO_TEST_ENV_SINGLE");
    }
}

// ============================================================================
// Integration Tests - getenv with lenv file
// ============================================================================

mod getenv_with_lenv {
    use super::*;

    #[test]
    fn test_getenv_works_with_loaded_lenv_file() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("integration.lenv");
        let file_path_str = file_path.to_str().unwrap();

        // Write a test .lenv file
        fs::write(&file_path, "LINO_TEST_INTEGRATION_VAR: from_lenv_file\n").unwrap();

        // Ensure env var doesn't exist
        env::remove_var("LINO_TEST_INTEGRATION_VAR");

        // Load the file
        load_lenv_file(file_path_str).unwrap();

        // Now getenv should find the value
        let result = getenv("LINO_TEST_INTEGRATION_VAR", "default");
        assert_eq!(result, "from_lenv_file");

        // Cleanup
        env::remove_var("LINO_TEST_INTEGRATION_VAR");
    }
}

// ============================================================================
// Clap Re-export Tests
// ============================================================================

mod clap_reexport {
    use super::*;

    /// Verify that the Parser derive macro works through lino-arguments re-export
    #[derive(Parser, Debug)]
    #[command(name = "test-app")]
    struct TestArgs {
        #[arg(short, long, default_value = "3000")]
        port: String,

        #[arg(short, long)]
        verbose: bool,
    }

    #[test]
    fn test_parser_derive_works() {
        // Parse with explicit args (simulating CLI)
        let args = TestArgs::parse_from(["test-app", "--port", "8080", "--verbose"]);
        assert_eq!(args.port, "8080");
        assert!(args.verbose);
    }

    #[test]
    fn test_parser_defaults_work() {
        let args = TestArgs::parse_from(["test-app"]);
        assert_eq!(args.port, "3000");
        assert!(!args.verbose);
    }
}

// ============================================================================
// LinoParser Trait Tests
// ============================================================================

mod lino_parser_tests {
    use super::*;

    // Each test uses a unique struct with unique env var names to avoid
    // interference when tests run in parallel (sharing process env).

    #[test]
    fn test_lino_parse_from_with_lenv_file() {
        #[derive(Parser, Debug)]
        #[command(name = "test")]
        struct Args {
            #[arg(long, env = "LP_LENV_PORT_T1", default_value = "3000")]
            port: u16,
            #[arg(long, env = "LP_LENV_HOST_T1", default_value = "localhost")]
            host: String,
            #[arg(long, env = "LP_LENV_VERBOSE_T1")]
            verbose: bool,
        }

        let dir = tempdir().unwrap();
        let lenv_path = dir.path().join("test.lenv");
        let lenv_path_str = lenv_path.to_str().unwrap();

        fs::write(&lenv_path, "LP_LENV_PORT_T1: 8080\n").unwrap();
        env::remove_var("LP_LENV_PORT_T1");

        let args = Args::lino_parse_from_with(["test"], Some(lenv_path_str), None);

        assert_eq!(args.port, 8080);
        assert_eq!(args.host, "localhost");
        assert!(!args.verbose);

        env::remove_var("LP_LENV_PORT_T1");
    }

    #[test]
    fn test_lino_parse_from_with_env_file() {
        #[derive(Parser, Debug)]
        #[command(name = "test")]
        struct Args {
            #[arg(long, env = "LP_ENV_HOST_T2", default_value = "localhost")]
            host: String,
            #[arg(long, env = "LP_ENV_PORT_T2", default_value = "3000")]
            port: u16,
        }

        let dir = tempdir().unwrap();
        let env_path = dir.path().join(".env");
        let env_path_str = env_path.to_str().unwrap();

        fs::write(&env_path, "LP_ENV_HOST_T2=example.com\n").unwrap();
        env::remove_var("LP_ENV_HOST_T2");
        env::remove_var("LP_ENV_PORT_T2");

        let args = Args::lino_parse_from_with(["test"], None, Some(env_path_str));

        assert_eq!(args.host, "example.com");
        assert_eq!(args.port, 3000);

        env::remove_var("LP_ENV_HOST_T2");
    }

    #[test]
    fn test_lino_parse_cli_overrides_lenv() {
        #[derive(Parser, Debug)]
        #[command(name = "test")]
        struct Args {
            #[arg(long, env = "LP_CLI_PORT_T3", default_value = "3000")]
            port: u16,
        }

        let dir = tempdir().unwrap();
        let lenv_path = dir.path().join("test.lenv");
        let lenv_path_str = lenv_path.to_str().unwrap();

        fs::write(&lenv_path, "LP_CLI_PORT_T3: 8080\n").unwrap();
        env::remove_var("LP_CLI_PORT_T3");

        let args =
            Args::lino_parse_from_with(["test", "--port", "9999"], Some(lenv_path_str), None);

        assert_eq!(args.port, 9999);

        env::remove_var("LP_CLI_PORT_T3");
    }

    #[test]
    fn test_lino_parse_env_var_overrides_lenv() {
        #[derive(Parser, Debug)]
        #[command(name = "test")]
        struct Args {
            #[arg(long, env = "LP_ENVOV_PORT_T4", default_value = "3000")]
            port: u16,
        }

        let dir = tempdir().unwrap();
        let lenv_path = dir.path().join("test.lenv");
        let lenv_path_str = lenv_path.to_str().unwrap();

        fs::write(&lenv_path, "LP_ENVOV_PORT_T4: 8080\n").unwrap();

        // Set env var BEFORE loading .lenv — env var should take priority
        env::set_var("LP_ENVOV_PORT_T4", "7070");

        let args = Args::lino_parse_from_with(["test"], Some(lenv_path_str), None);

        assert_eq!(args.port, 7070);

        env::remove_var("LP_ENVOV_PORT_T4");
    }

    #[test]
    fn test_lino_parse_lenv_overrides_env_file() {
        #[derive(Parser, Debug)]
        #[command(name = "test")]
        struct Args {
            #[arg(long, env = "LP_LENVOV_PORT_T5", default_value = "3000")]
            port: u16,
        }

        let dir = tempdir().unwrap();
        let lenv_path = dir.path().join("test.lenv");
        let lenv_path_str = lenv_path.to_str().unwrap();
        let env_path = dir.path().join(".env");
        let env_path_str = env_path.to_str().unwrap();

        fs::write(&lenv_path, "LP_LENVOV_PORT_T5: 8080\n").unwrap();
        fs::write(&env_path, "LP_LENVOV_PORT_T5=5050\n").unwrap();

        env::remove_var("LP_LENVOV_PORT_T5");

        let args = Args::lino_parse_from_with(["test"], Some(lenv_path_str), Some(env_path_str));

        assert_eq!(args.port, 8080); // .lenv wins over .env

        env::remove_var("LP_LENVOV_PORT_T5");
    }

    #[test]
    fn test_lino_parse_full_priority_chain() {
        #[derive(Parser, Debug)]
        #[command(name = "test")]
        struct Args {
            #[arg(long, env = "LP_FPC_PORT_T6", default_value = "3000")]
            port: u16,
            #[arg(long, env = "LP_FPC_HOST_T6", default_value = "localhost")]
            host: String,
            #[arg(long, env = "LP_FPC_VERBOSE_T6")]
            verbose: bool,
        }

        let dir = tempdir().unwrap();
        let lenv_path = dir.path().join("test.lenv");
        let lenv_path_str = lenv_path.to_str().unwrap();
        let env_path = dir.path().join(".env");
        let env_path_str = env_path.to_str().unwrap();

        fs::write(&lenv_path, "LP_FPC_HOST_T6: from-lenv\n").unwrap();
        fs::write(&env_path, "LP_FPC_VERBOSE_T6=true\n").unwrap();

        env::remove_var("LP_FPC_PORT_T6");
        env::remove_var("LP_FPC_HOST_T6");
        env::remove_var("LP_FPC_VERBOSE_T6");

        let args = Args::lino_parse_from_with(
            ["test", "--port", "4000"],
            Some(lenv_path_str),
            Some(env_path_str),
        );

        assert_eq!(args.port, 4000); // from CLI
        assert_eq!(args.host, "from-lenv"); // from .lenv
        assert!(args.verbose); // from .env

        env::remove_var("LP_FPC_HOST_T6");
        env::remove_var("LP_FPC_VERBOSE_T6");
    }

    #[test]
    fn test_lino_parse_defaults_when_no_files() {
        #[derive(Parser, Debug)]
        #[command(name = "test")]
        struct Args {
            #[arg(long, env = "LP_DEF_PORT_T7", default_value = "3000")]
            port: u16,
            #[arg(long, env = "LP_DEF_HOST_T7", default_value = "localhost")]
            host: String,
            #[arg(long, env = "LP_DEF_VERBOSE_T7")]
            verbose: bool,
        }

        env::remove_var("LP_DEF_PORT_T7");
        env::remove_var("LP_DEF_HOST_T7");
        env::remove_var("LP_DEF_VERBOSE_T7");

        let args = Args::lino_parse_from_with(["test"], None, None);

        assert_eq!(args.port, 3000);
        assert_eq!(args.host, "localhost");
        assert!(!args.verbose);
    }
}

// ============================================================================
// Functional make_config API Tests
// ============================================================================

mod make_config_tests {
    use super::*;

    #[test]
    fn test_make_config_basic_options() {
        let config = make_config_from(["app", "--port", "9090"], |c| {
            c.option("port", "Server port", "3000")
        });

        assert_eq!(config.get("port"), "9090");
    }

    #[test]
    fn test_make_config_default_values() {
        let config = make_config_from(["app"], |c| {
            c.option("port", "Server port", "3000")
                .option("host", "Server host", "localhost")
        });

        assert_eq!(config.get("port"), "3000");
        assert_eq!(config.get("host"), "localhost");
    }

    #[test]
    fn test_make_config_flags() {
        let config = make_config_from(["app", "--verbose"], |c| {
            c.flag("verbose", "Enable verbose logging")
        });

        assert!(config.get_bool("verbose"));
    }

    #[test]
    fn test_make_config_flag_default_false() {
        let config = make_config_from(["app"], |c| c.flag("verbose", "Enable verbose logging"));

        assert!(!config.get_bool("verbose"));
    }

    #[test]
    fn test_make_config_short_options() {
        let config = make_config_from(["app", "-p", "4000"], |c| {
            c.option_short("port", 'p', "Server port", "3000")
        });

        assert_eq!(config.get("port"), "4000");
    }

    #[test]
    fn test_make_config_short_flags() {
        let config = make_config_from(["app", "-v"], |c| {
            c.flag_short("verbose", 'v', "Enable verbose logging")
        });

        assert!(config.get_bool("verbose"));
    }

    #[test]
    fn test_make_config_get_int() {
        let config = make_config_from(["app", "--port", "8080"], |c| {
            c.option("port", "Server port", "3000")
        });

        assert_eq!(config.get_int("port", 3000), 8080);
    }

    #[test]
    fn test_make_config_get_int_default() {
        let config = make_config_from(["app"], |c| c.option("retries", "Retry count", ""));

        assert_eq!(config.get_int("retries", 5), 5);
    }

    #[test]
    fn test_make_config_has() {
        let config = make_config_from(["app", "--port", "8080"], |c| {
            c.option("port", "Server port", "3000")
        });

        assert!(config.has("port"));
        assert!(!config.has("nonexistent"));
    }

    #[test]
    fn test_make_config_kebab_case_to_camel() {
        let config = make_config_from(["app", "--api-key", "secret123"], |c| {
            c.option("api-key", "API key", "")
        });

        // Access via kebab-case should work (converted to camelCase internally)
        assert_eq!(config.get("api-key"), "secret123");
        assert_eq!(config.get("apiKey"), "secret123");
    }

    #[test]
    fn test_make_config_with_lenv_file() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("test_make_config.lenv");
        let file_path_str = file_path.to_str().unwrap();

        fs::write(&file_path, "MC_LENV_PORT: 7070\n").unwrap();

        env::remove_var("MC_LENV_PORT");

        let config = make_config_from(["app"], |c| {
            c.lenv(file_path_str)
                .option("mc-lenv-port", "Server port", "3000")
        });

        assert_eq!(config.get("mcLenvPort"), "7070");

        env::remove_var("MC_LENV_PORT");
    }

    #[test]
    fn test_make_config_with_env_file() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join(".env");
        let file_path_str = file_path.to_str().unwrap();

        fs::write(&file_path, "MC_ENV_PORT=6060\n").unwrap();

        env::remove_var("MC_ENV_PORT");

        let config = make_config_from(["app"], |c| {
            c.env(file_path_str)
                .option("mc-env-port", "Server port", "3000")
        });

        assert_eq!(config.get("mcEnvPort"), "6060");

        env::remove_var("MC_ENV_PORT");
    }

    #[test]
    fn test_make_config_lenv_overrides_env_file() {
        let dir = tempdir().unwrap();
        let lenv_path = dir.path().join("test.lenv");
        let lenv_path_str = lenv_path.to_str().unwrap();
        let env_path = dir.path().join(".env");
        let env_path_str = env_path.to_str().unwrap();

        fs::write(&lenv_path, "MC_LENVOV_PORT: 8080\n").unwrap();
        fs::write(&env_path, "MC_LENVOV_PORT=5050\n").unwrap();

        env::remove_var("MC_LENVOV_PORT");

        let config = make_config_from(["app"], |c| {
            c.lenv(lenv_path_str)
                .env(env_path_str)
                .option("mc-lenvov-port", "Port", "3000")
        });

        // .lenv should win over .env
        assert_eq!(config.get("mcLenvovPort"), "8080");

        env::remove_var("MC_LENVOV_PORT");
    }

    #[test]
    fn test_make_config_cli_overrides_lenv() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("test_override.lenv");
        let file_path_str = file_path.to_str().unwrap();

        fs::write(&file_path, "MC_CLIOV_PORT: 7070\n").unwrap();

        env::remove_var("MC_CLIOV_PORT");

        let config = make_config_from(["app", "--mc-cliov-port", "9999"], |c| {
            c.lenv(file_path_str)
                .option("mc-cliov-port", "Server port", "3000")
        });

        // CLI should override .lenv value
        assert_eq!(config.get("mcCliovPort"), "9999");

        env::remove_var("MC_CLIOV_PORT");
    }

    #[test]
    fn test_make_config_multiple_options_and_flags() {
        let config = make_config_from(
            ["app", "--port", "8080", "--api-key", "secret", "--verbose"],
            |c| {
                c.option("port", "Server port", "3000")
                    .option("api-key", "API key", "")
                    .flag("verbose", "Enable verbose logging")
            },
        );

        assert_eq!(config.get("port"), "8080");
        assert_eq!(config.get("apiKey"), "secret");
        assert!(config.get_bool("verbose"));
    }

    #[test]
    fn test_make_config_app_metadata() {
        let config = make_config_from(["my-app", "--port", "8080"], |c| {
            c.name("my-app")
                .about("A test application")
                .version("1.0.0")
                .option("port", "Server port", "3000")
        });

        assert_eq!(config.get("port"), "8080");
    }
}

// ============================================================================
// init() and init_with() Tests
// ============================================================================

mod init_tests {
    use super::*;

    #[test]
    fn test_init_with_loads_lenv_file() {
        let dir = tempdir().unwrap();
        let lenv_path = dir.path().join("test.lenv");
        let lenv_path_str = lenv_path.to_str().unwrap();

        fs::write(&lenv_path, "INIT_LENV_PORT_T1: 7777\n").unwrap();
        env::remove_var("INIT_LENV_PORT_T1");

        init_with(Some(lenv_path_str), None);

        assert_eq!(env::var("INIT_LENV_PORT_T1").unwrap(), "7777");

        env::remove_var("INIT_LENV_PORT_T1");
    }

    #[test]
    fn test_init_with_loads_env_file() {
        let dir = tempdir().unwrap();
        let env_path = dir.path().join(".env");
        let env_path_str = env_path.to_str().unwrap();

        fs::write(&env_path, "INIT_ENV_HOST_T2=example.com\n").unwrap();
        env::remove_var("INIT_ENV_HOST_T2");

        init_with(None, Some(env_path_str));

        assert_eq!(env::var("INIT_ENV_HOST_T2").unwrap(), "example.com");

        env::remove_var("INIT_ENV_HOST_T2");
    }

    #[test]
    fn test_init_with_loads_both_files() {
        let dir = tempdir().unwrap();
        let lenv_path = dir.path().join("test.lenv");
        let lenv_path_str = lenv_path.to_str().unwrap();
        let env_path = dir.path().join(".env");
        let env_path_str = env_path.to_str().unwrap();

        fs::write(&lenv_path, "INIT_BOTH_A_T3: from_lenv\n").unwrap();
        fs::write(&env_path, "INIT_BOTH_B_T3=from_env\n").unwrap();

        env::remove_var("INIT_BOTH_A_T3");
        env::remove_var("INIT_BOTH_B_T3");

        init_with(Some(lenv_path_str), Some(env_path_str));

        assert_eq!(env::var("INIT_BOTH_A_T3").unwrap(), "from_lenv");
        assert_eq!(env::var("INIT_BOTH_B_T3").unwrap(), "from_env");

        env::remove_var("INIT_BOTH_A_T3");
        env::remove_var("INIT_BOTH_B_T3");
    }

    #[test]
    fn test_init_with_lenv_takes_priority_over_env() {
        let dir = tempdir().unwrap();
        let lenv_path = dir.path().join("test.lenv");
        let lenv_path_str = lenv_path.to_str().unwrap();
        let env_path = dir.path().join(".env");
        let env_path_str = env_path.to_str().unwrap();

        // Same key in both files — .lenv should win
        fs::write(&lenv_path, "INIT_PRIO_T4: from_lenv\n").unwrap();
        fs::write(&env_path, "INIT_PRIO_T4=from_env\n").unwrap();

        env::remove_var("INIT_PRIO_T4");

        init_with(Some(lenv_path_str), Some(env_path_str));

        // .lenv is loaded first, so it sets the var; .env won't overwrite
        assert_eq!(env::var("INIT_PRIO_T4").unwrap(), "from_lenv");

        env::remove_var("INIT_PRIO_T4");
    }

    #[test]
    fn test_init_with_existing_env_var_takes_priority() {
        let dir = tempdir().unwrap();
        let lenv_path = dir.path().join("test.lenv");
        let lenv_path_str = lenv_path.to_str().unwrap();

        fs::write(&lenv_path, "INIT_EXISTING_T5: from_lenv\n").unwrap();

        // Set env var BEFORE init — it should take priority
        env::set_var("INIT_EXISTING_T5", "from_process");

        init_with(Some(lenv_path_str), None);

        assert_eq!(env::var("INIT_EXISTING_T5").unwrap(), "from_process");

        env::remove_var("INIT_EXISTING_T5");
    }
}

// ============================================================================
// Drop-in parse() Tests (init + standard clap parse)
// ============================================================================

mod dropin_parse_tests {
    use super::*;

    #[test]
    fn test_dropin_parse_from_with_lenv() {
        #[derive(Parser, Debug)]
        #[command(name = "test")]
        struct Args {
            #[arg(long, env = "DI_LENV_PORT_T1", default_value = "3000")]
            port: u16,
        }

        let dir = tempdir().unwrap();
        let lenv_path = dir.path().join("test.lenv");
        let lenv_path_str = lenv_path.to_str().unwrap();

        fs::write(&lenv_path, "DI_LENV_PORT_T1: 8888\n").unwrap();
        env::remove_var("DI_LENV_PORT_T1");

        // Drop-in pattern: init_with + parse_from
        init_with(Some(lenv_path_str), None);
        let args = Args::parse_from(["test"]);

        assert_eq!(args.port, 8888);

        env::remove_var("DI_LENV_PORT_T1");
    }

    #[test]
    fn test_dropin_parse_from_with_env_file() {
        #[derive(Parser, Debug)]
        #[command(name = "test")]
        struct Args {
            #[arg(long, env = "DI_ENV_HOST_T2", default_value = "localhost")]
            host: String,
        }

        let dir = tempdir().unwrap();
        let env_path = dir.path().join(".env");
        let env_path_str = env_path.to_str().unwrap();

        fs::write(&env_path, "DI_ENV_HOST_T2=example.com\n").unwrap();
        env::remove_var("DI_ENV_HOST_T2");

        init_with(None, Some(env_path_str));
        let args = Args::parse_from(["test"]);

        assert_eq!(args.host, "example.com");

        env::remove_var("DI_ENV_HOST_T2");
    }

    #[test]
    fn test_dropin_cli_overrides_env_files() {
        #[derive(Parser, Debug)]
        #[command(name = "test")]
        struct Args {
            #[arg(long, env = "DI_CLI_PORT_T3", default_value = "3000")]
            port: u16,
        }

        let dir = tempdir().unwrap();
        let lenv_path = dir.path().join("test.lenv");
        let lenv_path_str = lenv_path.to_str().unwrap();

        fs::write(&lenv_path, "DI_CLI_PORT_T3: 8080\n").unwrap();
        env::remove_var("DI_CLI_PORT_T3");

        init_with(Some(lenv_path_str), None);
        let args = Args::parse_from(["test", "--port", "9999"]);

        assert_eq!(args.port, 9999); // CLI wins

        env::remove_var("DI_CLI_PORT_T3");
    }

    #[test]
    fn test_dropin_full_priority_chain() {
        #[derive(Parser, Debug)]
        #[command(name = "test")]
        struct Args {
            #[arg(long, env = "DI_FPC_PORT_T4", default_value = "3000")]
            port: u16,
            #[arg(long, env = "DI_FPC_HOST_T4", default_value = "localhost")]
            host: String,
            #[arg(long, env = "DI_FPC_VERBOSE_T4")]
            verbose: bool,
            #[arg(long, env = "DI_FPC_WORKERS_T4", default_value = "4")]
            workers: u16,
        }

        let dir = tempdir().unwrap();
        let lenv_path = dir.path().join("test.lenv");
        let lenv_path_str = lenv_path.to_str().unwrap();
        let env_path = dir.path().join(".env");
        let env_path_str = env_path.to_str().unwrap();

        fs::write(&lenv_path, "DI_FPC_HOST_T4: from-lenv\n").unwrap();
        fs::write(&env_path, "DI_FPC_VERBOSE_T4=true\n").unwrap();

        env::remove_var("DI_FPC_PORT_T4");
        env::remove_var("DI_FPC_HOST_T4");
        env::remove_var("DI_FPC_VERBOSE_T4");
        env::remove_var("DI_FPC_WORKERS_T4");

        init_with(Some(lenv_path_str), Some(env_path_str));
        let args = Args::parse_from(["test", "--port", "4000"]);

        assert_eq!(args.port, 4000); // from CLI
        assert_eq!(args.host, "from-lenv"); // from .lenv
        assert!(args.verbose); // from .env
        assert_eq!(args.workers, 4); // from default_value

        env::remove_var("DI_FPC_HOST_T4");
        env::remove_var("DI_FPC_VERBOSE_T4");
    }

    #[test]
    fn test_dropin_defaults_when_no_files() {
        #[derive(Parser, Debug)]
        #[command(name = "test")]
        struct Args {
            #[arg(long, env = "DI_DEF_PORT_T5", default_value = "3000")]
            port: u16,
        }

        env::remove_var("DI_DEF_PORT_T5");

        // init_with with no files — should still work
        init_with(None, None);
        let args = Args::parse_from(["test"]);

        assert_eq!(args.port, 3000);
    }
}
