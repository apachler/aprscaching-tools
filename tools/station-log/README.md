# Station log

Lists the stations the built-in Station DB tool announces on the tool bus, and answers two commands:

- `/seen`: the stations heard, newest first, with their type and source;
- `/whois <call>`: asks the Station DB tool for the station's type and shows the answer in the panel.

## Permissions

| Permission | Why |
|---|---|
| `command` | Registers `/seen` and `/whois` |
| `panel` | Shows the station list |
| `ipc` | Subscribes to the Station DB tool's announcements and calls its `station.type` service |

## Try it locally

`serve.mjs` serves this directory with an open CORS header, so a local app imports the tool from
`http://127.0.0.1:8790/tool.json`:

```bash
node tools/station-log/serve.mjs
```

## Signature

Unsigned. The registry lists it once the author signs `tool.json`.

## Licence

MIT, as the `SPDX-License-Identifier` line in each file states.
