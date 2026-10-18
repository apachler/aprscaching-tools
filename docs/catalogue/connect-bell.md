# Connect bell

The connect bell tells you when a session opens in your packet terminal: a station connecting to you, or you
connecting to a station. It is for operators who leave the packet terminal open in a tab. The BBS and node sessions
run on the ingest box, where tools do not run.

## What it does

On every connect another station opens to yours, the tool writes `*ring* <call> connected` to the tool log and shows the last connect, with its UTC time, in its panel. Your own outgoing connects stay quiet.
It pairs with [Watch & alert](watch-alert.md), which follows stations heard rather than connected.

## Use it

Install the connect bell and switch it on. The panel reads `Waiting for a connect...` until a station connects.

## Permissions

| Permission | Why |
|---|---|
| `event` | Hears `on_connect` |
| `panel` | Shows the last connect |

## Version and tool API

<!-- tool-facts -->

## Next

- [Auto-responder](auto-responder.md): greet the station that connects.
- [The sandbox API](../write/sandbox-api.md#events): the connect events.
