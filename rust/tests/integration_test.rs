//! Integration tests for lino-arguments

use lino_arguments::{
    getenv, getenv_bool, getenv_int, load_lenv_file, load_lenv_file_override, read_lino_env,
    to_camel_case, to_kebab_case, to_pascal_case, to_snake_case, to_upper_case, write_lino_env,
    LinoEnv,
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
