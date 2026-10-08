# Issue #42 implementation plan

- [x] Verify prepared branch and clean working tree; read parent issue, all child issues and comments, and all PR comment types.
- [x] Read repository implementation, tests, examples, documentation, release scripts/workflows and related merged PRs.
- [x] Research current upstream versions, LinoEnv pure API, yargs option/environment APIs, secret-file patterns, and release tooling; compare reusable components.
- [x] Enumerate every requirement of #39/#40/#41 and map each to implementation, possible approaches, chosen plan, and validation.
- [x] Preserve failed CI logs; verify timestamps and commit SHA; record exact release failure with log line numbers.
- [x] Add minimal failing regressions for isolated contexts, precedence, typed/falsy/case handling, alias ambiguity, opt-in secret files, automatic/explicit env mapping, and JS-only release invocation from js/.
- [x] Implement pure injected env/cwd resolution reusing LinoEnv; retain legacy process helpers and document browser/Rust/Python boundaries.
- [x] Implement bounded injected secret reading with explicit schema/conflict/newline policy and redacted errors; apply shared behavior across all option sources.
- [x] Implement opt-in typed option-to-env mapping using existing yargs APIs, including renamed variables and precedence.
- [x] Verify dependency updates across npm/Deno lockfiles and docs; repair release-root handling across scripts/workflows; retain release trigger.
- [x] Update docs and runnable examples; run Node/Bun/Deno and Rust checks plus release regressions; save substantial logs.
- [x] Commit useful atomic changes after local checks, preserving history; remove preparation .gitkeep; synchronize main; push only issue-42-30b1828f3bdd.
- [x] Review entire PR diff for requirement coverage and regressions; update PR title/body with analysis, reproduction, tests, capability boundaries, and separate Fixes #39/#40/#41/#42.
- [x] Inspect fresh PR CI timestamps/SHA; preserve and analyze failures; add regressions and corrections for Windows host lookup and final yargs compatibility findings.

Finalization protocol: compare the latest PR checks to the pushed SHA, wait for
all checks to pass, record their links in PR #43, mark that PR ready, and verify
the branch and clean working tree. The live PR records this final verification;
the committed analysis preserves earlier runs and reproducible failure evidence.

Experiments are finite and saved under experiments/; illustrative use cases go under js/examples/. No private fixtures are needed. Registry publication is performed by the existing release workflow after merge; implementation and release preparation stay on the PR branch.
