# Connect bell

Rings when a station connects: a notice in the tool log and the last connect in a panel. It pairs with Watch & alert.

## Use it

- Switch it on.

It shows on: terminal, bbs, node.

## Permissions

| Permission | Why |
|---|---|
| `event` | Hears `on_connect` |
| `panel` | Shows the last connect |

## Source

`src/index.js` is the source. `tool.js` is built from it, from `lib/` and from the MIT libraries of the APRScaching
repository at the commit `lib.lock` pins (`node scripts/build.mjs`); CI checks that the committed `tool.js` matches a
fresh build.

## Signature

Signed by OE8APR's author key, the key in `tool.json`'s `pubkey`. The maintainer signs it again at each release that
changes it, and the registry lists it with that key.

## Licence

MIT, as the `SPDX-License-Identifier` line in each file states.
