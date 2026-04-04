# lino-arguments (Rust)

A unified configuration library combining environment variables and CLI arguments with a clear priority chain. Works like a combination of [clap](https://docs.rs/clap) and [dotenvy](https://docs.rs/dotenvy), but uses `.lenv` files via [lino-env](https://docs.rs/lino-env).

[![License: Unlicense](https://img.shields.io/badge/license-Unlicense-blue.svg)](http://unlicense.org/)

## Overview

`lino-arguments` provides a unified configuration system that automatically loads configuration from multiple sources with a clear priority chain:

1. **CLI arguments** - Highest priority (manually entered options)
2. **Environment variables** - With case-insensitive lookup
3. **Configuration file** - Dynamic config file path via CLI
4. **Default values** - Fallback values

## Installation

Add to your `Cargo.toml`:

```toml
[dependencies]
lino-arguments = "0.2"
```

## Struct-Based Usage (like clap)

The `Parser` derive macro is re-exported from clap, so you can use `lino-arguments` as a drop-in replacement without depending on clap directly:

```rust
use lino_arguments::{Parser, getenv, getenv_int, getenv_bool, load_lenv_file};

// Load .lenv file (like dotenvy loads .env, but for .lenv format)
load_lenv_file(".lenv").ok();

#[derive(Parser, Debug)]
#[command(name = "my-app")]
struct Args {
    #[arg(short, long, default_value_t = getenv_int("PORT", 3000) as u16)]
    port: u16,

    #[arg(short = 'k', long, default_value = getenv("API_KEY", ""))]
    api_key: String,

    #[arg(short, long, default_value_t = getenv_bool("VERBOSE", false))]
    verbose: bool,
}

fn main() {
    let args = Args::parse();
    println!("Server starting on port {}", args.port);
}
```

## Functional Usage (like JavaScript's makeConfig)

For quick scripts or when you prefer not to define structs, use the functional builder API:

```rust
use lino_arguments::make_config_from;

fn main() {
    let config = make_config_from(std::env::args_os(), |c| {
        c.name("my-server")
         .lenv(".lenv")
         .option_short("port", 'p', "Server port", "3000")
         .option_short("api-key", 'k', "API key", "")
         .flag_short("verbose", 'v', "Enable verbose logging")
    });

    let port = config.get_int("port", 3000);
    let api_key = config.get("api-key");
    let verbose = config.get_bool("verbose");

    println!("Server starting on port {}", port);
}
```

## API Reference

### Re-exported Clap Types

- `Parser` - Derive macro for struct-based CLI parsing
- `Args` - Derive macro for argument groups
- `Subcommand` - Derive macro for subcommands
- `ValueEnum` - Derive macro for enum value arguments
- `arg!` - Macro for inline argument definitions
- `command!` - Macro for command metadata

### Functional Configuration

#### `make_config(configure)`

Create configuration from CLI arguments and environment:

```rust
use lino_arguments::make_config;

let config = make_config(|c| {
    c.lenv(".lenv")
     .option("port", "Server port", "3000")
     .flag("verbose", "Enable verbose logging")
});
```

#### `make_config_from(args, configure)`

Same as `make_config` but accepts custom arguments (useful for testing):

```rust
use lino_arguments::make_config_from;

let config = make_config_from(["app", "--port", "9090"], |c| {
    c.option("port", "Server port", "3000")
});
assert_eq!(config.get("port"), "9090");
```

#### ConfigBuilder Methods

| Method | Description |
|--------|-------------|
| `.name(name)` | Set application name |
| `.about(description)` | Set application description |
| `.version(version)` | Set application version |
| `.lenv(path)` | Load .lenv file (without overriding existing env vars) |
| `.lenv_override(path)` | Load .lenv file (overriding existing env vars) |
| `.option(name, desc, default)` | Define a string option |
| `.option_short(name, short, desc, default)` | Define a string option with short flag |
| `.flag(name, desc)` | Define a boolean flag |
| `.flag_short(name, short, desc)` | Define a boolean flag with short flag |

#### Config Methods

| Method | Description |
|--------|-------------|
| `.get(key)` | Get value as string |
| `.get_int(key, default)` | Get value as integer |
| `.get_bool(key)` | Get value as boolean |
| `.has(key)` | Check if key exists |

### Environment Variable Helpers

#### `getenv(key, default)`

Get environment variable as string with case-insensitive lookup.

```rust
let api_key = getenv("apiKey", "default-key");  // Tries API_KEY, apiKey, etc.
```

#### `getenv_int(key, default)`

Get environment variable as integer.

```rust
let port = getenv_int("PORT", 3000);
```

#### `getenv_bool(key, default)`

Get environment variable as boolean. Accepts: "true", "false", "1", "0", "yes", "no".

```rust
let debug = getenv_bool("DEBUG", false);
```

### Case Conversion Utilities

- `to_upper_case(s)` - Convert to UPPER_CASE
- `to_camel_case(s)` - Convert to camelCase
- `to_kebab_case(s)` - Convert to kebab-case
- `to_snake_case(s)` - Convert to snake_case
- `to_pascal_case(s)` - Convert to PascalCase

```rust
use lino_arguments::{to_upper_case, to_camel_case, to_kebab_case};

assert_eq!(to_upper_case("apiKey"), "API_KEY");
assert_eq!(to_camel_case("api-key"), "apiKey");
assert_eq!(to_kebab_case("apiKey"), "api-key");
```

## Examples

```bash
# Run struct-based example
cargo run --example struct_based -- --port 9090 --verbose

# Run functional example
cargo run --example functional -- --port 9090 --verbose

# Use environment variables
PORT=8080 cargo run --example struct_based
```

## Testing

```bash
# Run all tests
cargo test

# Run tests with output
cargo test -- --nocapture

# Run specific test
cargo test make_config
```

## Development

```bash
# Build
cargo build

# Build release
cargo build --release

# Run clippy
cargo clippy

# Format code
cargo fmt
```

## License

This is free and unencumbered software released into the public domain. See the [LICENSE](../LICENSE) file for details.
