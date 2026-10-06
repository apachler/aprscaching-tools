# Watch & alert

Watch & alert follows the callsigns you name. When a watched station is heard, the panel records when, and its lines
in the packet monitor turn the warning colour.

## What it does

The tool hears every frame from the packet terminal and the map's live stations. Watching a base call (`OE8APR`)
catches every SSID of it; watching `OE8APR-9` catches that station only. The panel lists each watched call and when
it was last heard.

## Use it

| Command | Does |
|---|---|
| `/watch <call>` | Watch a callsign |
| `/watch` | List the watched callsigns |
| `/unwatch <call>` | Stop watching it |

For example, `/watch OE8APR` answers `Watching OE8APR.`; from then on the panel shows when any SSID of it, such as
`OE8APR-9`, was last heard.

## Permissions

| Permission | Why |
|---|---|
| `command` | Registers `/watch` and `/unwatch` |
| `monitor` | Hears the frames it checks, and colours the watched stations' lines |
| `panel` | Shows the watched calls and when each was last heard |

## Version and tool API

<!-- tool-facts -->

## Next

- [Connect bell](connect-bell.md): a notice when a station connects to you.
- [The sandbox API](../write/sandbox-api.md#colour-rules): how a tool colours the monitor.
