# Block art (GIP)

Renders CP437/ANSI art as a block-cell panel, the graphics of Graphic Packet. Other tools may push an image by publishing `render.blocks` on the bus, as `{ text }` or as a `{ cols, cells }` grid; the tool checks it before showing it.

## Use it

- `/art <text>` — render text (`\n` breaks a line); `/art` alone shows the sample

It shows on: web, terminal, bbs.

## Permissions

| Permission | Why |
|---|---|
| `command` | Registers `/art` |
| `panel` | Shows the art |
| `ipc` | Reads `render.blocks` from other tools |

## Source

`src/index.js` is the source. `tool.js` is built from it, from `lib/` and from the MIT libraries of the aprscaching
repository at the commit `lib.lock` pins (`node scripts/build.mjs`); CI checks that the committed `tool.js` matches a
fresh build.

## Signature

Unsigned until the maintainer signs `tool.json` with the author key; the registry lists it once it is signed.

## Licence

MIT, as the `SPDX-License-Identifier` line in each file states.
