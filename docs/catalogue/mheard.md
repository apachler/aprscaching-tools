# MHeard

MHeard lists the stations heard most recently, from every source. It is for operators who want to see who is on
the air at a glance.

## What it does

The panel shows the 14 stations heard last, newest first. Each row names the station, where it was heard (`RF` from
the packet terminal, `APRS` from the map's live stations) and how long ago. The tool keeps the last 500 stations
and refreshes the ages once a minute.

## Use it

1. Install MHeard and switch it on.
2. Open the packet terminal, or switch on **Live stations** on the map.

The panel fills as frames arrive. It shows in the Tools app and the packet terminal.

## Permissions

| Permission | Why |
|---|---|
| `monitor` | Hears the frames it lists |
| `event` | Refreshes the ages on the minute tick |
| `panel` | Shows the list |

## Version and tool API

<!-- tool-facts -->

## Next

- [Watch & alert](watch-alert.md): follow chosen callsigns.
- [The sandbox API](../write/sandbox-api.md#events): the `on_frame` and `on_tick` events it uses.
