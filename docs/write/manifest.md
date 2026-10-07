# The manifest

This page lists every field of `tool.json`, the manifest a tool ships beside its script. It is for tool authors who
write or check a manifest.

## What a tool ships

| File | Content |
|---|---|
| `tool.json` | The manifest. The player installs a tool by this file's address. |
| The entry script | The JavaScript the sandbox runs, named by the manifest's `entry` (`tool.js` when left out), relative to the manifest's address. Its SHA-256 is pinned in the signed manifest as `entrySha256`. |

The app fetches both without cookies. A tool listed in a registry the instance carries reaches the browser through
the instance instead ([How registries work](../publish/index.md#fetched-through-the-instance)). When the browser
fetches from another origin than the app's, the server must answer with an `Access-Control-Allow-Origin` header
that allows it; `*` does.

## An example

```json
{
  "name": "auto-status",
  "title": "Auto-status",
  "author": "OE8APR",
  "version": "1.1.1",
  "api": "1.0",
  "permissions": ["command", "event", "tx"],
  "surfaces": ["terminal"],
  "description": "/autostatus <min> <text> — periodically transmit a status (TX-gated).",
  "entry": "tool.js",
  "entrySha256": "<44 characters of base64>",
  "pubkey": "<the author's Ed25519 public key, base64url>",
  "signature": "<base64>"
}
```

## Fields

The app's validator (`validateManifest()` in the `@aprscaching/tools` package) checks the manifest and normalises
it. An install stops on the first error it reports.

| Field | Type | Required | Rule | Error when it fails |
|---|---|---|---|---|
| `name` | string | yes | 2 to 40 characters of `a-z`, `0-9` and `-`, starting with a letter or digit. The tool's identity. | `invalid name (lowercase, 2–40 chars, [a-z0-9-])` |
| `title` | string | yes | Not blank; trimmed. The label players see. | `title required` |
| `author` | string | yes | Not blank; trimmed and upper-cased. The author's callsign. | `author (callsign) required` |
| `version` | string | yes | Not blank; trimmed. Free text, for example `1.0.0`. | `version required` |
| `api` | string | yes | The [tool API version](../api/index.md) the tool needs, `MAJOR.MINOR`, for example `1.0`. | `api must name the tool API version the tool needs, as "MAJOR.MINOR"` |
| `permissions` | string array | yes | Each one a [capability](#permissions); duplicates dropped. `[]` is allowed. | `permissions must be a list of known capabilities` |
| `surfaces` | string array | no | Each one a [surface](#surfaces); duplicates dropped; `["web"]` when left out or empty. | `surfaces must be a list of known surfaces (web/terminal/bbs/node/map)` |
| `remote` | boolean | no | `true` lets stations connected to the player's packet terminal run the commands the script opens to them. Any other value counts as not set. | none |
| `description` | string | no | One line for the registry and the install prompt. Any other type is dropped. | none |
| `entry` | string | no | The script's address or path, resolved against the manifest's address. | `entry must be a string URL/path` |
| `entrySha256` | string | to install | The SHA-256 of the exact bytes `entry` serves, base64 (44 characters). `sign.mjs` sets it. | `entrySha256 must be the base64 SHA-256 of the entry script` |
| `connect` | string array | with `network` | At most 8 `https://` or `wss://` origins, with no path, query, fragment or credentials; normalised to `scheme://host[:port]`. | `connect must be a list of at most 8 origins`, `connect entries must be https:// or wss:// origins, without a path` |
| `pubkey` | string | to install | The author's raw Ed25519 public key, base64url. | `pubkey must be a base64url string` |
| `signature` | string | to install | A detached Ed25519 signature, base64, over the [signing bytes](sign.md#what-the-signature-covers). | none |

A tool that asks for `network` without a `connect` list fails with `a tool asking for network lists the origins it
reaches in connect`. Fields the validator does not know are dropped.

### `api`

`api` names the lowest tool API the tool needs. The app installs and starts a tool whose `api` has the app's major
and a minor no higher than the app's; any other tool is refused with the reason, such as `it needs tool API 1.1;
this instance implements 1.0`. Declare the lowest minor whose features the tool needs, and check a newer optional
feature with `tool.has()` ([Tool API versions](../api/index.md)).

### `entrySha256`

The signature covers `entrySha256`, so it covers the script's bytes too. After the install prompt the app fetches the
script, hashes it and runs it only when the hash matches. Whoever serves the script, the author's server, a mirror
or the instance carrying a registry, cannot change it without the tool being refused. Sign again after every change
to the script.

### `connect`

`connect` lists the origins a tool with `network` may reach, and nothing else: the sandbox's Content-Security-Policy
names exactly these origins. A request leaves with `Origin: null` and none of the player's cookies, so the server
answers with `Access-Control-Allow-Origin: *` (or `null`) for the tool to read the response. The app's own page and
API origins are always taken out of the list, so a tool never reaches the app's API. The install prompt shows each
origin under **connects to**.

### `remote`

A command is the operator's alone. It opens to connected stations only when the manifest says `"remote": true` and
the script registers the command as `{ run, remote: true }` ([The sandbox API](sandbox-api.md#register)). Connected
stations are the stations that connect to the player's packet terminal; nothing runs from a session the player
opened. The install prompt says when a tool takes commands from connected stations.

## Permissions

The player approves a tool's `permissions` as a whole in the install prompt. A tool reaches a capability only through
the [sandbox API](sandbox-api.md); the app checks the grant on every request the sandbox relays, whatever the script
does inside its worker.

| Capability | What the tool gets | What the player reads |
|---|---|---|
| `command` | `register({ commands })`, run from **Run a tool command**, the terminal and the BBS | Answer `/commands` you type |
| `monitor` | `tool.on("on_frame")` and colour rules | Read the frames your radio hears, and colour or hide monitor lines |
| `event` | `tool.on()` for the other events, with a reply to a connected session | React when a station connects or a minute passes |
| `decoder` | `register({ decoders })`, run from **Decode** | Add a decoder |
| `panel` | `register({ panel })`, `tool.setPanel()` | Show a small panel |
| `map` | `tool.setMapLayer()` | Put markers on the map |
| `ipc` | The [tool bus](tool-bus.md) | Talk to other tools you run |
| `network` | `fetch`, `XMLHttpRequest`, `WebSocket` and `EventSource`, to the `connect` origins only | Reach the addresses listed under **connects to** |
| `beacon` | `tool.scheduleBeacon()`, behind the transmit gate | Schedule a beacon under your callsign |
| `tx` | `tool.requestTx()`, behind the transmit gate, and the bus services that transmit | Ask to transmit under your callsign |
| `geo` | Reserved: no API in tool API 1.0 | Read your device's location |

`tx`, `beacon`, `network` and `geo` are the gated ones: the prompt marks them, and a reviewer asks why a tool needs
them. No capability lets a tool change how finds are verified.

## Surfaces

`surfaces` says where a tool's panel, colour rules and map layer appear. Commands and decoders appear in the Tools
app whatever the surfaces.

| Surface | Where |
|---|---|
| `web` | The **Tools** app |
| `terminal` | The packet terminal: its monitor colours and its panels |
| `bbs` | The BBS |
| `node` | The NET/ROM node console |
| `map` | The map: the tool's map layer |

## Versions and identity

`version` is free text that the app shows and never compares. A tool's identity is its `name`: the app refuses a
second tool under a name an installed tool from another address already has. A changed `version` is part of the
signed manifest, so a new version is signed again. An installed tool runs the version its address serves at the
next start, as long as the recorded author key signed it and it asks for no permission, origin or remote use beyond
what the player approved.

## Next

- [The sandbox API](sandbox-api.md): what the script does with these permissions.
- [Sign a tool](sign.md): `entrySha256`, `pubkey` and `signature`.
