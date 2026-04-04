//! Functional configuration example (like the JavaScript makeConfig API)
//!
//! This shows the builder-style API that mirrors JavaScript's makeConfig
//! function, useful for quick scripts or when you prefer not to define structs.
//!
//! Usage:
//!   cargo run --example functional -- --port 9090 --verbose
//!   PORT=8080 cargo run --example functional

use lino_arguments::make_config_from;

fn main() {
    let config = make_config_from(std::env::args_os(), |c| {
        c.name("my-server")
            .about("A web server with unified configuration")
            .version("1.0.0")
            .lenv(".lenv")
            .env(".env")
            .option_short("port", 'p', "Server port", "3000")
            .option_short("api-key", 'k', "API key for authentication", "")
            .flag_short("verbose", 'v', "Enable verbose logging")
    });

    let port = config.get_int("port", 3000);
    let api_key = config.get("apiKey");
    let verbose = config.get_bool("verbose");

    if verbose {
        println!("Configuration:");
        println!("  Port: {}", port);
        println!(
            "  API Key: {}",
            if api_key.is_empty() {
                "(not set)"
            } else {
                &api_key
            }
        );
        println!("  Verbose: {}", verbose);
    }

    println!("Server would start on port {}", port);
}
