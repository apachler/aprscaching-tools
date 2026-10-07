# Grid & bearing

Distance and bearing between two Maidenhead locators, or one locator's position. Connected peers may ask it too.

## Use it

- `/grid <locator>` — the locator's position
- `/grid <locator> <locator>` — distance and bearing, also shown in a panel

It shows on: web, terminal, bbs, node. Stations connected to your packet terminal may run its commands, except the ones it keeps for the operator.

## Permissions

| Permission | Why |
|---|---|
| `command` | Registers `/grid` |
| `panel` | Shows the last result |

## Source

`src/index.js` is the source. `tool.js` is built from it, from `lib/` and from the MIT libraries of the APRScaching
repository at the commit `lib.lock` pins (`node scripts/build.mjs`); CI checks that the committed `tool.js` matches a
fresh build.

## Signature

Signed by OE8APR's author key, the key in `tool.json`'s `pubkey`. The maintainer signs it again at each release that
changes it, and the registry lists it with that key.

## Licence

MIT, as the `SPDX-License-Identifier` line in each file states.
