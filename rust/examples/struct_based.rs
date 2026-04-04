//! Struct-based configuration example (drop-in clap replacement)
//!
//! This shows how lino-arguments works as a true drop-in replacement for clap,
//! with built-in .lenv and .env file support. Just replace `use clap::Parser`
//! with `use lino_arguments::Parser` — everything else stays the same.
//!
//! Usage:
//!   cargo run --example struct_based -- --port 9090 --verbose
//!   PORT=8080 cargo run --example struct_based
//!
//! With a .lenv file containing "PORT: 8080":
//!   cargo run --example struct_based

// Only change from clap: import from lino_arguments instead of clap
use lino_arguments::Parser;

/// A simple web server configuration.
///
/// Uses standard clap attributes — lino-arguments automatically loads .lenv
/// and .env files into the process environment at startup, so `env = "PORT"`
/// picks up values from .lenv/.env files without any extra code.
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
    // No init() needed — .lenv and .env are loaded automatically
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
