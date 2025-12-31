//! lino-arguments CLI binary
//!
//! This is a simple CLI example showing how to use lino-arguments.

use clap::Parser;
use lino_arguments::{getenv, getenv_bool, getenv_int};

/// A unified configuration example
#[derive(Parser, Debug)]
#[command(name = "lino-arguments")]
#[command(about = "A unified configuration library example")]
#[command(version)]
struct Args {
    /// Server port
    #[arg(short, long, env = "PORT")]
    port: Option<u16>,

    /// API key
    #[arg(short = 'k', long, env = "API_KEY")]
    api_key: Option<String>,

    /// Enable verbose logging
    #[arg(short, long, env = "VERBOSE")]
    verbose: bool,

    /// Configuration file path
    #[arg(short, long)]
    configuration: Option<String>,
}

/// Resolved configuration with defaults applied
struct Config {
    port: u16,
    api_key: String,
    verbose: bool,
    configuration: Option<String>,
}

impl From<Args> for Config {
    fn from(args: Args) -> Self {
        Config {
            port: args.port.unwrap_or_else(|| getenv_int("PORT", 3000) as u16),
            api_key: args.api_key.unwrap_or_else(|| getenv("API_KEY", "")),
            verbose: args.verbose || getenv_bool("VERBOSE", false),
            configuration: args.configuration,
        }
    }
}

fn main() {
    let args = Args::parse();
    let config = Config::from(args);

    if config.verbose {
        println!("Configuration loaded:");
        println!("  Port: {}", config.port);
        println!(
            "  API Key: {}",
            if config.api_key.is_empty() {
                "(not set)"
            } else {
                &config.api_key
            }
        );
        println!("  Verbose: {}", config.verbose);
        if let Some(cfg) = &config.configuration {
            println!("  Config file: {}", cfg);
        }
    }

    println!("Server would start on port {}", config.port);
}
