# Maintaining the registry

This page is for the registry's keeper: listing a reviewed tool, signing the registry, and releasing it for
aprscaching 1.x. [The tool registry](https://apachler.github.io/aprscaching/contribute/tool-registry/) in the
manual documents the file format and what a listing promises.

## The keys

The private values never enter this repository, CI, a log or the shell history. Keep each one in a file of its own
on the computer that signs (here `~/Development/github/aprscaching-keys/`), holding the value
`node scripts/genkey.mjs --raw` printed, and pass it to one command as `"$(cat <file>)"`, so the history records
the file name, not the value. The authority's public key is in `authority.pub`:

```text
22usQMnB0VLUKlwA176NK2EZwqcSxcgx0M_rS2jNWp0
```

## Build the project's tools

The project's own tools have their source in `tools/<name>/src/` and are built into `tools/<name>/tool.js`
(README, **Build**). The build is reproducible, and CI fails when a committed `tool.js` differs from a fresh build,
so the bytes you sign are the bytes the sources give. Move `lib.lock` to a new aprscaching commit or release tag
only together with a rebuild (README, **Build**).

## Sign a release

`scripts/sign-all.mjs` signs everything in one step:

```bash
corepack enable && pnpm install --frozen-lockfile --ignore-scripts
node scripts/fetch-libs.mjs --source ~/Development/github/aprscaching   # a local clone holding the lib.lock commit
AUTHOR_KEY="$(cat ~/Development/github/aprscaching-keys/oe8apr-tool-author.key)" \
AUTHORITY_KEY="$(cat ~/Development/github/aprscaching-keys/registry-authority.key)" \
  node scripts/sign-all.mjs
```

`--source` reads the libraries from a local clone (`git archive` of the pinned commit, which git checks by its
hash), so signing needs no network; run `git -C ~/Development/github/aprscaching fetch origin` first if the clone
lacks the commit. Without `--source`, `fetch-libs` fetches the commit from GitHub.

`sign-all` checks that every `tool.js` matches its sources, signs each listed `tool.json` with the author key
(including its `api` and the script's `entrySha256`), copies each manifest's key, title and version into its
registry entry, signs the registry's `format` and `entries` with the authority key and runs `verify.mjs --strict`.
A manifest signed by another author's key is left alone, and `sign-all` stops when that signature no longer holds.
The authority key must be the one in `authority.pub`.

## Add or update an entry

1. Review the pull request against [CONTRIBUTING.md](CONTRIBUTING.md#what-the-review-checks). Confirm the author
   key through the channel the author named.
2. Add the entry to `registry.json` under `entries`, in the order **Registry** shows them:

    ```json
    {
      "name": "station-log",
      "title": "Station log",
      "author": "OE8APR",
      "version": "1.0.1",
      "pubkey": "<the author's public key, as in tool.json>",
      "entry": "tools/station-log/tool.json",
      "description": "Lists the stations the Station DB tool hears, with /seen and /whois commands."
    }
    ```

    `entry` is relative to `registry.json`, with no leading `/`: a relative address resolves against the
    registry's own URL, so it works bundled with an instance and under
    `raw.githubusercontent.com/apachler/aprscaching-tools/<tag>/`. A tool hosted by its author takes its absolute
    `https://` address. Keep `name`, `title`, `author` and `version` equal to the manifest.

3. The entry is signed with the next release: on `dev` it shows as unsigned (below). The signature covers the
   registry's `format` and `entries`, their order included, so every change to an entry needs a new signature.

To remove a tool, delete its entry. To change an author's key, update the entry's `pubkey` once the author signs
with the new key.

## Verify

`node scripts/verify.mjs` checks the registry against the pinned authority (`AUTHORITY`, or else `authority.pub`)
and its `format`, then for each entry that its `tool.json` exists and names a well-formed `api`, that its signature
verifies with its own `pubkey`, that its script matches `entrySha256`, and that the entry's `pubkey` equals the
manifest's. A signature that is missing or no longer holds is listed as `UNSIG`: on `dev` a changed tool stays
unsigned until the next release. `--strict` fails on those, and on an entry address that leaves the repository
when the registry is served from a subpath. CI runs the plain check on `dev` and `--strict` on `main` and on PRs
into it; a release tag runs `--strict` again.

## Release a tag

Tags follow the aprscaching major version: `v1.<minor>.<patch>` is a registry for aprscaching 1.x. A release goes
through `dev` and `main` by pull request; `main` holds only fully signed states. For v1.1.0:

```bash
git fetch origin && git switch -c release/v1.1.0 origin/dev
# sign (above): fetch-libs, then sign-all with both keys; it ends with verify --strict
# CHANGELOG.md: rename "## [Unreleased]" to "## [1.1.0] - <date>" and open a new empty Unreleased section
git commit -s -am "chore(release): sign the registry and tools for v1.1.0"
git push -u origin release/v1.1.0
gh pr create --base dev --title "chore(release): v1.1.0" --body "Signs the registry and tools for v1.1.0."
# once it is squash-merged into dev:
gh pr create --base main --head dev --title "chore(release): v1.1.0" --body "Release v1.1.0."
# merge that one as a merge commit, then tag main:
git fetch origin && git tag -a v1.1.0 origin/main -m "registry v1.1.0"
git push origin v1.1.0
```

The tag becomes a GitHub Release with the CHANGELOG section as its notes (`release.yml`, which checks that the tag
is on `main` and runs `verify.mjs --strict`). A tag never moves: a fix is a new tag. Instances that follow
`github:apachler/aprscaching-tools@<tag>` read the files at that tag.

## Bundle a tag into an aprscaching release

The aprscaching repository ships a registry tag with every release. In a checkout of `apachler/aprscaching`, on a
feature branch cut from `dev`, run `tools/toolkey/bundle-registry.mjs` with the tag. It copies `registry.json` and
the listed tools of that tag into the web app's `public/tools/`, so the next release serves them from its own
origin with the same relative addresses. Open the change as a pull request into `dev`; it ships with the next
release.
