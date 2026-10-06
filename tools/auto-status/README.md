# Auto-status

Transmits an APRS status (`>text`) every so many minutes. Each transmission passes the host's gate: a control-verified callsign and the transmit consent given to this tab, at most once a minute. Without them the status is held and the tool log says so.

## Use it

- `/autostatus <minutes> <text>` — start, every 10 minutes or more (default 10, text `APRScaching`)
- `/autostatus off` — stop

It shows on: terminal.

**What it transmits:** one APRS status packet with your text, from your callsign, every interval you set. It transmits only after you run `/autostatus`, and stops on `/autostatus off`, when the tool is switched off, or when the tab closes.

## Permissions

| Permission | Why |
|---|---|
| `command` | Registers `/autostatus` |
| `event` | Counts the minute tick |
| `tx` | Transmits the status; the host gates it on the verified callsign and the tab's consent |

## Source

`src/index.js` is the source. `tool.js` is built from it, from `lib/` and from the MIT libraries of the aprscaching
repository at the commit `lib.lock` pins (`node scripts/build.mjs`); CI checks that the committed `tool.js` matches a
fresh build.

## Signature

Unsigned until the maintainer signs `tool.json` with the author key; the registry lists it once it is signed.

## Licence

MIT, as the `SPDX-License-Identifier` line in each file states.
