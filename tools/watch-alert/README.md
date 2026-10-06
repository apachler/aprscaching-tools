# Watch & alert

Watch for callsigns. When a watched station is heard, from the packet terminal or the live APRS layer, the panel records when, and its monitor lines turn the warning colour. Watching a base call (`OE8APR`) catches every SSID of it; watching `OE8APR-9` catches that station only.

## Use it

- `/watch <call>` — watch a call; `/watch` lists them
- `/unwatch <call>` — stop watching it

It shows on: terminal, web.

## Permissions

| Permission | Why |
|---|---|
| `command` | Registers `/watch` and `/unwatch` |
| `monitor` | Hears the frames it checks, and colours the watched stations' lines |
| `panel` | Shows the watched calls and when each was last heard |

## Source

`src/index.js` is the source. `tool.js` is built from it, from `lib/` and from the MIT libraries of the APRScaching
repository at the commit `lib.lock` pins (`node scripts/build.mjs`); CI checks that the committed `tool.js` matches a
fresh build.

## Signature

Unsigned until the maintainer signs `tool.json` with the author key; the registry lists it once it is signed.

## Licence

MIT, as the `SPDX-License-Identifier` line in each file states.
