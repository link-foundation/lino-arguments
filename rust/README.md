# lino-arguments (Rust)

A unified configuration library combining environment variables and CLI arguments with a clear priority chain. Works like a combination of [clap](https://docs.rs/clap) and [dotenvy](https://docs.rs/dotenvy), but uses `.lenv` files via [lino-env](https://docs.rs/lino-env).

[![License: Unlicense](https://img.shields.io/badge/license-Unlicense-blue.svg)](http://unlicense.org/)

## Overview

`lino-arguments` provides a unified configuration system that automatically loads configuration from multiple sources with a clear priority chain:

1. **CLI arguments** - Highest priority (manually entered options)
2. **Environment variables** - Already set in the process
3. **`.lenv` file** - Links Notation environment file
4. **`.env` file** - Standard dotenv file (for compatibility)
5. **Default values** - Fallback values

## Installation

Add to your `Cargo.toml`:

```toml
[dependencies]
lino-arguments = "0.2"
```

## Struct-Based Usage (drop-in clap replacement)

Replace `use clap::Parser` with `use lino_arguments::Parser`, add `lino_arguments::init()` before `Args::parse()` — everything else stays the same:

```rust
use lino_arguments::Parser;

#[derive(Parser, Debug)]
#[command(name = "my-app")]
struct Args {
    #[arg(long, env = "PORT", default_value = "3000")]
    port: u16,

    #[arg(long, env = "API_KEY")]
    api_key: Option<String>,

    #[arg(long, env = "VERBOSE")]
    verbose: bool,
}

fn main() {
    lino_arguments::init();   // loads .lenv + .env into process env
    let args = Args::parse(); // standard clap API — no changes needed
    println!("Server starting on port {}", args.port);
}
```

With a `.lenv` file:
```
PORT: 8080
API_KEY: my-secret-key
```

Or a `.env` file:
```
PORT=8080
API_KEY=my-secret-key
```

The priority chain ensures CLI arguments always win:
```bash
# Uses default (3000)
cargo run

# Uses .lenv value (8080)
# (if PORT: 8080 is in .lenv)
cargo run

# Uses env var (9090)
PORT=9090 cargo run

# Uses CLI argument (7070)
cargo run -- --port 7070
```

### init() Functions

| Function | Description |
|----------|-------------|
| `init()` | Load `.lenv` + `.env` files into process env |
| `init_with(lenv, env)` | Load specified files into process env |

### LinoParser Trait (alternative one-liner API)

For a single-call approach, use the `LinoParser` trait:

```rust
use lino_arguments::{Parser, LinoParser};

#[derive(Parser, Debug)]
struct Args {
    #[arg(long, env = "PORT", default_value = "3000")]
    port: u16,
}

fn main() {
    let args = Args::lino_parse(); // loads .lenv + .env + parse in one call
}
```

| Method | Description |
|--------|-------------|
| `lino_parse()` | Load `.lenv` + `.env`, then parse CLI args |
| `lino_parse_with(lenv, env)` | Load specified files, then parse |
| `lino_parse_from(args)` | Load `.lenv` + `.env`, parse custom args (for testing) |
| `lino_parse_from_with(args, lenv, env)` | Load specified files, parse custom args |

## Functional Usage (like JavaScript's makeConfig)

For quick scripts or when you prefer not to define structs, use the functional builder API:

```rust
use lino_arguments::make_config_from;

fn main() {
    let config = make_config_from(std::env::args_os(), |c| {
        c.name("my-server")
         .lenv(".lenv")
         .env(".env")
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

- `Parser` - Derive macro and trait for struct-based CLI parsing
- `Args` - Derive macro for argument groups
- `Subcommand` - Derive macro for subcommands
- `ValueEnum` - Derive macro for enum value arguments
- `arg!` - Macro for inline argument definitions
- `command!` - Macro for command metadata

### Initialization Functions

| Function | Description |
|----------|-------------|
| `init()` | Load `.lenv` + `.env` files from current directory |
| `init_with(lenv_path, env_path)` | Load specified `.lenv` and `.env` files |

### File Loading Functions

| Function | Description |
|----------|-------------|
| `load_lenv_file(path)` | Load `.lenv` file (won't overwrite existing env vars) |
| `load_lenv_file_override(path)` | Load `.lenv` file (overwrites existing env vars) |
| `load_env_file(path)` | Load `.env` file (won't overwrite existing env vars) |
| `load_env_file_override(path)` | Load `.env` file (overwrites existing env vars) |

### Functional Configuration

#### `make_config(configure)`

Create configuration from CLI arguments and environment:

```rust
use lino_arguments::make_config;

let config = make_config(|c| {
    c.lenv(".lenv")
     .env(".env")
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
| `.env(path)` | Load .env file (without overriding existing env vars) |
| `.env_override(path)` | Load .env file (overriding existing env vars) |
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
