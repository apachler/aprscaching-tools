# Monitor colouriser

The monitor colouriser colours the packet terminal's monitor by station type. It is for operators who read busy
traffic and want BBSes, nodes and digipeaters to stand out.

## What it does

The tool classifies every station it hears with the NAMES.GP rules (BBS, node, digipeater, DX cluster, weather,
IGate and more) and colours that station's lines with the type's colour token, such as `--st-bbs`. The app's theme
decides the actual colours.

It publishes one colour rule per heard station, at most once a second, so a station takes its colour from the first
frame the tool classified. It keeps the last 2000 stations.

## Use it

1. Install the monitor colouriser and switch it on.
2. Open the packet terminal.

Lines colour as stations are heard, from the terminal's radio and from the map's live stations.

## Permissions

| Permission | Why |
|---|---|
| `monitor` | Hears the frames it classifies, and sets the colour rules the monitor draws |

## Version and tool API

<!-- tool-facts -->

## Next

- [Station DB (NAMES.GP)](station-db.md): the same classification, shared with other tools.
- [The sandbox API](../write/sandbox-api.md#colour-rules): colour rules and the station tokens.
