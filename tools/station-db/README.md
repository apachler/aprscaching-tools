# Station DB (NAMES.GP)

Classifies every station it hears (NAMES.GP) and shares that on the tool bus. It shows nothing itself: Station log and the info responder read it.

## Use it

- Publishes `station.seen` `{ call, type, source }` for every heard frame.
- Answers the `station.type` service with a heard station's type, or `""` for one it has not heard.

It shows on: terminal, bbs, node.

## Permissions

| Permission | Why |
|---|---|
| `monitor` | Hears the frames it classifies |
| `ipc` | Publishes `station.seen` and provides `station.type` on the bus |

## Source

`src/index.js` is the source. `tool.js` is built from it, from `lib/` and from the MIT libraries of the aprscaching
repository at the commit `lib.lock` pins (`node scripts/build.mjs`); CI checks that the committed `tool.js` matches a
fresh build.

## Signature

Unsigned until the maintainer signs `tool.json` with the author key; the registry lists it once it is signed.

## Licence

MIT, as the `SPDX-License-Identifier` line in each file states.
