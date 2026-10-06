# The registry file

This page lists every field of `registry.json` and what its signature covers. It is for registry publishers and
anyone who checks a registry by hand.

## An example

```json
{
  "format": 1,
  "entries": [
    {
      "name": "hello-tool",
      "title": "Hello tool",
      "author": "OE8APR",
      "version": "1.0.0",
      "pubkey": "uibFUCjcBnxAe8mRQ1v2neJd0fPV_7Vs0Y59K5vH5Oc",
      "entry": "tools/hello/tool.json",
      "description": "Example signed tool: command, colour rule, panel, ROT13 decoder."
    }
  ],
  "authority": "<!-- authority-key -->",
  "sig": "<base64>"
}
```

## Fields

| Field | Content |
|---|---|
| `format` | The registry file's format, `1`. The app refuses a file of a format it does not read, and says so. |
| `entries` | The listed tools, in the order the **Registry** list shows them. |
| `entries[].name` | The tool's manifest `name`. One entry per name. |
| `entries[].title`, `author`, `version`, `description` | What the **Registry** list shows; keep them equal to the manifest. |
| `entries[].pubkey` | The author's Ed25519 public key, base64url, exactly as in the signed manifest. |
| `entries[].entry` | The `tool.json` address. A relative address resolves against the registry's own address. |
| `authority` | The public key that signed the file. It must equal the key pinned for the registry. |
| `sig` | An Ed25519 signature, base64, over `{ "format": 1, "entries": [...] }` serialised with object keys sorted. |

## What the signature covers

The signature covers `format` and `entries`: any change to an entry, its order included, needs a new signature.
`authority` and `sig` sit outside what is signed; the app checks `sig` against the key it pinned, never against
`authority` alone.

The signed bytes are the JSON of `{ format, entries }` with every object's keys sorted, no whitespace, and fields
whose value is unset left out: `scripts/sign.mjs` and `scripts/verify.mjs` build them the same way as the app.

## Relative and absolute entries

Use relative entries for tools in the same repository. A relative address resolves against the registry's own
address, so the same file works wherever it is served:

| The registry is served from | `tools/hello/tool.json` resolves to |
|---|---|
| `https://raw.githubusercontent.com/apachler/aprscaching-tools/v1.1.0/registry.json` | `…/v1.1.0/tools/hello/tool.json` |
| An instance, at `/tools/registry.json` | `/tools/tools/hello/tool.json` |

Write the address with no leading `/`: a root-absolute address such as `/tools/hello/tool.json` works at an
instance's web root but not under a repository's path. A manifest's relative `entry` script resolves against the
manifest's own address in the same way.

A tool its author hosts takes its absolute `https://` address; that server must send
`Access-Control-Allow-Origin: *`.

## Size

A registry file may hold 256 KB, and an instance carries one registry's files up to 4 MB together.

## Next

- [Host a registry on GitHub](github.md): write, sign and publish the file.
- [How registries work](index.md): what the app does with it.
