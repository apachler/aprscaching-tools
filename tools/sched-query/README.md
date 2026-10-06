# Scheduled query (GPAUTO)

Runs a connect / waitfor / send / disconnect script against a BBS or a DX cluster, now or every so many minutes (Graphic Packet's GPAUTO), and shows its progress and the captured reply. The packet terminal owns the connection and offers the `session.script` service while its TNC is open.

## Use it

- `/gpauto connect HB9W-8; waitfor Cluster; send sh/dx; disconnect` — run now
- `/gpauto every <minutes> <steps>` — run now and then on schedule; `/gpauto off` stops it
- `/gpauto run` — run the stored script again

It shows on: terminal, node.

**What it transmits:** the connect, the lines your script sends and the disconnect, through the packet terminal's own session, which needs your verified callsign and its transmit consent. It runs only the scripts you give it, when you ask or on the schedule you set.

## Permissions

| Permission | Why |
|---|---|
| `command` | Registers `/gpauto` |
| `event` | Counts the minute tick for scheduled runs |
| `ipc` | Calls the terminal's `session.script` service and reads `session.progress` |
| `panel` | Shows the progress and the captured reply |
| `tx` | The `session.script` service connects and sends over your TNC, so it requires this permission |

## Source

`src/index.js` is the source. `tool.js` is built from it, from `lib/` and from the MIT libraries of the aprscaching
repository at the commit `lib.lock` pins (`node scripts/build.mjs`); CI checks that the committed `tool.js` matches a
fresh build.

## Signature

Unsigned until the maintainer signs `tool.json` with the author key; the registry lists it once it is signed.

## Licence

MIT, as the `SPDX-License-Identifier` line in each file states.
