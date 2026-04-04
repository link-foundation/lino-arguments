// Experiment: Can we have our own Parser trait AND re-export clap's Parser derive macro?
//
// In Rust, `pub use clap::Parser` re-exports BOTH the derive macro and the trait
// under the same name. Defining `pub trait Parser` causes E0255 (name conflict).
//
// Approaches considered:
// 1. Shadow via submodule re-export — still conflicts (same type namespace)
// 2. Custom derive proc-macro — too complex for this use case
// 3. ctor crate for auto-initialization — CHOSEN SOLUTION
//
// Solution: Use `ctor` to run init() automatically before main().
// This loads .lenv/.env at program startup, so `Args::parse()` (clap's)
// sees the environment variables without any extra code.
// User just changes `use clap::Parser` to `use lino_arguments::Parser`.
