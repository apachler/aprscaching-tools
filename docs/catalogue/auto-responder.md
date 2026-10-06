# Auto-responder

The auto-responder greets a station that connects to your packet terminal, the way a personal mailbox (PMS) does. It
is for operators who keep the packet terminal open. The BBS and node sessions run on the ingest box, where tools do
not run.

## What it does

When a station connects to your packet terminal, the tool answers through the session's reply:

```text
Welcome <call> - this is <your call> auto-responder. Type H for help.
```

The reply travels through the packet terminal, under its transmit gate. A session you opened offers no reply, so
the tool greets only stations that connect to you.

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
