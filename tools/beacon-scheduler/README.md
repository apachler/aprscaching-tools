# Beacon scheduler

Transmits a status beacon at a fixed interval. The host sends it over the browser radio link as an APRS status (`>comment`), only with a control-verified callsign and the transmit consent given to this tab, and lists each beacon in Recent transmissions.

## Use it

- `/beacon <minutes> <comment>` — every `<minutes>`, 10 through 1440 (comment `APRScaching` when left out)
- `/beacon off` — stop

It shows on: terminal.

**What it transmits:** one APRS status packet with your comment, from your callsign, every interval you set and never more often than every 10 minutes. It transmits only after you run `/beacon`, and stops on `/beacon off`, when the tool is switched off, or when the tab closes.

## Permissions

| Permission | Why |
|---|---|
| `command` | Registers `/beacon` |
| `beacon` | Schedules the beacon; the host gates it on the verified callsign and the tab's consent |

## Source

`src/index.js` is the source. `tool.js` is built from it, from `lib/` and from the MIT libraries of the APRScaching
repository at the commit `lib.lock` pins (`node scripts/build.mjs`); CI checks that the committed `tool.js` matches a
fresh build.

## Signature

Signed by OE8APR's author key, the key in `tool.json`'s `pubkey`. The maintainer signs it again at each release that
changes it, and the registry lists it with that key.

## Licence

MIT, as the `SPDX-License-Identifier` line in each file states.
