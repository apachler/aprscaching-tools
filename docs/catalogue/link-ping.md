# Link ping (RTT)

Link ping shows the round-trip time to the station you are connected to. It is for operators who judge a packet
link before sending a long message.

## What it does

While a TNC is open, the packet terminal times each round trip on a connected channel, from a frame's
acknowledgement or from a poll, and publishes the sample as `link.rtt` on the tool bus. The tool keeps the last 50
samples and shows the last and the average in its panel. `/ping` asks the terminal for a sample by publishing
`link.ping.request`: the terminal sends one poll on the channel in view, at most one every 10 seconds, under its
transmit gate.

## Use it

1. Connect to a station in the packet terminal.
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
