# CLAUDE.md — aprscaching-tools

The signed tool registry for aprscaching: `registry.json`, the tools under `tools/<name>/`, their build and the
signing scripts. Tools run sandboxed in the player's browser; the app is https://github.com/apachler/aprscaching.

## Branches and pull requests
- `dev` is the working branch. Every change is a `<type>/<slug>` branch cut from `dev` (named after its
  Conventional Commit type, never after a tool), a PR into `dev`, squash-merged. Never push to `dev` or `main`.
- A release is a PR from `dev` into `main`, merged as a merge commit. `main` holds only fully signed states; a
  ruleset allows changes to it only by pull request.
- Commits and PR titles are Conventional Commits, signed off (`git commit -s`); no tool attribution in commits or
  PR descriptions (the DCO workflow rejects it). Merged branches are deleted.
- Dependency PRs that touch `pnpm-lock.yaml` are merged one at a time, each rebased onto `dev` first.

## Signing
- Private keys never enter the repository, CI or a log. Only the maintainer signs, offline, with `scripts/sign-all.mjs`.
- On `dev` a changed tool is unsigned until the next release: PR CI runs `verify.mjs` without `--strict`. PRs into
  `main` and release tags run `verify.mjs --strict`.
- A release: a `release/vX.Y.Z` branch from `dev` where the maintainer runs `sign-all` and updates CHANGELOG.md,
  a PR into `dev`, the `dev` → `main` PR, then the maintainer tags `vX.Y.Z` on `main`; the tag becomes a GitHub
  Release. An aprscaching release bundles a tag with its `tools/toolkey/bundle-registry.mjs`.

## Tool API
- A manifest declares `"api": "MAJOR.MINOR"`, the tool API it needs. Within a major only additions happen (minor);
  a breaking change is a new major. A tool may use newer optional features through `tool.has()`.
- `registry.json` carries `"format"`; the authority signature covers it.

## Docs and comments
Present tense, what the code is and why, no history. Licence MIT unless a tool declares otherwise in its SPDX line.
