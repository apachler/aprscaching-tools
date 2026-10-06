# Link ping (RTT)

Link ping shows the round-trip time to the station you are connected to. It is for operators who judge a packet
link before sending a long message.

## What it does

The connected surface times each round trip and publishes the sample as `link.rtt` with `{ ms }` on the tool bus.
The tool keeps the last 50 samples and shows the last and the average in its panel. `/ping` asks the surface for a
sample by publishing `link.ping.request`.

## Use it

1. Connect to a station in the packet terminal or the node.
2. Type `/ping`.

The panel shows the last round trip and the average.

## Permissions

| Permission | Why |
|---|---|
| `command` | Registers `/ping` |
| `ipc` | Reads `link.rtt` and publishes `link.ping.request` |
| `panel` | Shows the last and average round trip |

## Version and tool API

<!-- tool-facts -->

## Next

- [The tool bus](../write/tool-bus.md): `link.rtt` and `link.ping.request`.
- [Tool catalogue](index.md): the other monitor and station tools.
