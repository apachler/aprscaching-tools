# Station DB (NAMES.GP)

Station DB classifies every station it hears and shares that with your other tools. It shows nothing itself: tools
such as Station log and the info responder read it over the tool bus.

## What it does

For every heard frame, the tool works out the station's type with the NAMES.GP rules and:

- publishes `station.seen` with `{ call, type, source }`, where `source` is `RF` from the packet terminal or `APRS`
  from the map's live stations;
- answers the `station.type` service with a heard station's type, or `""` for one it has not heard.

It keeps the last 5000 stations.

## Use it

Install Station DB and switch it on, then install a tool that reads it, such as [Station log](station-log.md) or
the [Info / menu responder](info-responder.md).

## Permissions

| Permission | Why |
|---|---|
| `monitor` | Hears the frames it classifies |
| `ipc` | Publishes `station.seen` and provides `station.type` on the bus |

## Version and tool API

<!-- tool-facts -->

## Next

- [The tool bus](../write/tool-bus.md): `station.seen`, `station.type` and the other names.
- [Station log](station-log.md): a tool that reads it.
