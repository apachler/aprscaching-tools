# Maintain the registry

This page is the registry keeper's guide: listing a reviewed tool, building and signing a release, and getting a
tag into an APRScaching release. It is for the project registry's maintainer. At the end a signed tag is on `main`,
published as a GitHub Release, and bundled into the app.

## How a release flows

`dev` is the working branch: every change reaches it by a squash-merged pull request, and a changed tool stays
unsigned there until the next release. `main` holds only fully signed states, is the default branch the address
`github:apachler/aprscaching-tools` reads, and changes only by pull request.

A release branch is cut from `dev`, signed, and merged into `main` as a merge commit. `dev` then catches up with
`main`: a fast-forward push when nothing has landed on `dev` since the release branch was cut, which is the one push
to `dev` outside a pull request, or a pull request from `main` merged as a merge commit when something has.

```mermaid
flowchart LR
  F["Feature PRs<br/>squash-merged into dev<br/>(unsigned)"] --> R["release/vX.Y.Z from dev:<br/>sign-all, CHANGELOG"]
  R --> M["PR into main,<br/>merge commit"]
  M --> T["Tag vX.Y.Z on main:<br/>GitHub Release"]
  T --> D["dev catches up:<br/>fast-forward to main"]
  T --> A["APRScaching PR:<br/>bundle-registry.mjs vX.Y.Z"]
```

## The keys

The private values never enter this repository, CI, a log or the shell history. Keep each one in a file of its own
on the computer that signs, holding the value `node scripts/genkey.mjs --raw` printed, and pass it to one command as
`"$(cat <file>)"`. The files live in the key folder, outside every repository, so no `git add` can pick them up:

- `TOOL_KEYS_DIR` when it is set;
- otherwise `$XDG_CONFIG_HOME/aprscaching-tools/keys`, which is `~/.config/aprscaching-tools/keys` when
  `XDG_CONFIG_HOME` is unset or not an absolute path.

`TOOL_AUTHOR_KEY_FILE` and `TOOL_AUTHORITY_KEY_FILE` point at one file elsewhere. The folder has mode 700 and each
file mode 600:

```bash
mkdir -p ~/.config/aprscaching-tools/keys && chmod 700 ~/.config/aprscaching-tools/keys
chmod 600 ~/.config/aprscaching-tools/keys/*.key
```

| Key | File | Signs |
|---|---|---|
| The project's author key (OE8APR) | `oe8apr-tool-author.key` | The project's own tools |
| The authority key | `registry-authority.key` | `registry.json` |

The authority's public key is `authority.pub`:

```text
<!-- authority-key -->
```

## Add or update an entry

1. Review the pull request against [what the review checks](contribute.md#what-the-review-checks). Confirm the
   author key through the channel the author named.
2. Add the entry to `registry.json` under `entries`, in the order the **Registry** list shows them:

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

    `entry` is relative to `registry.json`, with no leading `/`, so it works bundled with an instance and under
    `raw.githubusercontent.com/apachler/aprscaching-tools/<tag>/`. A tool hosted by its author takes its absolute
    `https://` address. Keep `name`, `title`, `author` and `version` equal to the manifest.

3. The entry is signed with the next release; on `dev` it shows as unsigned. The signature covers the registry's
   `format` and `entries`, their order included, so every change to an entry needs a new signature.

To remove a tool, delete its entry. To change an author's key, update the entry's `pubkey` once the author signs
with the new key.

## Release a tag

Tags follow the APRScaching major: `v1.<minor>.<patch>` is a registry for APRScaching 1.x.

### Check the computer

```bash
node scripts/doctor.mjs --release
```

The doctor checks Node, pnpm through corepack, `gh auth status`, the `origin` remote, `dev` and `main`, the libraries
in `vendor/`, that the lockfile installs, and the key files: in a folder outside every git working tree (a failure
otherwise) with mode 700 (a warning otherwise), present, mode 600, readable, the authority key the one
`authority.pub` pins and the author key the one the registry lists for OE8APR. It prints each public key and its
fingerprint, never a private value, and one `pass`, `warn` or `FAIL` line per check.

The key files are read from the key folder ([The keys](#the-keys)); the `check` step of the release script refuses
them in the same cases.

### Release with the script

Each pull request adds its own line under `## [Unreleased]` in `CHANGELOG.md`. Before a release, check that section
against the pull requests merged since the last tag and fill any gap, then:

```bash
node scripts/release.mjs 1.3.0 --dry-run    # where the release stands; changes nothing but a git fetch
node scripts/release.mjs 1.3.0              # every step that is not done, asking before each change
```

| Step | What it does |
|---|---|
| `check` | A clean tree, `gh` signed in, a new X.Y.Z version, a non-empty Unreleased section, the key files and their folder outside every working tree, a registry entry for every tool folder |
| `prepare` | `release/vX.Y.Z` from `origin/dev`, or from `--from <ref>`; `pnpm install --frozen-lockfile --ignore-scripts`, `fetch-libs` (from the local clone when there is one, else from GitHub), `build --check` |
| `sign` | `sign-all` with the two key files, ending in `verify --strict` |
| `changelog` | Dates Unreleased as `## [X.Y.Z] - <date>` under a new empty Unreleased, and sets `package.json`'s version |
| `pr-main` | Commits with a sign-off, pushes, opens the PR into `main`, watches the strict checks, merges it as a merge commit |
| `tag` | Tags `origin/main`, pushes the tag, watches the Release workflow |
| `sync-dev` | Fast-forwards `dev` to `main`; when `dev` has moved on, opens a PR from `main` into `dev` and merges it as a merge commit |
| `handover` | Prints the APRScaching command that bundles the tag |

Each step checks its precondition, says what it will do and asks `y/N` before it changes git or GitHub. A no stops the
release where it is. A rerun finds the steps already done (the release branch, a strict verify, the dated section on
`origin/main` and on `origin/dev`, the tag) and continues from the first one that is not. `--step <name>` runs one
step; `--yes` answers that step's questions, for a step already confirmed. `--source <dir>` names the APRScaching
clone `fetch-libs` reads; it defaults to `APRSCACHING_SOURCE`, then `~/Development/github/aprscaching`, and without a
clone there the libraries come from GitHub. Without a terminal every question is answered no, and the run exits 1.

The script reads the key files in the `sign` step only, and passes their values to `sign-all` in that one process's
environment. Every line it prints passes through a filter that removes them.

In Claude Code, `/release 1.3.0` runs the doctor, checks the Unreleased entry against the pull requests merged since
the last tag for your approval, and runs the steps one by one. You run the `sign` step yourself, and it merges into
`main` only on your go-ahead: before that step, or once for the whole release when nothing needs signing and every
check passes (`.claude/skills/release/SKILL.md`).

### Hotfix

A fix that cannot wait for what is on `dev` starts from the tag it fixes. `--from` names it:

```bash
node scripts/release.mjs 1.3.1 --from v1.3.0
```

`prepare` cuts `release/v1.3.1` from `v1.3.0`; write the fix and its Unreleased entry there, then go on as for any
release. `sync-dev` finds that `dev` has moved on and brings `main` in through a pull request. When `CHANGELOG.md`
conflicts there, resolve it on a branch from `dev`: merge `origin/main` into it with a merge commit, keep both the
dated hotfix section and `dev`'s Unreleased lines, and open that as the pull request into `dev`.

### Release by hand

The script runs these steps; when it cannot, run them yourself. The steps for v1.1.0:

1. Cut the release branch from `dev`:

    ```bash
    git fetch origin && git switch -c release/v1.1.0 origin/dev
    ```

2. Fetch the libraries from a local APRScaching clone that holds the `lib.lock` commit, so signing needs no network
   (`git -C ~/Development/github/aprscaching fetch origin` first if the clone lacks it):

    ```bash
    corepack enable && pnpm install --frozen-lockfile --ignore-scripts
    node scripts/fetch-libs.mjs --source ~/Development/github/aprscaching
    ```

3. Sign everything in one step:

    ```bash
    AUTHOR_KEY="$(cat ~/.config/aprscaching-tools/keys/oe8apr-tool-author.key)" \
    AUTHORITY_KEY="$(cat ~/.config/aprscaching-tools/keys/registry-authority.key)" \
      node scripts/sign-all.mjs
    ```

    `sign-all` checks that every `tool.js` matches its sources; signs each listed `tool.json` with the author key,
    including its `api` and the script's `entrySha256`; copies each manifest's key, title, author, version and
    description into
    its registry entry; signs the registry's `format` and `entries` with the authority key; and runs
    `verify.mjs --strict`. A manifest signed by another author's key is left alone, and `sign-all` stops when that
    signature does not hold. The authority key must be the one in `authority.pub`.

4. In `CHANGELOG.md`, rename `## [Unreleased]` to `## [1.1.0] - <date>` and open a new empty `Unreleased` section,
   and set `version` in `package.json` to `1.1.0`.
5. Commit, push and open the pull request into `main`; once its strict checks pass, merge it as a merge commit:

    ```bash
    git commit -s -am "chore(release): v1.1.0"
    git push -u origin release/v1.1.0
    gh pr create --base main --title "chore(release): v1.1.0" --body "Release v1.1.0."
    ```

6. Tag `main` and push the tag:

    ```bash
    git fetch origin && git tag -a v1.1.0 origin/main -m "registry v1.1.0"
    git push origin v1.1.0
    ```

7. Bring `dev` up to `main`. Git refuses the push unless it is a fast-forward; then open a pull request from `main`
   into `dev` instead, and merge it as a merge commit:

    ```bash
    git push origin origin/main:refs/heads/dev
    ```

The tag becomes a GitHub Release, with the CHANGELOG section as its notes (`.github/workflows/release.yml`, which
checks that the tag is on `main` and runs `verify.mjs --strict`). A tag never moves: a fix is a new tag. A ruleset
refuses to delete or move a `v*` tag, and releases are immutable, so a published release and its files stay as they
were published. Instances that follow `github:apachler/aprscaching-tools@<tag>` read the files at that tag.

### The release files

Each release carries `aprscaching-tools-vX.Y.Z.tar.gz` (the registry, `authority.pub`, the licence and the tools at
the tag), its SHA-256, and a build-provenance attestation (`.intoto.jsonl`) that names the workflow run which made
the archive. Check a download with:

```bash
sha256sum -c aprscaching-tools-vX.Y.Z.tar.gz.sha256
gh attestation verify aprscaching-tools-vX.Y.Z.tar.gz -R apachler/aprscaching-tools
```

The archive is a convenience: instances read the files at the tag, and the registry and manifest signatures are what
they check.

## Verify

`node scripts/verify.mjs` checks the registry against the pinned authority (`AUTHORITY`, or else `authority.pub`)
and its `format`, then for each entry: that its `tool.json` exists and names a well-formed `api`, that its signature
verifies with its own `pubkey`, that its script matches `entrySha256`, and that the entry's `pubkey` equals the
manifest's.

A signature that is missing or does not hold is listed as `UNSIG`; on `dev` a changed tool stays unsigned until the
next release. `--strict` fails on those, and on an entry address that leaves the repository when the registry is
served from a subpath. CI runs the plain check on `dev`, and `--strict` on `main`, on pull requests into it and on
release tags.

## Bundle a tag into an APRScaching release

Every APRScaching release ships a registry tag. In a checkout of
[apachler/aprscaching](https://github.com/apachler/aprscaching), on a feature branch cut from `dev`:

```bash
node tools/toolkey/bundle-registry.mjs v1.1.0
```

The script fetches the tag from GitHub and checks the registry's signature against the project key pinned in the
app, each manifest's signature against the author key its entry lists, and each script against its manifest's
`entrySha256`. It writes nothing when any check fails. It copies `registry.json` and the listed tools into the web
app's `public/tools/`, keeping the repository's layout, so the instance serves them from its own address with the
same relative entries. Open the change as a pull request into `dev`; it ships with the next APRScaching release.

In Claude Code in the APRScaching repository, `/bundle-tools v1.1.0` does this on a `chore/bundle-tools-v1.1.0`
branch: it reads the tag from a temporary worktree of this repository, runs the gate (`pnpm run verify`, the tool
sandbox end-to-end test and the visual run of the tools surfaces) and opens the pull request. It merges nothing.

When the new tag needs a newer tool API than the app implements, it waits for the app release that implements it
([Tool API versions](../api/index.md)).

## The documentation site

This site is built from `docs/` with MkDocs (`mkdocs.yml`). Every pull request into `dev` or `main` that touches the
docs, the tools or the registry builds it with `mkdocs build --strict`, and a push to `main` publishes it to GitHub Pages (`.github/workflows/docs.yml`). A new tool
needs its catalogue page: the build fails for a tool folder without one.

## The repository checks on dev and main

`pnpm test` checks every tool folder against its registry entry. Contributors open pull requests before the entry
exists, so on `dev` a folder without one is a warning. With `STRICT=1`, which CI sets on `main`, on pull requests into
it and on release tags, it fails: `main` holds only listed, signed tools. Add the entries before the release.

## Next

- [Contribute a tool](contribute.md): what a contributor sends you.
- [Keys, rotation and release practice](../publish/keys-and-releases.md): when a key changes or leaks.
