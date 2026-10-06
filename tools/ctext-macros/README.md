# CTEXT macro pack

Canned text for the packet terminal and the BBS: `/cq`, `/73` and `/qth`. The surface that sends the text fills in `{call}` and `{grid}`.

## Use it

- `/cq` — `CQ CQ CQ de {call} k`
- `/73` — `73 es gud dx de {call}`
- `/qth` — `QTH is {grid}`

It shows on: terminal, bbs.

## Permissions

| Permission | Why |
|---|---|
| `command` | Registers `/cq`, `/73` and `/qth` |

## Source

`src/index.js` is the source. `tool.js` is built from it, from `lib/` and from the MIT libraries of the APRScaching
repository at the commit `lib.lock` pins (`node scripts/build.mjs`); CI checks that the committed `tool.js` matches a
fresh build.

## Signature

Unsigned until the maintainer signs `tool.json` with the author key; the registry lists it once it is signed.

## Licence

MIT, as the `SPDX-License-Identifier` line in each file states.
