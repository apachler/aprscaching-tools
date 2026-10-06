# The tool bus

The tool bus carries messages between a player's tools and between a tool and the app: topics to publish and
subscribe to, and services to call. This page lists the bus methods, the rules every message follows, and the
names the app and the project's tools use. It is for tool authors whose tool works with another.

## The methods

The bus methods need `ipc`. They are on `tool`, and on `ipc`, which is `undefined` unless the tool holds `ipc`.

| Method | Content |
|---|---|
| `emit(topic, data)` | Publish `data` on `topic` to every subscriber. Subscribers see the tool's manifest `name` as the sender. |
| `subscribe(topic, cb)` | Call `cb(data, from)` for each message on `topic`. There is no unsubscribe; the subscription ends when the tool is switched off. |
| `call(name, args)` | Call the service `name`. Returns a `Promise` of its answer, which is `undefined` when nobody offers it. The promise rejects when the service needs a capability the tool does not hold, when it fails, or when it does not answer in 10 seconds. |
| `provide(name, fn)` | Offer the service `name`: `fn(args)` returns the answer or a `Promise` of it. |
| `ipc.setPanel(spec)` | Replace the tool's panel. Needs `panel` as well. |

```js
// one tool offers a service and announces what it hears
tool.provide("qth.lookup", (call) => lookup(call));
tool.emit("qth.heard", { call: "OE8APR-9", grid: "JN76" });

// another tool listens and asks
tool.subscribe("qth.heard", (data, from) => tool.log(`${from}: ${data.call} in ${data.grid}`));
const grid = await tool.call("qth.lookup", "OE8APR-9");
```

## The rules

- **Plain JSON.** Every payload a tool sends on the bus (`emit` data, `call` arguments, a service's answer) travels
  as plain JSON. A value JSON cannot hold refuses the message, and one JSON writes differently (a `Date`, a `Map`)
  arrives in its JSON form.
- **Names.** Topic and service names are cut to 64 characters, and an empty one is refused.
- **Depth.** The app stops a chain of messages that nests deeper than 16.
- **Senders.** The sender a subscriber receives is the emitting tool's manifest `name`; the app itself sends as
  `(host)`. A player cannot install a second tool under a name an installed tool already has, so the name
  identifies the tool.
- **No takeover.** `provide` is refused for a name another tool or the app holds. Names and topics that start with
  `session.`, `host.` or `link.` are the app's alone: a tool may call them or listen to them, never provide or publish
  them, except `link.ping.request`, the one request a tool may publish.
- **Transmitting services need `tx`.** A service that makes the radio transmit needs `tx` as well as `ipc`. A call
  from a tool without `tx` is refused with `service "<name>" needs the 'tx' permission, which <tool> does not hold`,
  and the service does not run. Holding `tx` does not open the transmit gate: the packet terminal still transmits
  only while the player's callsign is control-verified, with its own consent.
- **Limits.** A tool holds at most 16 services and 32 topics ([Limits and budgets](limits.md)).

Name your own topics and services after your tool, such as `my-tool.result`, so they do not meet another tool's.

## The names in use

| Name | Kind | Offered by | Needs | Payload |
|---|---|---|---|---|
| `station.seen` | topic | [Station DB (NAMES.GP)](../catalogue/station-db.md), while it is on | `ipc` | `{ call, type, source }` for each heard station: `source` is `RF` from the packet terminal or `APRS` from the map's live stations |
| `station.type` | service | [Station DB (NAMES.GP)](../catalogue/station-db.md), while it is on | `ipc` | Takes a callsign; answers its station type, or `""` when it has not heard it |
| `render.blocks` | topic | listened to by [Block art (GIP)](../catalogue/block-art.md) | `ipc` | `{ text }`, or `{ cols, cells }` as in a `blocks` panel node |
| `session.progress` | topic | the packet terminal, while a TNC is open | `ipc` | The state of a running session script: `{ status, step, total, captured, note }` |
| `session.script` | service | the packet terminal, while a TNC is open | `ipc` and `tx` | Takes `{ steps }`, a connected-mode script ([below](#sessionscript)); answers `{ ok: true }` |
| `link.ping.request` | topic | published by [Link ping (RTT)](../catalogue/link-ping.md)'s `/ping`; listened to by the packet terminal while a TNC is open | `ipc` | `{}`. The terminal sends one poll on the channel in view, under its transmit gate and at most one every 10 s; the answer arrives on `link.rtt` |
| `link.rtt` | topic | the packet terminal, while a TNC is open; listened to by [Link ping (RTT)](../catalogue/link-ping.md) | `ipc` | `{ ms, kind, peerCall, channel, surface }`: the round trip in milliseconds, from a frame's acknowledgement (`kind: "ack"`) or a poll (`"poll"`) |

### `session.script`

The packet terminal runs a connected-mode script for a tool: at most 20 steps, `connect` first, then `send`,
`waitfor`, `wait` and `disconnect`, each one line.

```js
await tool.call("session.script", {
  steps: [
    { op: "connect", call: "HB9W-8" },
    { op: "waitfor", text: "Cluster", timeoutSec: 30 },
    { op: "send", text: "sh/dx" },
    { op: "wait", sec: 5 },
    { op: "disconnect" },
  ],
});
```

One script runs at a time. Each one draws on the calling tool's
[transmit budget](limits.md#the-transmit-budget): one transmission for each `connect` and one more for each five
`send` steps. A new script closes the channel the last one held, and switching the calling tool off or removing it
cancels its script. Progress arrives on `session.progress`.

## Next

- [The sandbox API](sandbox-api.md): the rest of what a script can call.
- [Station DB (NAMES.GP)](../catalogue/station-db.md): the tool most others listen to.
