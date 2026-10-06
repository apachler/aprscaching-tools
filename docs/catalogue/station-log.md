# Station log

Station log lists the stations Station DB hears and answers `/seen` and `/whois`. It is also the example the
[first-tool tutorial](../write/first-tool.md) starts from.

## What it does

The tool subscribes to Station DB's `station.seen` messages and keeps the ten newest stations in its panel, with
their type and source. `/whois` asks Station DB's `station.type` service; the answer arrives later, so it shows in
the panel.

## Use it

1. Install [Station DB (NAMES.GP)](station-db.md) and Station log, and switch both on.
2. Open the packet terminal, or switch on **Live stations** on the map.

| Command | Does |
|---|---|
| `/seen` | The ten stations heard most recently, newest first, with type and source |
| `/whois <call>` | Asks Station DB for the station's type; the panel shows it, or `not heard` |

For example, `/whois OE6XRR-9` answers `Asked Station DB about OE6XRR-9; the answer shows in the panel.`

## Permissions

| Permission | Why |
|---|---|
| `command` | Registers `/seen` and `/whois` |
| `panel` | Shows the station list |
| `ipc` | Subscribes to the Station DB tool's announcements and calls its `station.type` service |

## Version and tool API

<!-- tool-facts -->

## Next

- [Write your first tool](../write/first-tool.md): build your own copy of this tool.
- [The tool bus](../write/tool-bus.md): how it talks to Station DB.
