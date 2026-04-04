//! Struct-based configuration example (like clap + dotenvy)
//!
//! This shows how lino-arguments works as a drop-in replacement for clap,
//! with built-in .lenv file support instead of .env files.
//!
//! Usage:
//!   cargo run --example struct_based -- --port 9090 --verbose
//!   PORT=8080 cargo run --example struct_based

use lino_arguments::{getenv, getenv_bool, getenv_int, load_lenv_file, Parser};

/// A simple web server configuration
#[derive(Parser, Debug)]
#[command(name = "my-server")]
#[command(about = "A web server with unified configuration")]
#[command(version)]
struct Args {
    /// Server port
    #[arg(short, long, default_value_t = getenv_int("PORT", 3000) as u16)]
    port: u16,

    /// API key for authentication
    #[arg(short = 'k', long, default_value = getenv("API_KEY", ""))]
    api_key: String,

    /// Enable verbose logging
    #[arg(short, long, default_value_t = getenv_bool("VERBOSE", false))]
    verbose: bool,

    /// Configuration file path (.lenv format)
    #[arg(short, long)]
    configuration: Option<String>,
}

fn main() {
    // Load .lenv file first (like dotenvy loads .env, but for .lenv format)
    load_lenv_file(".lenv").ok();

    // Parse CLI arguments — clap's derive macro works through lino-arguments
    let args = Args::parse();

    // Load additional config file if specified via --configuration
    if let Some(ref config_path) = args.configuration {
        if let Err(e) = load_lenv_file(config_path) {
            eprintln!("Warning: Failed to load config '{}': {}", config_path, e);
        }
    }

    println!("Configuration:");
    println!("  Port: {}", args.port);
    println!(
        "  API Key: {}",
        if args.api_key.is_empty() {
            "(not set)"
        } else {
            &args.api_key
        }
    );
    println!("  Verbose: {}", args.verbose);
    println!("\nServer would start on port {}", args.port);
}
