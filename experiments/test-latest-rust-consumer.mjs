#!/usr/bin/env node

// Reproduce issue #37 using a fresh consumer with current ctor/thiserror.
// Run from any directory: node experiments/test-latest-rust-consumer.mjs
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const rustRoot = fileURLToPath(new URL('../rust/', import.meta.url));
const directory = mkdtempSync(join(tmpdir(), 'lino-latest-consumer-'));
const cargo = (args) =>
  execFileSync('cargo', args, { cwd: directory, encoding: 'utf8' });

try {
  mkdirSync(join(directory, 'src'));
  writeFileSync(
    join(directory, 'Cargo.toml'),
    `[package]
name = "lino-latest-consumer"
version = "0.0.0"
edition = "2021"

[dependencies]
lino-arguments = { path = ${JSON.stringify(rustRoot)} }
clap = { version = "4.6.7", features = ["derive", "env"] }
ctor = "1.0.13"
thiserror = "2.0.21"
`
  );
  writeFileSync(
    join(directory, 'src/main.rs'),
    `use lino_arguments::{ConfigError, Parser};
use std::error::Error;

#[derive(Parser)]
struct Args {
    #[arg(long, env = "LINO_ISSUE_37_PORT")]
    port: u16,
    #[arg(long, env = "LINO_ISSUE_37_HOST")]
    host: String,
}

fn main() {
    // No explicit init(): exercise the library's constructor before main.
    let args = Args::parse();
    assert_eq!(args.port, 8080);
    assert_eq!(args.host, "from-env");
    let error: ConfigError = std::io::Error::other("consumer error").into();
    assert_eq!(error.to_string(), "IO error: consumer error");
    assert_eq!(error.source().unwrap().to_string(), "consumer error");
}
`
  );
  writeFileSync(join(directory, '.lenv'), 'LINO_ISSUE_37_PORT: 8080\n');
  writeFileSync(
    join(directory, '.env'),
    'LINO_ISSUE_37_PORT=3000\nLINO_ISSUE_37_HOST=from-env\n'
  );

  const metadata = JSON.parse(cargo(['metadata', '--format-version=1']));
  for (const name of ['ctor', 'thiserror']) {
    const versions = metadata.packages
      .filter((dependency) => dependency.name === name)
      .map((dependency) => dependency.version);
    console.log(`${name}: ${versions.join(', ')}`);
    assert.equal(versions.length, 1, `Duplicate ${name} versions: ${versions}`);
  }

  console.log(cargo(['tree', '-d']));
  cargo(['run', '--quiet', '--locked']);
  console.log(
    'Consumer has no ctor/thiserror duplicates; startup and errors work.'
  );
} finally {
  rmSync(directory, { recursive: true, force: true });
}
