//! lino-arguments CLI binary
//!
//! This is a simple CLI example showing how to use lino-arguments
//! as a drop-in replacement for clap with .lenv/.env file support.

use lino_arguments::{load_lenv_file, LinoParser, Parser};

/// A unified configuration example.
///
/// Uses standard clap `#[arg(env = "...")]` attributes.
/// `LinoParser::lino_parse()` loads .lenv and .env files into the process
/// environment before clap parses, so `env` attributes automatically pick
/// up values from .lenv/.env files.
#[derive(Parser, Debug)]
#[command(name = "lino-arguments")]
#[command(about = "A unified configuration library example")]
#[command(version)]
struct Args {
    /// Server port
    #[arg(short, long, env = "PORT", default_value = "3000")]
    port: u16,

    /// API key
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
    // lino_parse() = load .lenv + .env, then parse CLI args
    let args = Args::lino_parse();

    // Load additional config file if specified via --configuration
    if let Some(ref config_path) = args.configuration {
        if let Err(e) = load_lenv_file(config_path) {
            eprintln!(
                "Warning: Failed to load config file '{}': {}",
                config_path, e
            );
        }
    }

    if args.verbose {
        println!("Configuration loaded:");
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
        if let Some(ref cfg) = args.configuration {
            println!("  Config file: {}", cfg);
        }
    }

    println!("Server would start on port {}", args.port);
}
