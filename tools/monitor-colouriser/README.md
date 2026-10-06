# Monitor colouriser

Colours the packet terminal's monitor by station type. It classifies every station it hears with the NAMES.GP rules (BBS, node, digipeater, DX cluster, weather, IGate, …) and colours that station's lines with the type's colour token, so the theme decides the colours.

## Use it

- Switch it on; it works on every frame the packet terminal and the live APRS layer hear.

It shows on: terminal.

The host colours each line from rules the tool publishes, one per heard station, so a station takes its colour from the first frame the tool classified, at most a second later. It keeps the last 2000 stations.

## Permissions

| Permission | Why |
|---|---|
| `monitor` | Hears the frames it classifies, and sets the colour rules the monitor draws |

## Source

`src/index.js` is the source. `tool.js` is built from it, from `lib/` and from the MIT libraries of the aprscaching
repository at the commit `lib.lock` pins (`node scripts/build.mjs`); CI checks that the committed `tool.js` matches a
fresh build.

## Signature

Unsigned until the maintainer signs `tool.json` with the author key; the registry lists it once it is signed.

## Licence

MIT, as the `SPDX-License-Identifier` line in each file states.
