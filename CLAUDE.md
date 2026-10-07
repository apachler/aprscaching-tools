# CLAUDE.md — aprscaching-tools

The signed tool registry for APRScaching: `registry.json`, the tools under `tools/<name>/`, their build and the
signing scripts. Tools run sandboxed in the player's browser; the app is https://github.com/apachler/aprscaching.

## Branches and pull requests
- `dev` is the working branch. Every change is a `<type>/<slug>` branch cut from `dev` (named after its
  Conventional Commit type, never after a tool), a PR into `dev`, squash-merged. Never push to `main`; push to
  `dev` only to fast-forward it to `main` after a release (the `sync-dev` step).
- A release is a `release/vX.Y.Z` branch from `dev`, a PR into `main` merged as a merge commit, the tag, then `dev`
  fast-forwarded to `main` (a PR from `main` into `dev`, merged as a merge commit, when `dev` has moved on). A hotfix
  starts from the tag it fixes. `main` holds only fully signed states and is the default branch; its ruleset allows
  changes only by pull request, merged as a merge commit, with the `check` and `verify` checks passing, and `verify`
  fails a PR into `main` that does not come from `release/vX.Y.Z`. The `dev` ruleset asks the same pull request and
  checks, squash or merge commit; repository admins bypass it for the `sync-dev` fast-forward push. Actions must be
  pinned to a full commit SHA. Dependabot targets `dev`.
- Commits and PR titles are Conventional Commits, signed off (`git commit -s`); no tool attribution in commits or
  PR descriptions (the DCO workflow rejects it). Merged branches are deleted.
- A PR that changes what a player, tool author or maintainer gets adds its line under `## [Unreleased]` in
  CHANGELOG.md, written the way the released sections are. A changed tool raises its version and gets its own line.
  A PR that only touches CI, dependencies or the release itself adds none. A release then only dates that section.
- Dependency PRs that touch `pnpm-lock.yaml` are merged one at a time, each rebased onto `dev` first.

## Signing
- Private keys never enter the repository, CI or a log. Only the maintainer signs, offline, with `scripts/sign-all.mjs`.
- The key files live in the key folder, outside every repository: `TOOL_KEYS_DIR`, by default
  `$XDG_CONFIG_HOME/aprscaching-tools/keys` (`~/.config/aprscaching-tools/keys`); the doctor and the release `check`
  fail a key folder inside a git working tree.
- On `dev` a changed tool is unsigned until the next release: PR CI runs `verify.mjs` without `--strict`. PRs into
  `main` and release tags run `verify.mjs --strict`.
- A release: on the `release/vX.Y.Z` branch the maintainer runs `sign-all` and dates CHANGELOG.md; after the PR
  into `main`, the maintainer tags `vX.Y.Z` on `main` and the tag becomes a GitHub Release. An APRScaching release
  bundles a tag with its `tools/toolkey/bundle-registry.mjs`.
- `scripts/release.mjs [X.Y.Z]` runs that flow step by step and resumes where it stopped; without a version, the
  Conventional Commits since the newest tag choose it (breaking → major, `feat` → minor, else patch). `/release`
  (`.claude/skills/release/`) drives it: asking for the release is the go-ahead for the whole run, signing and the
  merge into `main` included, and it stops for the user only on a failure, a CHANGELOG line it had to write, or
  something unexpected. An agent never reads, prints or passes the key files (the `sign` step reads them itself), and
  merges into `main` only after the PR's checks have passed.
- `scripts/doctor.mjs` checks the computer (Node, pnpm, gh, remote, vendor/, lockfile, key files by public key only).

## Tools and checks
- `scripts/new-tool.mjs <name>` scaffolds a tool that builds and passes every check; `/new-tool` guides the rest.
- On `dev` a tool folder without a registry entry is a test warning (the maintainer lists it at review); `STRICT=1`,
  set on `main`, PRs into it and release tags, makes it a failure.

## Tool API
- A manifest declares `"api": "MAJOR.MINOR"`, the tool API it needs. Within a major only additions happen (minor);
  a breaking change is a new major. A tool may use newer optional features through `tool.has()`.
- `registry.json` carries `"format"`; the authority signature covers it.

## Code style
`pnpm lint` (ESLint and Prettier, 120 columns) runs in CI; `pnpm format` lays the code out. Prettier leaves Markdown,
`tool.js`, `tool.json`, `registry.json` and the lockfile alone. Formatting a tool's source can change its built
`tool.js`: rebuild it, and raise its version as for any change.

## Docs and comments
Present tense, what the code is and why, no history. Licence MIT unless a tool declares otherwise in its SPDX line.
The documentation site is `docs/` (MkDocs, `mkdocs.yml`, published from `main`); it follows the APRScaching manual's
style guide, and `mkdocs build --strict` plus Vale gate it. A new tool needs its page `docs/catalogue/<folder>.md`.

The wordmark is **APRScaching**, never `aprscaching`, `Aprscaching` or `APRS caching`. That covers prose
everywhere: docs, READMEs, CHANGELOG, comments, log and error text, commit messages, PR titles and bodies, and the
GitHub description. The lowercase name stays only where it is an identifier: a repository (`apachler/aprscaching`,
`aprscaching-tools`), a path (`vendor/aprscaching/`), a URL or domain, a package (`@aprscaching/…`), or code. Vale
(`APRScaching.Terms`) checks `docs/`, and `test/wordmark.test.mjs` checks every Markdown file. The build banner in each
`tool.js` keeps its lowercase text, because the signatures cover it.
