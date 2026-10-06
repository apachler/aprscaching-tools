# Hello tool

An example signed tool. It shows each kind of contribution a tool makes across the sandbox bridge:

- the `/hello [name]` command;
- a colour rule that tints stations with an `OE` prefix in the monitor;
- a small panel;
- a ROT13 text decoder.

It reaches nothing outside its sandbox.

## Permissions

| Permission | Why |
|---|---|
| `command` | Registers `/hello` |
| `monitor` | Adds the monitor colour rule |
| `panel` | Shows the panel |
| `decoder` | Adds the ROT13 decoder |

## Signature

Signed by `uibFUCjcBnxAe8mRQ1v2neJd0fPV_7Vs0Y59K5vH5Oc` (OE8APR).

## Licence

AGPL-3.0-or-later, as the `SPDX-License-Identifier` line in `tool.js` states.
