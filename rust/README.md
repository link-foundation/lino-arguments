# lino-arguments (Rust)

A unified configuration library combining environment variables and CLI arguments with a clear priority chain.

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
lino-arguments = "0.1"
```

## Quick Start

```rust
use clap::Parser;
use lino_arguments::{getenv, getenv_int, getenv_bool};

#[derive(Parser)]
struct Args {
    #[arg(short, long, default_value_t = getenv_int("PORT", 3000) as u16)]
    port: u16,

    #[arg(short, long, default_value = getenv("API_KEY", ""))]
    api_key: String,

    #[arg(short, long, default_value_t = getenv_bool("VERBOSE", false))]
    verbose: bool,
}

fn main() {
    let args = Args::parse();
    println!("Server starting on port {}", args.port);
}
```

## API Reference

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

## Testing

```bash
# Run all tests
cargo test

# Run tests with output
cargo test -- --nocapture

# Run specific test
cargo test case_conversion
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
