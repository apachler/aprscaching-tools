# Unit converter

Converts the common ham units: km, mi, m, ft, yd, kn, km/h, nautical miles, and °C/°F. Connected peers may ask it too.

## Use it

- `/conv <value> <from> <to>` — for example `/conv 100 km mi` or `/conv 20 c f`

It shows on: web, terminal, bbs, node. Connected peers may run its commands, except the ones it keeps for the operator.

## Permissions

| Permission | Why |
|---|---|
| `command` | Registers `/conv` |

## Source

`src/index.js` is the source. `tool.js` is built from it, from `lib/` and from the MIT libraries of the APRScaching
repository at the commit `lib.lock` pins (`node scripts/build.mjs`); CI checks that the committed `tool.js` matches a
fresh build.

## Signature

Unsigned until the maintainer signs `tool.json` with the author key; the registry lists it once it is signed.

## Licence

MIT, as the `SPDX-License-Identifier` line in each file states.
