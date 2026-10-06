# CTEXT macro pack

The CTEXT macro pack expands three commands into canned text for the packet terminal and the BBS. It is for
operators who type the same greetings in every QSO.

## What it does

Each command answers with its text. The surface that sends the text fills in `{call}` with your callsign and
`{grid}` with your locator.

## Use it

| Command | Text |
|---|---|
| `/cq` | `CQ CQ CQ de {call} k` |
| `/73` | `73 es gud dx de {call}` |
| `/qth` | `QTH is {grid}` |

The macros are yours alone: a connected station cannot run them.

## Permissions

| Permission | Why |
|---|---|
| `command` | Registers `/cq`, `/73` and `/qth` |

## Version and tool API

<!-- tool-facts -->

## Next

- [Tool catalogue](index.md): the other utilities.
- [The sandbox API](../write/sandbox-api.md#register): how a tool registers commands.
