# Case Study: Issue #48 - crates.io Trusted Publishing with Token Fallback

## Summary

`lino-arguments` was published to crates.io only with the long-lived
`CARGO_TOKEN` secret. `package-registry-manager setup --registry crates-io --migrate`
(0.23.0) could not convert the workflow because publishing goes through
`node scripts/publish-crate.mjs`, which builds `cargo publish` as a string
(tool gap: link-foundation/package-registry-manager#60).

The issue's policy update (2026-10-13) changed the target. Both release jobs
must try **trusted publishing (OIDC) first** and fall back to the
`CARGO_REGISTRY_TOKEN` / `CARGO_TOKEN` secrets. The secrets must stay in place.

## Evidence (before)

- crates.io API: every version (0.2.0 to 0.5.0) has `published_by: konard` and
  `trustpub_data: null`, so all of them were published with a token.
- Run [37854450254](https://github.com/link-foundation/lino-arguments/actions/runs/37854450254)
  released 0.5.0. See `release-run-37854450254-excerpt.txt`:
  - The workflow-level `env: CARGO_TOKEN: ${{ secrets.CARGO_REGISTRY_TOKEN || secrets.CARGO_TOKEN }}`
    was injected into **every step of every job**. That is 138 steps, including
    tests on three OSes, `cargo install cargo-outdated` and third-party actions.
  - The publish step's own `CARGO_TOKEN: ${{ secrets.CARGO_TOKEN }}` overrode
    that value. So the `CARGO_REGISTRY_TOKEN` secret never reached the publish
    step, despite the comment saying both were supported.
- `scripts/publish-crate.mjs` passed the token as `cargo publish --token <value>`
  inside a shell string. On a failed publish, Node's `Command failed: cd rust && cargo publish --allow-dirty --token <value>`
  message was printed. This was reproduced locally with a stand-in `cargo`.
  GitHub masks registered secrets in logs, but the token was still visible in
  the process arguments.

## Changes

`.github/workflows/rust.yml`, `auto-release` and `manual-release`:

1. `permissions: id-token: write`.
2. Added `rust-lang/crates-io-auth-action@c6f97d42243bad5fab37ca0427f495c86d5b1a18 # v1.0.5`
   (the SHA matches tag `v1.0.5`; its output is `token`). It uses `id: crates_auth`,
   the same `if:` as the publish step, and `continue-on-error: true`.
3. The publish step gets
   `CARGO_REGISTRY_TOKEN: ${{ steps.crates_auth.outputs.token || secrets.CARGO_REGISTRY_TOKEN || secrets.CARGO_TOKEN }}`
   and `CRATES_AUTH_OUTCOME: ${{ steps.crates_auth.outcome }}`.
4. Removed the workflow-level `CARGO_TOKEN` env. Both secrets are still read,
   but only by the two publish steps.
5. A new `publish-script` job runs `experiments/test-crates-publish.mjs`. The
   `build` job (and so both release jobs) depends on it.

`scripts/publish-crate.mjs`:

- Runs `cargo publish --allow-dirty` with `execFileSync` (no shell) in the Rust
  root. The token reaches cargo only through the `CARGO_REGISTRY_TOKEN`
  environment variable. An empty value is removed so it cannot shadow cargo's
  own credentials.
- Logs which credential is used. When the auth step did not succeed, it emits
  a `::warning::` that says what to configure on crates.io.

## Verification

`node --test experiments/test-crates-publish.mjs` gives 11 passing tests. The
tests run the real script with stand-in `cargo`/`curl` and check the structure
of both release jobs. Against the original script and workflow, 10 of them fail.
`actionlint` reports nothing for `rust.yml`.

## Remaining maintainer action

A crate owner has to register the trusted publisher on crates.io (crate
Settings > Trusted Publishing: repository `link-foundation/lino-arguments`,
workflow `rust.yml`, no environment). The alternative is to run
`package-registry-manager setup --repository . --registry crates-io --migrate --execute`
after merge. This needs crates.io owner credentials, so it cannot be done from
this pull request. Until then, releases keep publishing with the token secret
and print the warning above. Per the policy update, the token secrets must
**not** be deleted after the first OIDC release.
