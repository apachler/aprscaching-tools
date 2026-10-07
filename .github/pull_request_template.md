<!--
Title: a Conventional Commit, e.g. "feat(grid-bearing): bearing in mils". PRs go into dev and are squash-merged.
-->

## What and why

## How it was verified

- [ ] `node scripts/build.mjs --check` (the built tool.js matches its source)
- [ ] The tests pass, and new behaviour or a fixed bug has its test
- [ ] `node scripts/verify.mjs` lists no failures beyond the signatures this change makes stale

## Housekeeping

- [ ] Commits are Conventional Commits and signed off (`git commit -s`)
- [ ] A line under `## [Unreleased]` in CHANGELOG.md says what this changes (not needed for CI or dependencies only)
- [ ] A changed tool has its version raised
- [ ] Permissions are the fewest the tool needs; any `tx`, `beacon` or `network` has its reason in the README
