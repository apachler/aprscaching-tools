# Grid & bearing

Distance and bearing between two Maidenhead locators, or one locator's position. Connected peers may ask it too.

## Use it

- `/grid <locator>` — the locator's position
- `/grid <locator> <locator>` — distance and bearing, also shown in a panel

It shows on: web, terminal, bbs, node. Connected peers may run its commands, except the ones it keeps for the operator.

## Permissions

| Permission | Why |
|---|---|
| `command` | Registers `/grid` |
| `panel` | Shows the last result |

## Source

`src/index.js` is the source. `tool.js` is built from it, from `lib/` and from the MIT libraries of the aprscaching
repository at the commit `lib.lock` pins (`node scripts/build.mjs`); CI checks that the committed `tool.js` matches a
fresh build.

## Signature

Unsigned until the maintainer signs `tool.json` with the author key; the registry lists it once it is signed.

## Licence

MIT, as the `SPDX-License-Identifier` line in each file states.
