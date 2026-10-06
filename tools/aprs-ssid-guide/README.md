# APRS SSID guide

A panel with the conventional APRS SSID assignments (-9 mobile, -10 IGate, -13 weather, …).

## Use it

- Switch it on; the table shows in Tools, the packet terminal and the BBS.

It shows on: web, terminal, bbs.

## Permissions

| Permission | Why |
|---|---|
| `panel` | Shows the SSID table |

## Source

`src/index.js` is the source. `tool.js` is built from it, from `lib/` and from the MIT libraries of the APRScaching
repository at the commit `lib.lock` pins (`node scripts/build.mjs`); CI checks that the committed `tool.js` matches a
fresh build.

## Signature

Unsigned until the maintainer signs `tool.json` with the author key; the registry lists it once it is signed.

## Licence

MIT, as the `SPDX-License-Identifier` line in each file states.
