# aprscaching tools

The project's tool registry for aprscaching 1.x: a signed list of tools for the Shack's **Tools** app, and the
tools it lists.

- `registry.json` lists each tool with its author's public key and the address of its `tool.json`. The project's
  authority key signs the list.
- `tools/<name>/` holds one tool: its `tool.json`, its script and a `README.md` that declares its licence.
- `scripts/` holds `genkey.mjs` and `sign.mjs` to make keys and sign files, and `verify.mjs` to check the
  registry and every listed tool.

The app checks the registry's signature against the authority key it pins, and shows a tool as registry-listed
only when its `tool.json` comes from the address its entry names and carries a signature by the key the entry
lists.

## How instances use it

- **Bundled.** Each aprscaching release ships a tagged release of this registry, so every instance shows it with
  no setup.
- **Added by source.** A sysop adds `github:apachler/aprscaching-tools@<tag>` under **Instance settings → Tools**
  to follow a newer tag than the bundled one. Players add the same source in their own **Tools** settings.

Entry addresses are relative to `registry.json`, so the same files work bundled with an instance and served from
`https://raw.githubusercontent.com/apachler/aprscaching-tools/<tag>/registry.json`.

## Authority key

The registry is signed by this Ed25519 public key (base64url):

```text
22usQMnB0VLUKlwA176NK2EZwqcSxcgx0M_rS2jNWp0
```

It is in `authority.pub`, in `registry.json` as `authority`, and in the aprscaching app as the default
`VITE_TOOL_REGISTRY_AUTHORITY`. Compare all three before you trust a copy of this registry. Check a checkout
yourself:

```bash
node scripts/verify.mjs
```

## Propose a tool

Open a pull request with your tool's directory, signed with your own author key. [CONTRIBUTING.md](CONTRIBUTING.md)
lists the steps and what the review checks. [MAINTAINERS.md](MAINTAINERS.md) covers listing, signing the registry
and releasing.

## Documentation

The aprscaching manual documents the tool API and the registry for aprscaching 1.x:

- [Write your first tool](https://apachler.github.io/aprscaching/contribute/first-tool/)
- [Tool reference](https://apachler.github.io/aprscaching/contribute/tool-reference/): `tool.json`, capabilities,
  the tool bus and the sandbox
- [The tool registry](https://apachler.github.io/aprscaching/contribute/tool-registry/): the file format and what
  "registry-listed" covers

## Licence

The registry file, the scripts and the documentation are MIT ([LICENSE](LICENSE)). Each tool is under the licence
it declares in its own directory.
