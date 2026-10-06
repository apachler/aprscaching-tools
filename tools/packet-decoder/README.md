# Packet decoder

Paste a raw TNC2 monitor line or an APRS-IS line and see every field it carries: the AX.25 header, how the line arrived (heard on RF or entered over APRS-IS, with the IGate), the packet type and each APRS field. It runs the same parser the APRScaching gateway ingests with, so it decodes offline.

## Use it

- In **Tools → Decode**, pick **APRS packet**, paste a line (or **Use a sample**) and choose **Decode**. The decoder answers with a summary; the **Packet decoder** panel shows the fields.

It shows on: web.

## Permissions

| Permission | Why |
|---|---|
| `decoder` | Adds the **APRS packet** decoder |
| `panel` | Shows the decoded fields |

## Source

`src/index.js` is the source. `tool.js` is built from it, from `lib/` and from the MIT libraries of the APRScaching
repository at the commit `lib.lock` pins (`node scripts/build.mjs`); CI checks that the committed `tool.js` matches a
fresh build.

## Signature

Signed by OE8APR's author key, the key in `tool.json`'s `pubkey`. The maintainer signs it again at each release that
changes it, and the registry lists it with that key.

## Licence

MIT, as the `SPDX-License-Identifier` line in each file states.
