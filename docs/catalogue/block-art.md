# Block art (GIP)

Block art shows CP437 and ANSI art as a panel of coloured block cells, the graphics of Graphic Packet (GIP). It is
for operators who exchange ANSI art over packet, and for tool authors who want to show a picture from their own
tool.

## What it does

The panel draws a grid of characters, each in one of the 16 ANSI colours. Other tools may push a picture by
publishing `render.blocks` on the tool bus, as `{ text }` or as a `{ cols, cells }` grid; the tool checks it
before it shows it.

## Use it

| Command | Does |
|---|---|
| `/art <text>` | Draws the text; `\n` breaks a line |
| `/art` | Shows the sample |

For example, `/art AB\nCD` draws two rows of two cells and answers `Rendered.`

## Permissions

| Permission | Why |
|---|---|
| `command` | Registers `/art` |
| `panel` | Shows the art |
| `ipc` | Reads `render.blocks` from other tools |

## Version and tool API

<!-- tool-facts -->

## Next

- [The tool bus](../write/tool-bus.md#the-names-in-use): `render.blocks`.
- [The sandbox API](../write/sandbox-api.md#panel-nodes): the `blocks` panel node.
