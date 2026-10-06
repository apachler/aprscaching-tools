# Auto-responder

Greets a station that connects, PMS-style, with its callsign and the station it reached, through the reply the connected surface offers.

## Use it

- Switch it on; a connecting station reads `Welcome <call> - this is <your call> auto-responder. Type H for help.`

It shows on: terminal, bbs, node.

## Permissions

| Permission | Why |
|---|---|
| `event` | Hears `on_connect` and answers through the session's reply |

## Source

`src/index.js` is the source. `tool.js` is built from it, from `lib/` and from the MIT libraries of the APRScaching
repository at the commit `lib.lock` pins (`node scripts/build.mjs`); CI checks that the committed `tool.js` matches a
fresh build.

## Signature

Unsigned until the maintainer signs `tool.json` with the author key; the registry lists it once it is signed.

## Licence

MIT, as the `SPDX-License-Identifier` line in each file states.
