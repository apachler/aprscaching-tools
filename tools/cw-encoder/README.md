# CW encoder

Encodes text as Morse code in dots and dashes, the send-side companion of the CW decoder.

## Use it

- `/cw <text>`

It shows on: web, terminal.

## Permissions

| Permission | Why |
|---|---|
| `command` | Registers `/cw` |

## Source

`src/index.js` is the source. `tool.js` is built from it, from `lib/` and from the MIT libraries of the APRScaching
repository at the commit `lib.lock` pins (`node scripts/build.mjs`); CI checks that the committed `tool.js` matches a
fresh build.

## Signature

Signed by OE8APR's author key, the key in `tool.json`'s `pubkey`. The maintainer signs it again at each release that
changes it, and the registry lists it with that key.

## Licence

MIT, as the `SPDX-License-Identifier` line in each file states.
