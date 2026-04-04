//! lino-arguments - A unified configuration library
//!
//! Combines environment variables and CLI arguments into a single
//! easy-to-use configuration system with clear priority ordering.
//!
//! Works like a combination of [clap](https://docs.rs/clap) and
//! [dotenvy](https://docs.rs/dotenvy), but uses `.lenv` files via
//! [lino-env](https://docs.rs/lino-env) instead of `.env` files.
//!
//! Priority (highest to lowest):
//! 1. CLI arguments (manually entered options)
//! 2. Environment variables (from process.env)
//! 3. Configuration file (lenv file specified via CLI)
//! 4. Default values
//!
//! # Struct-Based Usage (like clap)
//!
//! ```rust,ignore
//! use lino_arguments::{Parser, getenv, getenv_int, getenv_bool, load_lenv_file};
//!
//! // Load .lenv file first (like dotenvy, but for .lenv format)
//! load_lenv_file(".lenv").ok();
//!
//! #[derive(Parser, Debug)]
//! #[command(name = "my-app")]
//! struct Args {
//!     #[arg(short, long, default_value_t = getenv_int("PORT", 3000) as u16)]
//!     port: u16,
//!
//!     #[arg(short = 'k', long, default_value = getenv("API_KEY", ""))]
//!     api_key: String,
//!
//!     #[arg(short, long, default_value_t = getenv_bool("VERBOSE", false))]
//!     verbose: bool,
//! }
//!
//! fn main() {
//!     let args = Args::parse();
//!     println!("Server starting on port {}", args.port);
//! }
//! ```
//!
//! # Functional Usage (like the JavaScript API)
//!
//! ```rust,ignore
//! use lino_arguments::make_config;
//!
//! let config = make_config(|c| {
//!     c.lenv(".lenv")
//!      .option("port", "Server port", "3000")
//!      .option("api-key", "API key", "")
//!      .flag("verbose", "Enable verbose logging")
//! });
//!
//! let port: u16 = config.get("port").parse().unwrap();
//! let verbose: bool = config.get_bool("verbose");
//! ```
//!
//! # .lenv File Format
//!
//! The `.lenv` file format uses `: ` (colon-space) as the separator:
//!
//! ```text
//! PORT: 8080
//! API_KEY: my-secret-key
//! DEBUG: true
//! ```

use std::collections::HashMap;
use std::env;
use thiserror::Error;

// Re-export clap derive macros and traits for struct-based usage.
// This allows users to use `lino_arguments::Parser` directly without
// depending on clap as a separate dependency.
pub use clap::{Args, Parser, Subcommand, ValueEnum};

// Re-export the arg attribute macro
pub use clap::arg;

// Re-export the command macro for #[command(...)] attribute
pub use clap::command;

// Re-export lino-env for direct file operations
pub use lino_env::{read_lino_env, write_lino_env, LinoEnv};

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

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
}

// ============================================================================
// .lenv File Loading
// ============================================================================

/// Load environment variables from a `.lenv` file.
///
/// This function reads a `.lenv` configuration file and sets the values
/// as environment variables. If the file doesn't exist, this function
/// returns Ok without setting any variables.
///
/// Note: Existing environment variables are NOT overwritten. This follows
/// the principle that environment variables have higher priority than
/// configuration files.
///
/// # Arguments
///
/// * `file_path` - Path to the `.lenv` file
///
/// # Examples
///
/// ```rust,ignore
/// use lino_arguments::load_lenv_file;
///
/// // Load from default .lenv file
/// load_lenv_file(".lenv").ok();
///
/// // Load from custom path
/// load_lenv_file("config/production.lenv")?;
/// ```
pub fn load_lenv_file(file_path: &str) -> Result<usize, ConfigError> {
    let lenv = read_lino_env(file_path)?;
    let mut loaded_count = 0;

    for key in lenv.keys() {
        // Only set if not already present in environment
        if env::var(&key).is_err() {
            if let Some(value) = lenv.get(&key) {
                env::set_var(&key, &value);
                loaded_count += 1;
            }
        }
    }

    Ok(loaded_count)
}

/// Load environment variables from a `.lenv` file, overwriting existing values.
///
/// Unlike `load_lenv_file`, this function will overwrite any existing
/// environment variables with the values from the file.
///
/// # Arguments
///
/// * `file_path` - Path to the `.lenv` file
///
/// # Examples
///
/// ```rust,ignore
/// use lino_arguments::load_lenv_file_override;
///
/// // Force load values, overwriting any existing env vars
/// load_lenv_file_override("config/override.lenv")?;
/// ```
pub fn load_lenv_file_override(file_path: &str) -> Result<usize, ConfigError> {
    let lenv = read_lino_env(file_path)?;
    let mut loaded_count = 0;

    for key in lenv.keys() {
        if let Some(value) = lenv.get(&key) {
            env::set_var(&key, &value);
            loaded_count += 1;
        }
    }

    Ok(loaded_count)
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
// Functional Configuration API (like JavaScript's makeConfig)
// ============================================================================

/// Resolved configuration values from the functional API.
///
/// Contains all parsed configuration values accessible by key name.
/// Values are stored as strings and can be retrieved with type conversion.
#[derive(Debug, Clone)]
pub struct Config {
    values: HashMap<String, String>,
}

impl Config {
    /// Get a configuration value as a string.
    /// Returns empty string if the key is not found.
    pub fn get(&self, key: &str) -> String {
        let camel = to_camel_case(key);
        self.values
            .get(&camel)
            .or_else(|| self.values.get(key))
            .cloned()
            .unwrap_or_default()
    }

    /// Get a configuration value as an integer.
    /// Returns the default if the key is not found or cannot be parsed.
    pub fn get_int(&self, key: &str, default: i64) -> i64 {
        let val = self.get(key);
        if val.is_empty() {
            return default;
        }
        val.parse().unwrap_or(default)
    }

    /// Get a configuration value as a boolean.
    /// Accepts: "true", "false", "1", "0", "yes", "no", "on", "off" (case-insensitive).
    /// Returns false if the key is not found.
    pub fn get_bool(&self, key: &str) -> bool {
        let val = self.get(key);
        matches!(val.to_lowercase().as_str(), "true" | "1" | "yes" | "on")
    }

    /// Check if a configuration key exists.
    pub fn has(&self, key: &str) -> bool {
        let camel = to_camel_case(key);
        self.values.contains_key(&camel) || self.values.contains_key(key)
    }
}

/// Option definition for the functional configuration API.
#[derive(Debug, Clone)]
struct OptionDef {
    name: String,
    description: String,
    default: String,
    is_flag: bool,
    short: Option<char>,
}

/// Builder for functional-style configuration.
///
/// Provides a chainable API for defining configuration options, similar to
/// the JavaScript `makeConfig` API.
///
/// # Example
///
/// ```rust,ignore
/// use lino_arguments::make_config;
///
/// let config = make_config(|c| {
///     c.lenv(".lenv")
///      .option("port", "Server port", "3000")
///      .option_short("api-key", 'k', "API key", "")
///      .flag("verbose", "Enable verbose logging")
/// });
/// ```
pub struct ConfigBuilder {
    options: Vec<OptionDef>,
    lenv_path: Option<String>,
    lenv_override: bool,
    app_name: Option<String>,
    app_about: Option<String>,
    app_version: Option<String>,
}

impl ConfigBuilder {
    fn new() -> Self {
        ConfigBuilder {
            options: Vec::new(),
            lenv_path: None,
            lenv_override: false,
            app_name: None,
            app_about: None,
            app_version: None,
        }
    }

    /// Set the application name for help text.
    pub fn name(&mut self, name: &str) -> &mut Self {
        self.app_name = Some(name.to_string());
        self
    }

    /// Set the application description for help text.
    pub fn about(&mut self, about: &str) -> &mut Self {
        self.app_about = Some(about.to_string());
        self
    }

    /// Set the application version for --version flag.
    pub fn version(&mut self, version: &str) -> &mut Self {
        self.app_version = Some(version.to_string());
        self
    }

    /// Load a .lenv configuration file (without overriding existing env vars).
    pub fn lenv(&mut self, path: &str) -> &mut Self {
        self.lenv_path = Some(path.to_string());
        self.lenv_override = false;
        self
    }

    /// Load a .lenv configuration file, overriding existing env vars.
    pub fn lenv_override(&mut self, path: &str) -> &mut Self {
        self.lenv_path = Some(path.to_string());
        self.lenv_override = true;
        self
    }

    /// Define a string/number option with a long name, description, and default value.
    pub fn option(&mut self, name: &str, description: &str, default: &str) -> &mut Self {
        self.options.push(OptionDef {
            name: name.to_string(),
            description: description.to_string(),
            default: default.to_string(),
            is_flag: false,
            short: None,
        });
        self
    }

    /// Define a string/number option with both short and long names.
    pub fn option_short(
        &mut self,
        name: &str,
        short: char,
        description: &str,
        default: &str,
    ) -> &mut Self {
        self.options.push(OptionDef {
            name: name.to_string(),
            description: description.to_string(),
            default: default.to_string(),
            is_flag: false,
            short: Some(short),
        });
        self
    }

    /// Define a boolean flag (defaults to false).
    pub fn flag(&mut self, name: &str, description: &str) -> &mut Self {
        self.options.push(OptionDef {
            name: name.to_string(),
            description: description.to_string(),
            default: String::new(),
            is_flag: true,
            short: None,
        });
        self
    }

    /// Define a boolean flag with a short name.
    pub fn flag_short(&mut self, name: &str, short: char, description: &str) -> &mut Self {
        self.options.push(OptionDef {
            name: name.to_string(),
            description: description.to_string(),
            default: String::new(),
            is_flag: true,
            short: Some(short),
        });
        self
    }

    /// Build the configuration from the defined options.
    ///
    /// This parses CLI arguments using clap and resolves values from:
    /// 1. CLI arguments (highest priority)
    /// 2. Environment variables
    /// 3. .lenv file
    /// 4. Default values (lowest priority)
    fn build(&self) -> Config {
        self.build_from(env::args_os().collect())
    }

    /// Build the configuration from custom arguments (for testing).
    fn build_from(&self, args: Vec<std::ffi::OsString>) -> Config {
        // Step 1: Load .lenv file if configured
        if let Some(ref path) = self.lenv_path {
            if self.lenv_override {
                let _ = load_lenv_file_override(path);
            } else {
                let _ = load_lenv_file(path);
            }
        }

        // Step 2: Build clap command dynamically
        let mut cmd = clap::Command::new(
            self.app_name.clone().unwrap_or_else(|| "app".to_string()),
        );

        if let Some(ref about) = self.app_about {
            cmd = cmd.about(about.clone());
        }

        if let Some(ref version) = self.app_version {
            cmd = cmd.version(version.clone());
        }

        // Add --configuration option for dynamic .lenv loading
        cmd = cmd.arg(
            clap::Arg::new("configuration")
                .long("configuration")
                .short('c')
                .help("Path to configuration .lenv file")
                .value_name("PATH"),
        );

        // Add user-defined options
        for opt in &self.options {
            let kebab_name = to_kebab_case(&opt.name);

            let mut arg = clap::Arg::new(kebab_name.clone()).long(kebab_name.clone());

            // Set help text
            arg = arg.help(opt.description.clone());

            if let Some(short) = opt.short {
                arg = arg.short(short);
            }

            if opt.is_flag {
                arg = arg.action(clap::ArgAction::SetTrue);
            } else {
                // Resolve default: env var (with case-insensitive lookup) > .lenv > default
                let env_default = getenv(&opt.name, &opt.default);
                arg = arg.default_value(env_default);
            }

            cmd = cmd.arg(arg);
        }

        // Step 3: Parse arguments
        let matches = cmd.get_matches_from(args);

        // Step 4: Load --configuration file if provided
        if let Some(config_path) = matches.get_one::<String>("configuration") {
            let _ = load_lenv_file_override(config_path);
        }

        // Step 5: Collect values into Config
        let mut values = HashMap::new();

        for opt in &self.options {
            let kebab_name = to_kebab_case(&opt.name);
            let camel_name = to_camel_case(&opt.name);

            if opt.is_flag {
                let val = matches.get_flag(&kebab_name);
                values.insert(camel_name, val.to_string());
            } else if let Some(val) = matches.get_one::<String>(&kebab_name) {
                values.insert(camel_name, val.clone());
            }
        }

        Config { values }
    }
}

/// Create a unified configuration using a functional builder API.
///
/// This is the Rust equivalent of the JavaScript `makeConfig` function.
/// It combines .lenv file loading, environment variables, and CLI argument
/// parsing into a single configuration step.
///
/// Priority (highest to lowest):
/// 1. CLI arguments
/// 2. Environment variables
/// 3. .lenv file (via `--configuration` flag or builder `.lenv()`)
/// 4. Default values
///
/// # Example
///
/// ```rust,ignore
/// use lino_arguments::make_config;
///
/// let config = make_config(|c| {
///     c.lenv(".lenv")
///      .option("port", "Server port", "3000")
///      .option_short("api-key", 'k', "API key", "")
///      .flag("verbose", "Enable verbose logging")
/// });
///
/// let port: u16 = config.get("port").parse().unwrap();
/// let api_key = config.get("api-key");
/// let verbose = config.get_bool("verbose");
/// ```
pub fn make_config<F>(configure: F) -> Config
where
    F: FnOnce(&mut ConfigBuilder) -> &mut ConfigBuilder,
{
    let mut builder = ConfigBuilder::new();
    configure(&mut builder);
    builder.build()
}

/// Create a unified configuration using a functional builder API with custom arguments.
///
/// Same as `make_config` but accepts custom arguments for testing purposes.
///
/// # Example
///
/// ```rust,ignore
/// use lino_arguments::make_config_from;
///
/// let args = vec!["my-app", "--port", "9090", "--verbose"];
/// let config = make_config_from(args, |c| {
///     c.option("port", "Server port", "3000")
///      .flag("verbose", "Enable verbose logging")
/// });
///
/// assert_eq!(config.get("port"), "9090");
/// assert!(config.get_bool("verbose"));
/// ```
pub fn make_config_from<I, T, F>(args: I, configure: F) -> Config
where
    I: IntoIterator<Item = T>,
    T: Into<std::ffi::OsString>,
    F: FnOnce(&mut ConfigBuilder) -> &mut ConfigBuilder,
{
    let mut builder = ConfigBuilder::new();
    configure(&mut builder);
    builder.build_from(args.into_iter().map(|a| a.into()).collect())
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
