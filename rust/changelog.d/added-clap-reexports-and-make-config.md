### Added
- Re-exported clap derive macros (`Parser`, `Args`, `Subcommand`, `ValueEnum`) for struct-based CLI parsing without a separate clap dependency
- New `make_config()` functional builder API inspired by the JavaScript `makeConfig` function
- New `make_config_from()` for testing with custom arguments
- `Config` type with `.get()`, `.get_int()`, `.get_bool()`, and `.has()` accessors
- `ConfigBuilder` with chainable `.option()`, `.flag()`, `.lenv()`, `.name()`, `.about()`, `.version()` methods
- Examples for both struct-based and functional usage patterns
