//! Integration tests for lino-arguments

use lino_arguments::{
    getenv, getenv_bool, getenv_int, to_camel_case, to_kebab_case, to_pascal_case, to_snake_case,
    to_upper_case,
};
use std::env;

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
