//! lino-arguments - A unified configuration library
//!
//! Combines environment variables and CLI arguments into a single
//! easy-to-use configuration system with clear priority ordering.
//!
//! Priority (highest to lowest):
//! 1. CLI arguments (manually entered options)
//! 2. Environment variables (from process.env)
//! 3. Configuration file (lenv file specified via CLI)
//! 4. Default values
//!
//! # Example
//!
//! ```rust,ignore
//! use lino_arguments::{Config, getenv};
//!
//! let config = Config::builder()
//!     .port(getenv("PORT", 3000))
//!     .verbose(false)
//!     .build();
//! ```

use std::env;
use thiserror::Error;

// ============================================================================
// Error Types
// ============================================================================

/// Errors that can occur during configuration
#[derive(Error, Debug)]
pub enum ConfigError {
    #[error("Environment variable error: {0}")]
    EnvError(String),

    #[error("Parse error: {0}")]
    ParseError(String),

    #[error("Configuration file error: {0}")]
    FileError(String),
}

// ============================================================================
// Case Conversion Utilities
// ============================================================================

/// Convert string to UPPER_CASE (for environment variables)
///
/// # Examples
///
/// ```
/// use lino_arguments::to_upper_case;
///
/// assert_eq!(to_upper_case("apiKey"), "API_KEY");
/// assert_eq!(to_upper_case("my-variable-name"), "MY_VARIABLE_NAME");
/// ```
pub fn to_upper_case(s: &str) -> String {
    // If already all uppercase, just replace separators
    if s.chars().all(|c| c.is_uppercase() || c == '_' || c == '-') {
        return s.replace('-', "_");
    }

    let mut result = String::new();
    let chars: Vec<char> = s.chars().collect();

    for (i, c) in chars.iter().enumerate() {
        if c.is_uppercase() && i > 0 {
            result.push('_');
        }
        if *c == '-' || *c == ' ' {
            result.push('_');
        } else {
            result.push(c.to_ascii_uppercase());
        }
    }

    // Remove leading underscore and double underscores
    result = result.trim_start_matches('_').to_string();
    while result.contains("__") {
        result = result.replace("__", "_");
    }

    result
}

/// Convert string to camelCase (for config object keys)
///
/// # Examples
///
/// ```
/// use lino_arguments::to_camel_case;
///
/// assert_eq!(to_camel_case("api-key"), "apiKey");
/// assert_eq!(to_camel_case("API_KEY"), "apiKey");
/// ```
pub fn to_camel_case(s: &str) -> String {
    let lower = s.to_lowercase();
    let mut result = String::new();
    let mut capitalize_next = false;

    for c in lower.chars() {
        if c == '-' || c == '_' || c == ' ' {
            capitalize_next = true;
        } else if capitalize_next {
            result.push(c.to_ascii_uppercase());
            capitalize_next = false;
        } else {
            result.push(c);
        }
    }

    // Ensure first character is lowercase
    if let Some(first) = result.chars().next() {
        if first.is_uppercase() {
            result = first.to_lowercase().to_string() + &result[1..];
        }
    }

    result
}

/// Convert string to kebab-case (for CLI options)
///
/// # Examples
///
/// ```
/// use lino_arguments::to_kebab_case;
///
/// assert_eq!(to_kebab_case("apiKey"), "api-key");
/// assert_eq!(to_kebab_case("API_KEY"), "api-key");
/// ```
pub fn to_kebab_case(s: &str) -> String {
    // If already all uppercase with underscores, convert directly
    if s.chars().all(|c| c.is_uppercase() || c == '_') && s.contains('_') {
        return s.replace('_', "-").to_lowercase();
    }

    let mut result = String::new();
    let chars: Vec<char> = s.chars().collect();

    for (i, c) in chars.iter().enumerate() {
        if c.is_uppercase() && i > 0 {
            result.push('-');
        }
        if *c == '_' || *c == ' ' {
            result.push('-');
        } else {
            result.push(c.to_ascii_lowercase());
        }
    }

    // Remove leading dash and double dashes
    result = result.trim_start_matches('-').to_string();
    while result.contains("--") {
        result = result.replace("--", "-");
    }

    result
}

/// Convert string to snake_case
///
/// # Examples
///
/// ```
/// use lino_arguments::to_snake_case;
///
/// assert_eq!(to_snake_case("apiKey"), "api_key");
/// assert_eq!(to_snake_case("API_KEY"), "api_key");
/// ```
pub fn to_snake_case(s: &str) -> String {
    // If already all uppercase with underscores, just lowercase
    if s.chars().all(|c| c.is_uppercase() || c == '_') && s.contains('_') {
        return s.to_lowercase();
    }

    let mut result = String::new();
    let chars: Vec<char> = s.chars().collect();

    for (i, c) in chars.iter().enumerate() {
        if c.is_uppercase() && i > 0 {
            result.push('_');
        }
        if *c == '-' || *c == ' ' {
            result.push('_');
        } else {
            result.push(c.to_ascii_lowercase());
        }
    }

    // Remove leading underscore and double underscores
    result = result.trim_start_matches('_').to_string();
    while result.contains("__") {
        result = result.replace("__", "_");
    }

    result
}

/// Convert string to PascalCase
///
/// # Examples
///
/// ```
/// use lino_arguments::to_pascal_case;
///
/// assert_eq!(to_pascal_case("api-key"), "ApiKey");
/// assert_eq!(to_pascal_case("api_key"), "ApiKey");
/// ```
pub fn to_pascal_case(s: &str) -> String {
    let lower = s.to_lowercase();
    let mut result = String::new();
    let mut capitalize_next = true;

    for c in lower.chars() {
        if c == '-' || c == '_' || c == ' ' {
            capitalize_next = true;
        } else if capitalize_next {
            result.push(c.to_ascii_uppercase());
            capitalize_next = false;
        } else {
            result.push(c);
        }
    }

    result
}

// ============================================================================
// Environment Variable Helper
// ============================================================================

/// Get environment variable with default value and case conversion.
/// Tries multiple case formats to find the variable.
///
/// # Examples
///
/// ```
/// use lino_arguments::getenv;
///
/// // Try to get API_KEY, apiKey, api-key, etc.
/// let api_key = getenv("apiKey", "default-key");
/// let port = getenv("PORT", "3000");
/// ```
pub fn getenv(key: &str, default: &str) -> String {
    // Try different case formats
    let variants = [
        key.to_string(),
        to_upper_case(key),
        to_camel_case(key),
        to_kebab_case(key),
        to_snake_case(key),
        to_pascal_case(key),
    ];

    for variant in variants.iter() {
        if let Ok(value) = env::var(variant) {
            return value;
        }
    }

    default.to_string()
}

/// Get environment variable as integer with default value.
/// Tries multiple case formats to find the variable.
///
/// # Examples
///
/// ```
/// use lino_arguments::getenv_int;
///
/// let port = getenv_int("PORT", 3000);
/// ```
pub fn getenv_int(key: &str, default: i64) -> i64 {
    let value = getenv(key, "");
    if value.is_empty() {
        return default;
    }
    value.parse().unwrap_or(default)
}

/// Get environment variable as boolean with default value.
/// Tries multiple case formats to find the variable.
/// Accepts: "true", "false", "1", "0", "yes", "no" (case-insensitive)
///
/// # Examples
///
/// ```
/// use lino_arguments::getenv_bool;
///
/// let debug = getenv_bool("DEBUG", false);
/// ```
pub fn getenv_bool(key: &str, default: bool) -> bool {
    let value = getenv(key, "");
    if value.is_empty() {
        return default;
    }
    match value.to_lowercase().as_str() {
        "true" | "1" | "yes" | "on" => true,
        "false" | "0" | "no" | "off" => false,
        _ => default,
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    mod case_conversion {
        use super::*;

        #[test]
        fn test_to_upper_case() {
            assert_eq!(to_upper_case("apiKey"), "API_KEY");
            assert_eq!(to_upper_case("myVariableName"), "MY_VARIABLE_NAME");
            assert_eq!(to_upper_case("api-key"), "API_KEY");
            assert_eq!(to_upper_case("API_KEY"), "API_KEY");
        }

        #[test]
        fn test_to_camel_case() {
            assert_eq!(to_camel_case("api-key"), "apiKey");
            assert_eq!(to_camel_case("API_KEY"), "apiKey");
            assert_eq!(to_camel_case("my_variable_name"), "myVariableName");
        }

        #[test]
        fn test_to_kebab_case() {
            assert_eq!(to_kebab_case("apiKey"), "api-key");
            assert_eq!(to_kebab_case("API_KEY"), "api-key");
            assert_eq!(to_kebab_case("MyVariableName"), "my-variable-name");
        }

        #[test]
        fn test_to_snake_case() {
            assert_eq!(to_snake_case("apiKey"), "api_key");
            assert_eq!(to_snake_case("api-key"), "api_key");
            assert_eq!(to_snake_case("API_KEY"), "api_key");
        }

        #[test]
        fn test_to_pascal_case() {
            assert_eq!(to_pascal_case("api-key"), "ApiKey");
            assert_eq!(to_pascal_case("api_key"), "ApiKey");
            assert_eq!(to_pascal_case("my-variable-name"), "MyVariableName");
        }
    }

    mod getenv_tests {
        use super::*;
        use std::env;

        #[test]
        fn test_getenv_with_default() {
            // Test that default is returned for non-existent var
            let result = getenv("NON_EXISTENT_VAR_12345", "default");
            assert_eq!(result, "default");
        }

        #[test]
        fn test_getenv_finds_var() {
            env::set_var("TEST_LINO_VAR", "test_value");
            let result = getenv("TEST_LINO_VAR", "default");
            assert_eq!(result, "test_value");
            env::remove_var("TEST_LINO_VAR");
        }

        #[test]
        fn test_getenv_int() {
            env::set_var("TEST_PORT", "8080");
            let result = getenv_int("TEST_PORT", 3000);
            assert_eq!(result, 8080);
            env::remove_var("TEST_PORT");
        }

        #[test]
        fn test_getenv_bool() {
            env::set_var("TEST_DEBUG", "true");
            let result = getenv_bool("TEST_DEBUG", false);
            assert!(result);
            env::remove_var("TEST_DEBUG");

            env::set_var("TEST_DEBUG", "1");
            let result = getenv_bool("TEST_DEBUG", false);
            assert!(result);
            env::remove_var("TEST_DEBUG");
        }
    }
}
