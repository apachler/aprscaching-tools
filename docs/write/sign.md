# Sign a tool

This page shows you how to make your own author key and sign a tool's manifest with it, and what a player sees as a
result. It is for tool authors. At the end your `tool.json` carries `entrySha256`, `pubkey` and `signature`, and the
app installs it.

The app installs only signed tools. A signature proves the manifest and its script have not changed since you signed
them, and lets a registry vouch for your key.

## Before you start

- Node 22 or newer and a clone of [apachler/aprscaching-tools](https://github.com/apachler/aprscaching-tools): the
  key and signing scripts are in `scripts/` and need no dependencies.
- A computer you trust to hold your private key.

## Steps

1. Make an author key once, and keep the private value offline:

    ```bash
    node scripts/genkey.mjs --raw > ~/my-tool-author.key && chmod 600 ~/my-tool-author.key
    ```

    The file holds the private value. Never commit it: the repository's `.gitignore` excludes `*.key`.

2. Print your public key:

    ```bash
    node -e "console.log(JSON.parse(Buffer.from(require('fs').readFileSync(process.argv[1], 'utf8'), 'base64')).pub)" ~/my-tool-author.key
    ```

    This is the key a registry lists for you, and the one a reviewer asks you to prove is yours.

3. Sign the manifest:

    ```bash
    TOOL_PRIVATE_KEY="$(cat ~/my-tool-author.key)" node scripts/sign.mjs manifest tools/<name>/tool.json
    ```

    `sign.mjs` hashes the script `entry` names into `entrySha256`, then writes your `pubkey` and the `signature`.
    Reading the key with `"$(cat …)"` keeps the value out of your shell history. When `entry` is an absolute
    address, a script you host yourself, give your local copy of that script as a third argument:
    `node scripts/sign.mjs manifest tools/<name>/tool.json path/to/tool.js`.

4. Sign again after every change to the manifest or the script, with a new `version`.

The app refuses a script whose bytes differ from `entrySha256`, so host exactly the file you signed.

## Check that it worked

```bash
node scripts/verify.mjs
```

Your tool shows as `signed by <your key>, not listed in the registry`. Installed by address, it shows the label
**Signed · unknown author key (trust-on-first-use)**; once a registry lists it with your key, installed from the
listed address, it shows **Signed · registry-listed author key**.

## What the signature covers

The signature covers the canonical manifest: every field except `signature`, with object keys sorted, serialised
as JSON. `entrySha256` is one of those fields, so the signature covers the script's bytes too. `sign.mjs` builds the
same bytes as the app's verifier (`manifestSigningBytes()` in the `@aprscaching/tools` package), and `verify.mjs`
checks them the way the app does.

The keys are Ed25519. A public key is the raw 32-byte key, base64url; a signature is base64.

## The trust labels

The app decides one of six labels before it shows the install prompt:

| Label | When |
|---|---|
| **Signed · registry-listed author key** | The signature is valid, the manifest was fetched from the address the registry lists for this `name`, and `pubkey` equals the key the registry lists for it. |
| **Signed · matches the key you trusted before** | Valid, not registry-listed, and the key equals the one this browser accepted for this author before. |
| **Signed · unknown author key (trust-on-first-use)** | Valid, not registry-listed, and this browser does not know the key. |
| **Unsigned — refused** | No `signature` or no `pubkey`. The install stops. |
| **Author key CHANGED since you last trusted it — refused** | Valid, but the key differs from the registry's or the accepted one. The install stops. |
| **Signature INVALID — refused** | The signature does not verify. The install stops. |

Approving a signed tool stores its key for its author in the player's browser. A label vouches for who signed a
tool, not for what it does: the permissions are what limit it.

## Keep your key safe

- One key per author is enough: sign every tool you write with it, so players who accepted it once see
  **matches the key you trusted before**.
- If you change your key, every player who accepted the old one sees **Author key CHANGED** until a registry lists
  the new key or they install again. Change it only when you must, and tell the registries that list you
  ([Keys, rotation and release practice](../publish/keys-and-releases.md)).
- If the private value leaks, ask each registry that lists you to remove the entry or list a new key, and sign with
  a new key.

## Next

- [Contribute a tool](../project/contribute.md): propose your signed tool for the project registry.
- [Host a registry on GitHub](../publish/github.md): list it in your own registry.
