# API changelog

This page lists each version of the tool API and of the registry format, and which APRScaching releases implement
them. It is for tool authors choosing the `api` to declare, and for sysops checking what their instance runs.

## App releases and versions

| APRScaching | Tool API | Registry format | Project registry tags |
|---|---|---|---|
| 1.0 | 1.0 | 1 | `v1.x.y` |

Each APRScaching release bundles one `v1.x.y` tag of the project registry. Any 1.x instance may add a newer tag by
address, as long as its tools declare a tool API the instance implements.

## Tool API 1.0

Implemented by APRScaching 1.0. The first version of the tool API.

- **Manifest**: `name`, `title`, `author`, `version`, `api`, `permissions`, `surfaces`, `remote`, `description`,
  `entry`, `entrySha256`, `connect`, `pubkey`, `signature`.
- **Capabilities**: `command`, `monitor`, `event`, `decoder`, `panel`, `map`, `ipc`, `network`, `beacon`, `tx`;
  `geo` is reserved, with no API.
- **Surfaces**: `web`, `terminal`, `bbs`, `node`, `map`.
- **Script API**: `register({ commands, colourRules, panel, decoders })`; `tool.permissions`, `tool.api`,
  `tool.has()`, `tool.log()`, `tool.setPanel()`, `tool.setMapLayer()`, `tool.setColourRules()`, `tool.on()`,
  `tool.requestTx()`, `tool.scheduleBeacon()`; the bus methods `emit`, `subscribe`, `call` and `provide`.
- **Events**: `on_frame`, `on_tick`, `on_connect`, `on_disconnect`; `on_beacon`, `on_find` and `on_spot` reserved.
- **Feature names** for `tool.has()`: `commands.async`, `commands.remote`, `decoders.sample`, `events.reply`,
  `colours.src`, `bus.provide`.
- **Bus names**: `station.seen`, `station.type`, `render.blocks`, `session.progress`, `session.script`,
  `link.ping.request`, `link.rtt`; the `session.` and `host.` prefixes are the app's.
- **Transmit**: APRS status and messages only; one transmission a minute and six an hour per tool.
- **Limits**: as [Limits and budgets](../write/limits.md) lists them.

## Registry format 1

Read by APRScaching 1.0. `{ format, entries, authority, sig }`, with the authority's Ed25519 signature over
`{ format, entries }` serialised with object keys sorted ([The registry file](../publish/registry-file.md)).

## How an entry reads

Each later version gets a section of its own, newest first, under these headings:

- **Added**: what is new, with each feature name for `tool.has()`.
- **Deprecated**: what a coming major removes or changes, and its replacement.
- **Narrowed for safety**: a limit a tool now meets, and how the app shows it.
- **Removed**: in a new major only.

## Next

- [Versions and compatibility](index.md): the rules behind these versions.
- [The sandbox API](../write/sandbox-api.md): tool API 1.0 in full.
