# Changelog

Each release of the registry is a tag `vX.Y.Z` on `main`; an APRScaching release bundles one. Tool API and registry
format versions are named where they change.

## [Unreleased]

- **Back up the keys.** The maintainer's guide shows how to keep an encrypted offline copy of the signing keys and
  check it, and what a lost key costs without one.
- **Discussions.** Forms for Q&A and Ideas, and the issue chooser and SUPPORT.md link to each.
- **Tests.** CONTRIBUTING.md states the test policy: new behaviour adds its tests, a bug fix the test that would have
  caught it.
- **The next version.** `release.mjs` and `/release` need no version: the Conventional Commits on `dev` since the
  newest tag choose it (a breaking change the next major, a `feat` the next minor, anything else the next patch). A
  release in progress keeps its version, and `--from vX.Y.Z` makes a patch on that tag.
- **`/release`** runs the whole release on one request, signing and the merge into `main` included, and stops only
  on a failure, a CHANGELOG line it had to write, or something unexpected. It never reads the key files.
- **Release workflow.** Only the release job may write; the workflow as a whole reads.
- **Docs build.** `docs/requirements.txt` names every file of each pinned package by its SHA-256, and CI installs it
  with `--require-hashes`.
- **README badges.** CI, licence, latest release, documentation site and OpenSSF Scorecard.

## [1.3.0] - 2026-10-06

Twelve tools fixed after a full review, a verifier that fails closed, lint, and release files with provenance.

- **Verify.** It fails a manifest that holds no JSON object, an entry address with an encoded slash or one that
  leaves the repository, and, with `--strict`, an entry whose title, author, version or description differs from
  its manifest. `sign-all` copies the description into the registry entry as well.
- **Scripts.** `sign.mjs` takes the local copy of a hosted script as a third argument and refuses an `entry` outside
  the manifest's folder. `release.mjs` resumes a tag that was made but not pushed, refuses an option without its
  value, and exits 1 when it stopped for want of a terminal. `new-tool.mjs` writes working code for any one-line
  title and refuses a name another tool holds.
- **Release files.** Each release carries the registry as an archive, its SHA-256 and a build-provenance attestation;
  release tags cannot be moved or deleted, and published releases are immutable.
- **Lint and format.** ESLint and Prettier check the scripts, tests and tool sources in CI (`pnpm lint`);
  `pnpm format` lays the code out.
- **Community files.** A security policy, a code of conduct, a support guide, code owners and issue forms: a bug
  report, a tool proposal, and a report about a tool in the registry. `LICENSE` holds the plain MIT text, so GitHub
  shows the licence as MIT; the README says which files it covers and that each tool carries its own.
- **OpenSSF Scorecard.** A weekly rating of the repository's supply-chain practice, shown as a README badge.
- **Write your first tool** starts from `scripts/new-tool.mjs`, so the tool it builds has its catalogue page and
  passes `mkdocs build --strict`. The limits page says which colour-rule call takes how many rules and caps a
  decoder's answer at 20,000 characters; the `load` message names `api` and `features`; the tick test example sets
  the interval first.
- **Docs.** The catalogue pages, the tool READMEs and the maintainer's guide match what the code does.
- Auto-status 1.1.1: `/autostatus OFF` stops it in any letter case, and a command without a number first answers
  with its usage instead of transmitting.
- Beacon scheduler 1.1.1: a command without a number first answers with its usage instead of starting a beacon, and
  the interval it reports stops at one day, as the app's does.
- Monitor colouriser 1.1.1: weather and DX-cluster stations take the theme's `--st-wx` and `--st-dx` colours, and it
  keeps the 1200 stations heard most recently, so that its rules fit in one message.
- Station DB 1.1.1: classifies a station from its destination as well, as the monitor colouriser does.
- Watch & alert 1.1.1: shows the UTC time a call was last heard, logs a hit after ten quiet minutes, and takes
  several calls in one `/watch` or `/unwatch`.
- Connect bell 1.0.1: shows the UTC time of the last connect.
- MHeard 1.0.1: redraws its panel at most once a second, so a burst of frames stays within the message budget.
- 7PLUS reassembler 1.0.1: reads real part headers (`go_7+. 001 of 003 NAME`), collects every pasted part and names
  the parts still missing.
- Scheduled query 1.0.1: schedules run every 10 minutes or more, each scheduled run's outcome goes to the tool log,
  and a script without steps is not scheduled.
- Unit converter 1.1.1: accepts `km/h` as well as `kmh`.
- Info / menu responder 1.1.1: `MENU` lists the commands this tool answers.
- PSK31 + CW decoders 1.0.1: the CW example decodes.

## [1.2.2] - 2026-10-06

- **Pull requests into `main`.** They come from a `release/vX.Y.Z` branch: `verify`, now a required check on `main`,
  fails any other. Dependabot opens its pull requests against `dev`.
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
