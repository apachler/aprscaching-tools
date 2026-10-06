# 7PLUS reassembler

The 7PLUS reassembler reads 7PLUS parts and says which file they belong to and which parts are missing. It is for
operators who collect binary files from a packet BBS.

## What it does

7PLUS is the packet-BBS way to move a binary file as 7-bit text, split across numbered messages. The decoder finds
the `go_7+.` and `stop_7+` markers and every part header in what you paste, either `go_7+. 001 of 003 NAME` or
`part N of M`, and reports the file name, the parts found and the parts still missing. It does not rebuild the
binary file.

## Use it

1. In **Tools → Decode**, pick **7PLUS**.
2. Paste one or more parts as the BBS shows them.
3. Select **Decode**.

The answer names the file, the parts it found and the parts still missing, such as `status: incomplete — missing
part(s) 2, 3`. Once every part is there and each ends in its `stop_7+` line, it reads `status: complete`.

## Permissions

| Permission | Why |
|---|---|
| `decoder` | Adds the **7PLUS** decoder |

## Version and tool API

<!-- tool-facts -->

## Next

- [Tool catalogue](index.md): the other decoders.
- [Build with the shared libraries](../write/build.md): where its parser lives (`lib/sevenplus.js`).
