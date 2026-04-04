//! Struct-based configuration example (drop-in clap replacement)
//!
//! This shows how lino-arguments works as a drop-in replacement for clap,
//! with built-in .lenv and .env file support. Just replace `use clap::Parser`
//! with `use lino_arguments::Parser` and add `lino_arguments::init()` —
//! everything else stays the same.
//!
//! Usage:
//!   cargo run --example struct_based -- --port 9090 --verbose
//!   PORT=8080 cargo run --example struct_based
//!
//! With a .lenv file containing "PORT: 8080":
//!   cargo run --example struct_based

use lino_arguments::Parser;

/// A simple web server configuration.
///
/// Uses standard clap attributes — `lino_arguments::init()` loads .lenv
/// and .env files into the process environment before clap parses, so
/// `env = "PORT"` automatically picks up values from .lenv/.env files.
#[derive(Parser, Debug)]
#[command(name = "my-server")]
#[command(about = "A web server with unified configuration")]
#[command(version)]
struct Args {
    /// Server port
    #[arg(short, long, env = "PORT", default_value = "3000")]
    port: u16,

    /// API key for authentication
    #[arg(short = 'k', long, env = "API_KEY")]
    api_key: Option<String>,

    /// Enable verbose logging
    #[arg(short, long, env = "VERBOSE")]
    verbose: bool,

    /// Configuration file path (.lenv format)
    #[arg(short, long)]
    configuration: Option<String>,
}

fn main() {
    // Drop-in: just add init() before parse()
    lino_arguments::init();
    let args = Args::parse();

    // If --configuration was provided, load that .lenv file too
    if let Some(ref config_path) = args.configuration {
        if let Err(e) = lino_arguments::load_lenv_file(config_path) {
            eprintln!("Warning: Failed to load config '{}': {}", config_path, e);
        }
    }

    println!("Configuration:");
    println!("  Port: {}", args.port);
    println!(
        "  API Key: {}",
        if let Some(ref key) = args.api_key {
            key.as_str()
        } else {
            "(not set)"
        }
    );
    println!("  Verbose: {}", args.verbose);
    println!("\nServer would start on port {}", args.port);
}
