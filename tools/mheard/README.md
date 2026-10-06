# MHeard

A rolling list of the stations heard most recently, from every source: the packet terminal's RF, the live APRS layer and any other source that feeds heard frames. Each row says where the station was heard and how long ago.

## Use it

- Switch it on; the panel shows the last 14 stations and refreshes every minute.

It shows on: terminal, web.

## Permissions

| Permission | Why |
|---|---|
| `monitor` | Hears the frames it lists |
| `event` | Refreshes the ages on the minute tick |
| `panel` | Shows the list |

## Source

`src/index.js` is the source. `tool.js` is built from it, from `lib/` and from the MIT libraries of the APRScaching
repository at the commit `lib.lock` pins (`node scripts/build.mjs`); CI checks that the committed `tool.js` matches a
fresh build.

## Signature

Unsigned until the maintainer signs `tool.json` with the author key; the registry lists it once it is signed.

## Licence

MIT, as the `SPDX-License-Identifier` line in each file states.
