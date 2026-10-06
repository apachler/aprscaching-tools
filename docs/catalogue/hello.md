# Hello tool

The hello tool is the smallest example of each thing a tool can add: a command, a monitor colour rule, a panel and a
decoder. It is for tool authors who want to see the whole API surface in one short script.

## What it does

- `/hello [name]` answers `Hello <name> from the imported hello-tool!`, or `Hello world …` without a name.
- A colour rule tints stations with an `OE` prefix in the packet monitor, with the `--st-user` token.
- A panel shows a line of text and a `sandboxed` badge.
- A **ROT13** decoder in **Tools → Decode** rotates letters by 13.

It reaches nothing outside its sandbox. Its manifest name is `hello-tool`; its folder is `tools/hello/`.

## Permissions

| Permission | Why |
|---|---|
| `command` | Registers `/hello` |
| `monitor` | Adds the monitor colour rule |
| `panel` | Shows the panel |
| `decoder` | Adds the ROT13 decoder |

## Version and tool API

<!-- tool-facts -->

## Next

- [Write your first tool](../write/first-tool.md): build a tool of your own.
- [The sandbox API](../write/sandbox-api.md): every call the hello tool makes.
