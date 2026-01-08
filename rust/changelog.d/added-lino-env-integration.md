### Added
- Integration with `lino-env` crate (v0.1.0) for reading `.lenv` configuration files
- New `load_lenv_file()` function to load environment variables from `.lenv` files
- New `load_lenv_file_override()` function to load and overwrite existing environment variables
- Re-exported `LinoEnv`, `read_lino_env`, and `write_lino_env` from `lino-env` crate
- CLI now supports `--configuration` flag to load configuration from `.lenv` files
