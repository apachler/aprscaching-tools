# Away note

Away note tells a station that connects to your packet terminal that you are away, and lets it leave a short note. It is for operators who keep
a session open while they step away. It is not a mailbox.

## What it does

While you are away, a station that connects to your packet terminal reads your away message and `Leave a note with:  NOTE <text>`. The
tool keeps at most 20 notes of 120 characters each, in this page only; they end when the page closes.

## Use it

| Command | Who | Does |
|---|---|---|
| `/away [message]` | you | Sets you away, with a message of up to 160 characters. Without one it keeps the last message, `Operator is away.` at first |
| `/away off` | you | Sets you back |
| `/notes` | you | Reads the notes |
| `note <text>` | a connected station | Leaves a note; it answers `Note saved - 73!` |

`note` is open to connected stations; `/away` and `/notes` are yours alone.

## Permissions

| Permission | Why |
|---|---|
| `command` | Registers `note`, `/away` and `/notes` |
| `event` | Hears `on_connect` to greet a peer while you are away |
| `panel` | Shows whether you are away and the latest notes |

## Version and tool API

<!-- tool-facts -->

## Next

- [Info / menu responder](info-responder.md): answer a station's INFO, MENU and WHOIS.
- [The sandbox API](../write/sandbox-api.md#register): how a command opens to remote stations.
