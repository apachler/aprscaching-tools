# Auto-responder

The auto-responder greets a station that connects to you, the way a personal mailbox (PMS) does. It is for operators
who run the packet terminal, the BBS or the node.

## What it does

When a station connects, the tool answers through the session's reply:

```text
Welcome <call> - this is <your call> auto-responder. Type H for help.
```

The reply travels through the connected surface, under that surface's transmit gate.

## Use it

Install the auto-responder and switch it on. It answers every connect while it runs.

## Permissions

| Permission | Why |
|---|---|
| `event` | Hears `on_connect` and answers through the session's reply |

## Version and tool API

<!-- tool-facts -->

## Next

- [Away note](away-note.md): an away message, and a note the station can leave.
- [The sandbox API](../write/sandbox-api.md#events): events and `payload.reply`.
