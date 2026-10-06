# Away note

While you are away, a station that connects is told so and may leave a short note with `NOTE <text>`. The notes stay in this page, at most 20 of 120 characters each; it is not a mailbox.

## Use it

- `/away [message]` — set away, with an optional message; `/away off` — back
- `/notes` — read the notes
- `note <text>` — what a connected peer sends

It shows on: terminal, bbs, node. Connected peers may run its commands, except the ones it keeps for the operator.

## Permissions

| Permission | Why |
|---|---|
| `command` | Registers `note`, `/away` and `/notes` |
| `event` | Hears `on_connect` to greet a peer while you are away |
| `panel` | Shows whether you are away and the latest notes |

## Source

`src/index.js` is the source. `tool.js` is built from it, from `lib/` and from the MIT libraries of the aprscaching
repository at the commit `lib.lock` pins (`node scripts/build.mjs`); CI checks that the committed `tool.js` matches a
fresh build.

## Signature

Unsigned until the maintainer signs `tool.json` with the author key; the registry lists it once it is signed.

## Licence

MIT, as the `SPDX-License-Identifier` line in each file states.
