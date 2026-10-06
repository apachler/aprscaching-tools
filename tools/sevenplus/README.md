# 7PLUS reassembler

Reads pasted 7PLUS parts, the packet-BBS way to move binary files as text, and reports the file, the parts found and the parts still missing, so scattered parts can be collected. It does not rebuild the file.

## Use it

- In **Tools → Decode**, pick **7PLUS** and paste the parts.

It shows on: web.

## Permissions

| Permission | Why |
|---|---|
| `decoder` | Adds the **7PLUS** decoder |

## Source

`src/index.js` is the source. `tool.js` is built from it, from `lib/` and from the MIT libraries of the APRScaching
repository at the commit `lib.lock` pins (`node scripts/build.mjs`); CI checks that the committed `tool.js` matches a
fresh build.

## Signature

Unsigned until the maintainer signs `tool.json` with the author key; the registry lists it once it is signed.

## Licence

MIT, as the `SPDX-License-Identifier` line in each file states.
