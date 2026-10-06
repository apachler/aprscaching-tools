# Info / menu responder

The info responder answers a connected station's `INFO`, `MENU` and `WHOIS`, the way a Graphic Packet server did.
It is for operators who want their station to answer simple questions while they are busy.

## What it does

A connected station, or you, may type:

| Command | Answer |
|---|---|
| `info` | The info text you set; by default `APRScaching shack station. Type MENU for commands. 73!` |
| `menu` | The commands this tool answers: `INFO`, `MENU` and `WHOIS <call>` |
| `whois <call>` | The station's type, from Station DB's `station.type` service |

`/setinfo <text>` sets the info text, up to 240 characters. It is yours alone: a connected station cannot run it.
`whois` needs [Station DB (NAMES.GP)](station-db.md) switched on.

## Use it

1. Install Station DB and the info responder, and switch both on.
2. Type `/setinfo OE8APR in JN76. Type MENU for commands.`

A station that connects and sends `info` reads that text.

## Permissions

| Permission | Why |
|---|---|
| `command` | Registers the commands |
| `panel` | Shows the info text peers read |
| `ipc` | Calls Station DB's `station.type` service for `WHOIS` |

## Version and tool API

<!-- tool-facts -->

## Next

- [Station DB (NAMES.GP)](station-db.md): where `whois` gets its answer.
- [The sandbox API](../write/sandbox-api.md#register): remote commands.
