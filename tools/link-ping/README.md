# Link ping (RTT)

The rolling round-trip time to the connected station. The connected surface times the round trip and publishes each sample as `link.rtt` `{ ms }` on the bus; `/ping` asks for one with `link.ping.request`.

## Use it

- `/ping` — ask for a sample

It shows on: terminal, node.

## Permissions

| Permission | Why |
|---|---|
| `command` | Registers `/ping` |
| `ipc` | Reads `link.rtt` and publishes `link.ping.request` |
| `panel` | Shows the last and average round trip |

## Source

`src/index.js` is the source. `tool.js` is built from it, from `lib/` and from the MIT libraries of the aprscaching
repository at the commit `lib.lock` pins (`node scripts/build.mjs`); CI checks that the committed `tool.js` matches a
fresh build.

## Signature

Unsigned until the maintainer signs `tool.json` with the author key; the registry lists it once it is signed.

## Licence

MIT, as the `SPDX-License-Identifier` line in each file states.
