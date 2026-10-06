# Info / menu responder

Answers a connected peer's `INFO`, `MENU` and `WHOIS <call>`. `WHOIS` asks the Station DB tool over the bus. `/setinfo`, which sets the text peers read, is the operator's alone.

## Use it

- `info`, `menu`, `whois <call>` — for peers and the operator
- `/setinfo <text>` — the operator sets the info text (up to 240 characters)

It shows on: terminal, bbs, node. Connected peers may run its commands, except the ones it keeps for the operator.

## Permissions

| Permission | Why |
|---|---|
| `command` | Registers the commands |
| `panel` | Shows the info text peers read |
| `ipc` | Calls Station DB's `station.type` service for `WHOIS` |

## Source

`src/index.js` is the source. `tool.js` is built from it, from `lib/` and from the MIT libraries of the aprscaching
repository at the commit `lib.lock` pins (`node scripts/build.mjs`); CI checks that the committed `tool.js` matches a
fresh build.

## Signature

Unsigned until the maintainer signs `tool.json` with the author key; the registry lists it once it is signed.

## Licence

MIT, as the `SPDX-License-Identifier` line in each file states.
