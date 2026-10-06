# Host a registry on GitHub

This page shows you how to publish a signed tool registry from a GitHub repository, with no server of your own. It
is for anyone who wants to offer a set of tools: a club, a group of authors, or one author. At the end instances
and players can add your registry by address and pin its key.

## Before you start

- A GitHub repository for the registry, public.
- Node 22 or newer, and the signing scripts: `genkey.mjs`, `sign.mjs` and `verify.mjs` from
  [`scripts/`](https://github.com/apachler/aprscaching-tools/tree/dev/scripts) in apachler/aprscaching-tools. They
  are MIT and need no dependencies; copy them into your repository.
- Each tool's signed `tool.json` and script, or the address its author hosts them at
  ([Sign a tool](../write/sign.md)).
- A computer you trust to hold the registry's private key.

## Steps

1. Lay the repository out with the registry at the root and each tool in a folder of its own:

    ```text
    registry.json
    authority.pub
    scripts/genkey.mjs
    scripts/sign.mjs
    scripts/verify.mjs
    tools/hello/tool.json
    tools/hello/tool.js
    ```

2. Make the registry's authority key once, on the trusted computer, and keep its private value offline:

    ```bash
    node scripts/genkey.mjs --raw > ~/my-registry-authority.key && chmod 600 ~/my-registry-authority.key
    node -e "console.log(JSON.parse(Buffer.from(require('fs').readFileSync(process.argv[1], 'utf8'), 'base64')).pub)" ~/my-registry-authority.key > authority.pub
    ```

    `authority.pub` holds the public key; commit it. Never commit the key file.

3. Write `registry.json` with one entry per tool. Use a relative `entry` for a tool in the repository and an absolute
   `https://` address for one its author hosts:

    ```json
    {
      "format": 1,
      "entries": [
        {
          "name": "hello-tool",
          "title": "Hello tool",
          "author": "OE8APR",
          "version": "1.0.0",
          "pubkey": "<the author's public key, as in tool.json>",
          "entry": "tools/hello/tool.json",
          "description": "Example signed tool: command, colour rule, panel, ROT13 decoder."
        }
      ]
    }
    ```

    Keep `name`, `title`, `author` and `version` equal to the manifest. [The registry file](registry-file.md) lists
    every field.

4. Sign the registry with the authority key:

    ```bash
    TOOL_PRIVATE_KEY="$(cat ~/my-registry-authority.key)" node scripts/sign.mjs registry registry.json
    ```

    It writes `format`, `authority` and `sig`. Sign again after every change to an entry.

5. Check every signature the way the app does, then commit, push and tag:

    ```bash
    node scripts/verify.mjs --strict
    git add registry.json tools && git commit -s -m "chore(release): v1.0.0" && git push
    git tag -a v1.0.0 -m "registry v1.0.0" && git push origin v1.0.0
    ```

6. Publish the authority key's fingerprint in the README, beside the key. The app shows the fingerprint when someone
   adds the registry; it is the first 64 bits of SHA-256 over the raw key, four groups of four hex digits:

    ```bash
    node -e "const k=Buffer.from(process.argv[1],'base64url');console.log(require('crypto').createHash('sha256').update(k).digest('hex').slice(0,16).match(/..../g).join(' '))" "$(cat authority.pub)"
    ```

## The address people add

| Address | Serves |
|---|---|
| `github:owner/repo@v1.0.0` | The tag's `registry.json`, from `raw.githubusercontent.com` |
| `github:owner/repo/path/to/registry.json@main` | A file on a branch |
| `github:owner/repo` | `registry.json` on the default branch |
| `https://owner.github.io/repo/registry.json` | GitHub Pages, when the repository publishes one |

Both `raw.githubusercontent.com` and GitHub Pages send `Access-Control-Allow-Origin: *`, so the app can fetch from
either.

### Raw files or GitHub Pages

- **Raw files** (`github:` addresses) need nothing beyond the repository, and a tag's files never change. Give
  people this form.
- **GitHub Pages** serves one branch or one build at its own address. It suits a registry that also has a website,
  but the address follows whatever Pages publishes, as a branch does.

### A tag or a branch

- **`@tag`** pins one release: the list changes only when an instance or a player switches to a newer tag. Use it
  for the address you publish, and tag every release.
- **A branch** follows every push: people see a new entry the moment you sign and push it, and an unsigned state the
  moment you push one. Keep it for testing.

The signatures protect either way: a file changed by anyone without the authority key fails, and a script changed
without a new manifest signature fails its hash.

## Check that it worked

Add the registry to a local app (**Tools → Your registries**) or an instance you run, by `github:owner/repo@v1.0.0`.
The app shows the fingerprint you published, the number of tools and a few titles. After **It matches: pin and add**,
your tools appear under **Registry**, and installing one shows **Signed · registry-listed author key**.

## Next

- [Keys, rotation and release practice](keys-and-releases.md): keep the registry trustworthy over time.
- [The registry file](registry-file.md): the format in full.
