# The sandbox API

This page lists everything a tool's script can call: `register`, `tool` and `ipc`, the events, transmitting, colour
rules, panels, the map layer, decoders and commands. It is for tool authors; it describes **tool API 1.0**. The
numbers a call is held to are in [Limits and budgets](limits.md).

## The script

The sandbox runs the entry script as the body of a function with three parameters, `register`, `ipc` and `tool`,
inside a Web Worker:

```js
// what the sandbox does with your script
new Function("register", "ipc", "tool", script)(register, ipc, tool);
```

The script is a classic script: `import` and `export` are syntax errors, and so is a top-level `await`. Bundle any
library into the one file; [Build with the shared libraries](build.md) shows how. The worker has no DOM: a tool
shows itself only through panels, colour rules, its map layer and command output.

Timers (`setTimeout`, `setInterval`) and promises work inside the worker. A tool that keeps state keeps it in its
own variables; it lasts while the tool runs.

## `register`

The script calls `register()` while it runs. What it registered by the time the script returns is what the app
reads. A later call replaces the commands, colour rules and decoders inside the worker, but the app keeps the lists
it read at load; `tool.setPanel()` and `tool.setColourRules()` change the others later.

```js
register({
  commands: { hello: (args) => [`Hello ${args || "world"}`] },
  colourRules: [{ srcPrefix: "OE", colorVar: "--st-user" }],
  panel: { title: "Hello", nodes: [{ kind: "badge", text: "ready", tone: "ok" }] },
  decoders: [{ id: "rot13", label: "ROT13", kind: "text", decode: (s) => rot13(s) }],
});
```

| Field | Type | Needs | Content |
|---|---|---|---|
| `commands` | `{ [word]: handler \| { run: handler, remote?: true } }` | `command` | One handler per `/word` ([Commands](#commands)) |
| `colourRules` | `ColourRule[]` | `monitor` | Recolour or hide monitor lines ([Colour rules](#colour-rules)) |
| `panel` | `PanelSpec` | `panel` | The tool's first panel ([Panel nodes](#panel-nodes)) |
| `decoders` | `Decoder[]` | `decoder` | Text decoders the **Decode** box offers ([Decoders](#decoders)) |

A handler that throws or rejects answers `error: <message>`. A command the tool does not have answers
`no such command`; a decoder it does not have answers `no such decoder`.

### Commands

`handler(args)` receives the text after the word, as a string, and returns a string, a string array, or a `Promise`
of one. Its value becomes the output lines. Words match without regard to case: `/WHOIS OE8APR` calls
`commands.whois("OE8APR")`.

A command is the operator's alone. To let a connected station run it, register it as `{ run: handler, remote: true }`
and set `"remote": true` in the manifest. A station connected to the packet terminal then types the word without the
slash, on a session it opened; the line is read up to its 256th character. The surface's own commands win over a
tool's. Up to 4 lines of output go back under the terminal's transmit gate. Commands run in order, with at most 4
waiting per session; nothing runs from the far end of a session the player opened:

```js
register({
  commands: {
    note: { remote: true, run: (args) => saveNote(args) }, // a connected station may run it
    notes: () => listNotes(), // the operator's alone
  },
});
```

### Decoders

A decoder is `{ id, label, kind, decode, sample?, placeholder? }`. `decode(input)` returns a string, or a `Promise`
of one. `sample` is a line the **Use a sample** button fills in; `placeholder` shows in the empty box.

```js
register({
  decoders: [
    {
      id: "aprs",
      label: "APRS packet",
      kind: "aprs",
      decode: (line) => summarise(line),
      sample: "OE8APR-9>APRS,WIDE1-1:!4704.41N/01526.27E>",
      placeholder: "Paste a TNC2 line",
    },
  ],
});
```

## `tool`

`tool` is always there. Each method checks its permission inside the worker and throws `permission '<name>' not
granted` without it; the app checks again on its side.

| Member | Needs | Content |
|---|---|---|
| `tool.permissions` | | The capabilities the player granted, as a string array |
| `tool.api` | | The tool API the instance implements, `{ major, minor }` |
| `tool.has(name)` | | Whether the instance offers a capability or a feature ([below](#toolapi-and-toolhas)) |
| `tool.log(message)` | | A line in the app's tool log |
| `tool.setPanel(spec)` | `panel` | Replace the tool's panel |
| `tool.setMapLayer(spec)` | `map` | Replace the tool's map layer ([The map layer](#the-map-layer)) |
| `tool.setColourRules(rules)` | `monitor` | Replace the colour rules |
| `tool.on(event, handler)` | `monitor` for `on_frame`, `event` for the others | Call `handler(payload)` for each [event](#events) |
| `tool.requestTx(info)` | `tx` | Transmit one APRS status or message ([Transmit and beacons](#transmit-and-beacons)) |
| `tool.scheduleBeacon(spec)` | `beacon` | Set or end the tool's beacon |
| `tool.emit`, `tool.subscribe`, `tool.call`, `tool.provide` | `ipc` | The [tool bus](tool-bus.md) |

## `ipc`

`ipc` holds the bus methods `emit`, `subscribe`, `call` and `provide`, and `setPanel`. It is `undefined` unless
the tool holds `ipc`, so a script can test it:

```js
if (ipc) ipc.subscribe("station.seen", (data, from) => remember(data));
```

The same bus methods are on `tool`. [The tool bus](tool-bus.md) documents them and the names in use.

## `tool.api` and `tool.has`

`tool.api` is the tool API the instance implements, such as `{ major: 1, minor: 0 }`. `tool.has(name)` answers
whether the instance offers a capability or a named feature. A tool declares the lowest `api` it needs in its
manifest and checks anything newer with `tool.has()` before it uses it:

```js
if (tool.has("events.reply")) {
  tool.on("on_connect", (p) => p.reply?.("Welcome"));
}
```

`tool.has()` answers about the instance, not about the tool's grant: `tool.permissions` says what the player granted.

| Name | Since | What it means |
|---|---|---|
| `command`, `monitor`, `event`, `decoder`, `panel`, `map`, `ipc`, `beacon`, `network`, `tx` | 1.0 | The capability has an API on this instance |
| `commands.async` | 1.0 | A command handler may return a `Promise` |
| `commands.remote` | 1.0 | Commands registered as `{ run, remote: true }` open to connected stations |
| `decoders.sample` | 1.0 | A decoder's `sample` and `placeholder` show in the **Decode** box |
| `events.reply` | 1.0 | `payload.reply(text)` answers a connected session |
| `colours.src` | 1.0 | Colour rules match an exact source callsign with `src` |
| `bus.provide` | 1.0 | A tool may offer a service with `provide()` |

`geo` has no API in tool API 1.0, so `tool.has("geo")` answers `false`.

## Events

`tool.on(event, handler)` asks the app to forward an event. The handler receives the payload the surface supplied:
the strings `surface`, `source`, `peerCall`, `myCall`, `direction`, `dst` and `text`, the number `channel`, and
`station` when it is plain data.

| Event | Needs | Raised by | Payload |
|---|---|---|---|
| `on_frame` | `monitor` | Every heard frame: the packet terminal (`source: "RF"`, with `dst` and `text`) and the map's live stations (`source: "APRS"`) | `peerCall` is the heard station |
| `on_tick` | `event` | The app, once a minute | none |
| `on_connect`, `on_disconnect` | `event` | The packet terminal, for each connected channel, both ways. The BBS and node sessions run on the ingest box, where tools do not run | `peerCall`, `myCall`, `channel`, `surface`, `direction` (`"incoming"` or `"outgoing"`), and `reply` on an incoming session |
| `on_beacon`, `on_find`, `on_spot` | `event` | Reserved for the surfaces that raise them | |

On a session another station opened, `payload.reply(text)` sends one line on it through the packet terminal, under
the terminal's transmit gate: a control-verified callsign and the tab's consent. A tool may send at most 4 lines of
256 characters within 2 minutes of the event. A refused reply is logged with the reason, and each line shows in
**Recent transmissions** under the tool's title. A session the player opened offers no `reply`:

```js
tool.on("on_connect", (p) => {
  p.reply?.(`Welcome ${p.peerCall} - this is ${p.myCall}.`);
});
```

## Transmit and beacons

A tool transmits only through the app's browser radio link, the way the app's own features do. Each transmission
needs:

- the `tx` permission (`beacon` for a beacon);
- the player's control-verified callsign, checked at every request;
- a transmit-capable radio connected in **Settings → My radio**, with the player's transmit consent for this tab. A
  tool never asks for that consent itself; without it, the transmission is held and the app says so.

The packet terminal's own TNC port is not a tool's to use, except through the `session.script` service on the
[tool bus](tool-bus.md#the-names-in-use).

### `tool.requestTx(info)`

`info` is one APRS information field, a status or a message:

| Kind | Form | Limit |
|---|---|---|
| Status | `>text` | 62 characters, not starting with a grid locator |
| Message | `:ADDRESSEE:text` or `:ADDRESSEE:text{id}` | An addressee of one word of printable ASCII, padded with spaces to nine characters; 67 characters of text plus the optional `{id}`; acknowledgements included |

The app refuses everything else: positions, objects, items, telemetry and its definitions (`PARM.`, `UNIT.`,
`EQNS.`, `BITS.`), bulletins and announcements (`BLN…`, `NWS…` and similar addressees), third-party traffic (`}`),
an empty field and more than one line. The install prompt says so: **May transmit status and messages under your
callsign**.

`requestTx()` returns a `Promise` of `true` once the radio sent the frame, and `false` when the gate, the
[budget](limits.md#the-transmit-budget) or the format held it. Every frame goes out from the callsign the consent
covers, to `APZACG` via `WIDE1-1`, shows in **Recent transmissions** under the tool's title and flashes the transmit
indicator.

```js
const sent = await tool.requestTx(">QRV on 144.800");
tool.log(sent ? "status sent" : "status held");
```

### `tool.scheduleBeacon(spec)`

`spec` is `{ comment, intervalSec }`, or `null` to end the beacon. The app transmits the comment as an APRS status
(`>comment`) at once and then every `intervalSec` seconds while the gate is open. It clamps the interval to 10
minutes through one day and the comment to one line of 62 characters. A tool has one beacon; a new
`scheduleBeacon()` replaces it. The `Promise` rejects with the reason when the gate is closed.

A beacon holds only under the consent and the callsign it was scheduled under. Switching the tool off, a disconnect,
an ended consent, a sign-out, or another callsign or SSID ends it, and the tool must schedule it again.

```js
await tool.scheduleBeacon({ comment: "OE8APR shack", intervalSec: 3600 });
```

## Colour rules

A colour rule recolours or hides lines in the packet monitor. A rule matches a line when every match field it sets
matches; a rule that sets none of them never matches. An exact `src` rule is checked first; then the first matching
rule of the others wins.

| Field | Match |
|---|---|
| `src` | The source callsign is this, ignoring case |
| `srcPrefix` | The source callsign starts with this, ignoring case |
| `dstPrefix` | The destination starts with this, ignoring case |
| `textIncludes` | The line's text contains this, case-sensitive |
| `colorVar` | The colour token to tag the line with, such as `--st-user`. A value that is not `--name` is ignored. |
| `hidden` | `true` hides the line |

The station tokens are `--st-bbs`, `--st-beacon`, `--st-cacher`, `--st-digi`, `--st-dx`, `--st-igate`, `--st-node`,
`--st-service`, `--st-user` and `--st-wx`; the status tokens `--ok`, `--warn` and `--bad` work too. The theme decides
the colours.

```js
tool.setColourRules([
  { src: "OE8APR-9", colorVar: "--warn" },
  { dstPrefix: "APRS", textIncludes: "TEST", hidden: true },
]);
```

## Panel nodes

A panel is `{ title?, nodes }`. The app renders it with its own elements and the theme's tokens; the tool never
touches the page. The app trims every panel to the limits below and drops a node of an unknown kind.

| Node | Fields | Limits |
|---|---|---|
| `text` | `text`, `tone?` | 240 characters |
| `kv` | `key`, `value`, `tone?` | key 60, value 240 characters |
| `badge` | `text`, `tone?` | 40 characters |
| `bar` | `label`, `value`, `max`, `tone?` | label 60 characters; numbers |
| `table` | `head: string[]`, `rows: string[][]` | 8 columns of 40 characters; 100 rows of 8 cells of 80 characters |
| `blocks` | `cols`, `cells: { ch, c? }[]` | `cols` 1 to 200; 4000 cells of one character; `c` an ANSI colour 0 to 15 |

A panel holds at most 60 nodes and a title of 80 characters. `tone` is one of `default`, `muted`, `accent`, `ok`,
`warn` and `bad`; any other value is dropped.

```js
tool.setPanel({
  title: "Link",
  nodes: [
    { kind: "kv", key: "Last", value: "420 ms", tone: "ok" },
    { kind: "bar", label: "Load", value: 3, max: 10 },
    { kind: "table", head: ["Call", "Type"], rows: [["OE8APR-9", "user"]] },
  ],
});
```

## The map layer

`tool.setMapLayer(spec)` replaces the tool's map layer. `spec` is `{ id, points }`, each point
`{ lat, lon, label?, glyph?, tone? }`: at most 2000 points, a label of 40 characters and a glyph of 2. The map draws
the layer when the tool targets the `map` surface.

```js
tool.setMapLayer({ id: "waypoints", points: [{ lat: 47.07, lon: 15.44, label: "Graz", tone: "accent" }] });
```

## Next

- [The tool bus](tool-bus.md): talking to other tools and to the app.
- [Limits and budgets](limits.md): the numbers every call is held to.
