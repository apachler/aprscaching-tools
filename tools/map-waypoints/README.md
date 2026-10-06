# Map waypoints

Drops markers on the map. The markers are a declarative map layer, drawn by the app with the theme's colours.

## Use it

- `/wp <locator|lat,lon> [label]` — add a marker
- `/wpclear` — remove them all

It shows on: web, map.

## Permissions

| Permission | Why |
|---|---|
| `command` | Registers `/wp` and `/wpclear` |
| `map` | Draws the markers on the map |

## Source

`src/index.js` is the source. `tool.js` is built from it, from `lib/` and from the MIT libraries of the APRScaching
repository at the commit `lib.lock` pins (`node scripts/build.mjs`); CI checks that the committed `tool.js` matches a
fresh build.

## Signature

Signed by OE8APR's author key, the key in `tool.json`'s `pubkey`. The maintainer signs it again at each release that
changes it, and the registry lists it with that key.

## Licence

MIT, as the `SPDX-License-Identifier` line in each file states.
