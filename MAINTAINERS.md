# Maintaining the registry

This page is for the registry's keeper: listing a reviewed tool, signing the registry, and releasing it for
aprscaching 1.x. [The tool registry](https://apachler.github.io/aprscaching/contribute/tool-registry/) in the
manual documents the file format and what a listing promises.

## The authority key

The authority's private value never enters this repository, CI or a networked machine's disk. Sign on the
offline computer that holds it, then copy the signed `registry.json` back. Its public key is in `authority.pub`:

```text
22usQMnB0VLUKlwA176NK2EZwqcSxcgx0M_rS2jNWp0
```

## Add or update an entry

1. Review the pull request against [CONTRIBUTING.md](CONTRIBUTING.md#what-the-review-checks). Confirm the author
   key through the channel the author named.
2. Add the entry to `registry.json` under `entries`, in the order **Registry** shows them:

    ```json
    {
      "name": "station-log",
      "title": "Station log",
      "author": "OE8APR",
      "version": "1.0.0",
      "pubkey": "<the author's public key, as in tool.json>",
      "entry": "tools/station-log/tool.json",
      "description": "Lists the stations the Station DB tool hears, with /seen and /whois commands."
    }
    ```

    `entry` is relative to `registry.json`, with no leading `/`: a relative address resolves against the
    registry's own URL, so it works bundled with an instance and under
    `raw.githubusercontent.com/apachler/aprscaching-tools/<tag>/`. A tool hosted by its author takes its absolute
    `https://` address. Keep `name`, `title`, `author` and `version` equal to the manifest.

3. Sign the registry with the authority key. The signature covers `entries`, their order included, so every
   change to an entry needs a new signature:

    ```bash
    TOOL_PRIVATE_KEY=<authority private value> node scripts/sign.mjs registry registry.json
    ```

4. Verify, then commit with a sign-off:

    ```bash
    node scripts/verify.mjs --strict
    git commit -s -m "feat(registry): list station-log"
    ```

To remove a tool, delete its entry and sign again. To change an author's key, update the entry's `pubkey` once the
author signs with the new key, and sign again.

## Verify

`node scripts/verify.mjs` checks the registry against the pinned authority (`AUTHORITY`, or else `authority.pub`),
then for each entry that its `tool.json` exists, that its signature verifies with its own `pubkey`, and that the
entry's `pubkey` equals the manifest's. It lists the tools under `tools/` that the registry does not list, and
exits non-zero on any failure. `--strict` also fails on an entry address that leaves the repository when the
registry is served from a subpath. CI runs it on every push and pull request.

## Release a tag

Tags follow the aprscaching major version: `v1.<minor>.<patch>` is a registry for aprscaching 1.x.

```bash
node scripts/verify.mjs --strict
git tag -a v1.0.0 -m "registry v1.0.0"
git push origin main v1.0.0
```

A tag never moves: a fix is a new tag. Instances that follow `github:apachler/aprscaching-tools@<tag>` read the
files at that tag.

## Bundle a tag into an aprscaching release

The aprscaching repository ships a registry tag with every release. In a checkout of `apachler/aprscaching`, on a
feature branch cut from `dev`, run `tools/toolkey/bundle-registry.mjs` with the tag. It copies `registry.json` and
the listed tools of that tag into the web app's `public/tools/`, so the next release serves them from its own
origin with the same relative addresses. Open the change as a pull request into `dev`; it ships with the next
release.
