# Changelog

Each release of the registry is a tag `vX.Y.Z` on `main`; an APRScaching release bundles one. Tool API and registry
format versions are named where they change.

## [Unreleased]

- **Changelog per pull request.** Each pull request adds its line under Unreleased, and a release dates that section.
  The pull request template, the contributor guide and `/new-tool` ask for it.
- **Release into main.** The release branch goes straight into `main` by pull request, and the new `sync-dev` step
  then fast-forwards `dev` to `main`, or merges `main` into `dev` by pull request when `dev` has moved on. A release
  takes one pull request instead of two. `release.mjs --from <tag>` starts a hotfix from the tag it fixes.
- **One go-ahead.** `/release` runs the PR into `main`, the tag and `sync-dev` on one approval when nothing needs
  signing and every check passes, and stops to ask the moment one does not.

## [1.2.1] - 2026-10-06

- **Wordmark.** The documentation site, the READMEs and the tool pages write the name as APRScaching. Vale checks
  `docs/` for the other spellings, and `test/wordmark.test.mjs` checks every Markdown file in the repository.

## [1.2.0] - 2026-10-06

A documentation site for players, tool authors and registry hosts, and scripts that guide a release and a new tool.

- **Documentation site.** An MkDocs site built from `docs/`: a catalogue page per tool (its commands, permissions,
  what it transmits, and facts generated from its manifest and registry entry), how to write, test and sign a
  tool, the tool API versions, and how to publish a registry. `mkdocs build --strict` checks each catalogue page
  against its tool's manifest. The site deploys to GitHub Pages from `main`.
- **Release script.** `scripts/release.mjs <X.Y.Z>` releases a tag step by step (check, prepare, sign, changelog, the
  PR into `dev`, the PR into `main`, the tag, the handover to APRScaching), asks before every change to git or
  GitHub, and resumes from the first step not done. It reads the key files only to sign, and prints public keys only.
- **Doctor.** `scripts/doctor.mjs` checks Node, pnpm, `gh`, the remote, `vendor/`, the lockfile and the key files.
- **Key folder.** The signing keys live in `TOOL_KEYS_DIR`, by default `~/.config/aprscaching-tools/keys`, outside
  every repository. The doctor, the release check and the sign step refuse a key folder inside a git working tree
  and warn when it is not mode 700.
- **New tool.** `scripts/new-tool.mjs <name>` writes a working tool, its test and its catalogue page.
- **Repository checks.** On `dev` a tool folder without a registry entry is a warning; `STRICT=1`, which `main`, pull
  requests into it and release tags set, makes it a failure.
- **Claude Code skills.** `/release` and `/new-tool` (`.claude/skills/`).

## [1.1.0] - 2026-10-06

The app's first-party tools move here: APRScaching ships no tools of its own, and players install them from this
registry.

- **New tools**, built from `tools/<name>/src` with the APRScaching MIT libraries at the `lib.lock` commit: Packet
  decoder (decoder and field panel), PSK31 + CW decoders, 7PLUS reassembler, MHeard, Watch & alert, Monitor
  colouriser, Station DB, CTEXT macro pack, Grid & bearing, Unit converter, CW encoder, Map waypoints, Block art,
  APRS SSID guide, Auto-responder, Away note, Connect bell, Info / menu responder, Link ping, Scheduled query,
  Auto-status and Beacon scheduler.
- **Tool API 1.0.** Every manifest names `"api": "1.0"`, the tool API version it needs.
- **Registry format 1.** `registry.json` names `"format": 1`, which the authority signs with the entries.
- **Build.** `scripts/fetch-libs.mjs` and `scripts/build.mjs` make each `tool.js` reproducibly; CI checks the
  committed scripts against a fresh build. `scripts/sign-all.mjs` signs a release in one step.
- **Verify.** `verify.mjs` lists unsigned tools on `dev` and fails on them with `--strict`, which `main` and
  release tags run. It checks each manifest's `api` and the registry format.
- Station log 1.0.1: comment only.

## [1.0.0] - 2026-10-06

The first registry for APRScaching 1.x.

- Hello tool and Station log, signed by OE8APR's author key.
- `registry.json` signed by the project authority key in `authority.pub`; entries relative to the registry.
- `scripts/genkey.mjs`, `scripts/sign.mjs` and `scripts/verify.mjs`.
