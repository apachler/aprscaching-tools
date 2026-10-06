# Limits and budgets

This page lists every limit the app holds a tool to: sizes, time-outs, the message budget and the transmit budget.
It is for tool authors who want a tool that never hits one by surprise. Every number here belongs to tool API 1.0.

## Answers and time-outs

| What | Limit | When it is passed |
|---|---|---|
| A command's answer | 200 lines of 1000 characters | The rest is cut |
| A command, decoder, service or bus call | Settles within 10 seconds | The caller gets an error; a command reads `error: the tool did not answer` |
| Loading | The script registers within 15 seconds | `Install failed: the tool did not start in time` |
| A decoder's answer | 20,000 characters | Cut |
| A decoder's `sample` | 2000 characters | Cut |
| A decoder's `placeholder` | 120 characters | Cut |
| A `tool.log()` line | 300 characters | Cut |
| An event payload's strings | 512 characters each | Cut |
| A reply to a connected session | One line of 256 characters; four replies per event, for two minutes | Later replies are dropped |
| Commands and decoders registered | 200 entries each | The rest are dropped |

## Panels, colour rules and the map

| What | Limit |
|---|---|
| Nodes in a panel | 60, with a title of 80 characters |
| A `text` node | 240 characters |
| A `kv` node | key 60, value 240 characters |
| A `badge` node | 40 characters |
| A `table` node | 8 columns of 40 characters; 100 rows of 8 cells of 80 characters |
| A `blocks` node | 1 to 200 columns; 4000 cells of one character |
| Colour rules in `register()` | 40, with `src` or without |
| Colour rules in `tool.setColourRules()` | 40 without `src`, and 2000 with `src`, one per callsign; all of them travel in one message, which may hold 64 KB of JSON, so about 1200 rules of long callsigns fit |
| Points in a map layer | 2000, each with a label of 40 characters and a glyph of 2 |

## The message budget

A tool talks to the app through messages. The app takes at most:

- **200 messages a second** from one tool;
- **64 KB** for one message, as JSON;
- **16 services** and **32 topics** held by one tool.

A message over the budget is dropped, and the tool log says so, once a second. A tool that redraws its panel on
every heard frame stays within the budget by redrawing at most a few times a second:

```js
let dirty = false;
tool.on("on_frame", (p) => {
  remember(p.peerCall);
  dirty = true;
});
setInterval(() => {
  if (dirty) tool.setPanel(panel());
  dirty = false;
}, 1000);
```

## The transmit budget

Each tool has its own transmit budget:

- **one transmission a minute** (`TOOL_TX_MIN_GAP_MS`, 60 seconds between two);
- **six an hour, sustained** (`TOOL_TX_PER_HOUR`): a bucket of six that refills over the hour.

A tool's `requestTx()` calls, its beacon and its session scripts all draw on the same budget. A request the budget
cannot cover is held: `requestTx()` resolves `false`, and a session script is refused with the reason.

The budget lives in the tab's session storage. Switching the tool off and on, removing and installing it again, or
reloading the page does not refill it.

### What a session script costs

A `session.script` run takes its whole cost at the start:

| Step | Cost |
|---|---|
| Each `connect` | 1 transmission |
| Each five `send` steps, started | 1 transmission |
| `waitfor`, `wait`, `disconnect` | 0 |

A script with one `connect` and three `send` steps costs 2; with one `connect` and six `send` steps it costs 3. Six
an hour allows three runs of the first script in an hour.

### Beacons

A beacon transmits at once and then every `intervalSec` seconds, clamped to 10 minutes through one day, with a
comment of one line of 62 characters. Each beacon transmission draws on the budget like a request.

## The sandbox

The worker runs in an `<iframe sandbox="allow-scripts">` built from `srcdoc`, so it has an opaque origin. Its
Content-Security-Policy is:

```text
default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob:; worker-src blob:;
connect-src <the connect origins, or 'none'>; base-uri 'none'; form-action 'none'
```

- **No page.** The worker has no DOM.
- **No app storage.** The app's cookies, session, local storage, IndexedDB, Cache Storage and service worker belong
  to another origin. The worker has no storage that outlives the tool.
- **Network only to `connect`, and only with `network`.** Without `network`, the worker removes `fetch`,
  `XMLHttpRequest`, `WebSocket`, `WebTransport`, `EventSource`, `importScripts`, `Worker` and `SharedWorker` before
  it runs the script.
- **No code from a server.** The policy allows scripts only inline, through `eval` and from `blob:` addresses.

## Script size

A tool's script may hold 512 KB: the instance carries scripts up to that size, and this repository's build fails a
bigger bundle. A registry file may hold 256 KB and a manifest 64 KB.

## Next

- [How a tool runs](how-a-tool-runs.md): the sandbox and the lifecycle these limits belong to.
- [Test a tool](test.md): check a tool against them.
