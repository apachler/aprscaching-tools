# Write your first tool

This tutorial takes you from `scripts/new-tool.mjs` to your own signed tool, running in a local APRScaching app and
covered by a test. It is for developers who know some JavaScript. At the end your tool passes every check of this
repository and is ready to host, or to propose for the project registry.

## Before you start

- Node 22 or newer, with corepack (it ships with Node) for pnpm.
- Your fork of [apachler/aprscaching-tools](https://github.com/apachler/aprscaching-tools), cloned.
- A checkout of [apachler/aprscaching](https://github.com/apachler/aprscaching) with `pnpm install` run once, for
  the local app ([Run from source](https://apachler.github.io/aprscaching/contribute/run-from-source/) in the
  APRScaching manual).
- A Chromium-based browser, Firefox or Safari.
- Python 3, for the documentation build.
- [The sandbox API](sandbox-api.md) open beside you: it lists every call this page uses.

## Steps

### Set up the repository

In your clone of the tools repository, install the build and test tools and fetch the shared libraries:

```bash
corepack enable && pnpm install --frozen-lockfile --ignore-scripts
node scripts/fetch-libs.mjs
```

`fetch-libs` writes the APRScaching MIT libraries at the `lib.lock` commit into `vendor/aprscaching/`. The build
bundles them into a tool's script.

### Start the tool

Let `new-tool.mjs` write the tool, its test and its catalogue page:

```bash
node scripts/new-tool.mjs my-station-log --title "My station log" --author <your callsign> \
  --description "Lists the stations the Station DB tool hears."
```

It prints the files it wrote and builds the tool:

| File | What it is |
|---|---|
| `tools/my-station-log/tool.json` | The manifest: version `1.0.0`, tool API `1.0`, the `command` permission |
| `tools/my-station-log/src/index.js` | The source, a working `/my-station-log` command |
| `tools/my-station-log/tool.js` | The built script the sandbox runs; never edit it |
| `tools/my-station-log/README.md` | The tool's README, with its **Permissions** table |
| `test/my-station-log.test.mjs` | A test of the command |
| `docs/catalogue/my-station-log.md` | The tool's catalogue page |

It also adds a row to the Utilities table of `docs/catalogue/index.md` and an entry to the nav in `mkdocs.yml`. As
it is, the tool passes `pnpm test`, `node scripts/verify.mjs` and `mkdocs build --strict`.

The name is the tool's identity: lower case, 2 to 40 characters of `a-z`, `0-9` and `-`. [The manifest](manifest.md)
lists every field of `tool.json`.

### Write the script

The source is the body of a function the sandbox calls with three arguments: `register`, `ipc` and `tool`. Replace
`tools/my-station-log/src/index.js` with a station log:

```js
// SPDX-License-Identifier: MIT
/* global register, ipc */
// My station log: lists the stations the Station DB tool announces on the bus, and answers /seen and /whois.

const MAX = 10;
const seen = []; // newest first: { call, type, source }

function panel(extra = []) {
  const rows = seen.map((s) => [s.call, s.type || "-", s.source || "-"]);
  return {
    title: "My station log",
    nodes: [
      ...extra,
      rows.length
        ? { kind: "table", head: ["Call", "Type", "Via"], rows }
        : { kind: "text", text: "No stations yet. Enable Station DB and turn on live stations.", tone: "muted" },
    ],
  };
}

if (ipc) {
  ipc.subscribe("station.seen", (data) => {
    const call = data && typeof data.call === "string" ? data.call : "";
    if (!call) return;
    const i = seen.findIndex((s) => s.call === call);
    if (i >= 0) seen.splice(i, 1);
    seen.unshift({ call, type: String(data.type || ""), source: String(data.source || "") });
    if (seen.length > MAX) seen.length = MAX;
    ipc.setPanel(panel());
  });
}

register({
  commands: {
    seen: () =>
      seen.length ? seen.map((s) => `${s.call}  ${s.type || "-"}  ${s.source || "-"}`) : ["No stations heard yet."],
    whois: (args) => {
      const call = args.trim().toUpperCase();
      if (!call) return ["Usage: /whois <callsign>"];
      if (!ipc) return ["My station log needs the ipc permission to ask Station DB."];
      ipc.call("station.type", call).then((type) => {
        const known = typeof type === "string" && type !== "";
        ipc.setPanel(panel([{ kind: "kv", key: call, value: known ? type : "not heard", tone: known ? "ok" : "muted" }]));
      });
      return [`Asked Station DB about ${call}; the answer shows in the panel.`];
    },
  },
  panel: panel(),
});
```

- `ipc.subscribe("station.seen", …)` hears every station the [Station DB (NAMES.GP)](../catalogue/station-db.md)
  tool publishes, and redraws the panel. `ipc` is `undefined` unless the player granted `ipc`, so the script checks
  it first.
- `register()` runs once, with two commands and a first panel. A command answers at once with its lines. `/whois`
  asks another tool through `ipc.call()`, which answers later, so its result goes to the panel.
- A panel is data, not HTML: a title and a list of nodes such as `kv`, `table` and `text`. The app draws it with its
  own elements, in the player's theme.

Build it:

```bash
node scripts/build.mjs my-station-log
```

### Declare what it asks for

The script now uses a panel and the tool bus besides commands. Every permission it uses goes in four places, and
the checks compare them:

1. In `tools/my-station-log/tool.json`, set `"permissions": ["command", "panel", "ipc"]`.
2. In `tools/my-station-log/README.md` and in `docs/catalogue/my-station-log.md`, make the **Permissions** table say
   why the tool needs each one:

    ```markdown
    | Permission | Why |
    |---|---|
    | `command` | Registers `/seen` and `/whois` |
    | `panel` | Shows the stations heard |
    | `ipc` | Hears `station.seen` and asks `station.type` of Station DB |
    ```

3. In `docs/catalogue/index.md`, end the tool's row with `` `command` `panel` `ipc` ``.

Then describe the commands: replace the scaffold's `/my-station-log` lines under **Use it** in the README, and under
**What it does** and **Use it** on the catalogue page, with `/seen` and `/whois <callsign>`. When the tool fits
another group of the catalogue better than Utilities, move its row in `docs/catalogue/index.md` and its nav entry in
`mkdocs.yml` there.

### Test it

Replace `test/my-station-log.test.mjs`. The harness runs the built script the way the sandbox does:

```js
// SPDX-License-Identifier: MIT
import { describe, expect, it } from "vitest";
import { createBus, loadTool } from "./harness.mjs";

describe("my-station-log", () => {
  it("lists a station Station DB announces", async () => {
    const bus = createBus();
    const t = loadTool("my-station-log", { bus });
    expect(await t.run("seen")).toEqual(["No stations heard yet."]);
    bus.emit("station.seen", { call: "OE8APR-9", type: "user", source: "RF" }, "station-db");
    expect(await t.run("seen")).toEqual(["OE8APR-9  user  RF"]);
  });
});
```

[Test a tool](test.md) covers the harness in full.

### Sign it

The app installs only signed tools. Make an author key once, on a computer you trust, and sign the manifest:

```bash
node scripts/genkey.mjs --raw > ~/my-tool-author.key && chmod 600 ~/my-tool-author.key
TOOL_PRIVATE_KEY="$(cat ~/my-tool-author.key)" node scripts/sign.mjs manifest tools/my-station-log/tool.json
```

`sign.mjs` writes the script's SHA-256 into `entrySha256`, your public key into `pubkey`, and the `signature`. Sign
again after every build. Keep the key file out of the repository: `.gitignore` excludes `*.key`.
[Sign a tool](sign.md) explains the keys.

### Run it in your local app

1. Copy the Station log example's small web server next to your tool, and start it:

    ```bash
    cp tools/station-log/serve.mjs tools/my-station-log/
    node tools/my-station-log/serve.mjs
    ```

    It prints `serving … at http://127.0.0.1:8790/tool.json` and sends the CORS header the app needs to read the
    files. Delete `serve.mjs` again before you propose the tool.

2. In the APRScaching checkout, start the web app:

    ```bash
    pnpm dev:web
    ```

3. Open `http://localhost:5173/?demo=app&net=1&view=tools&tools=station-db`. `demo=app` runs the whole app on
   sample data with no gateway, `net=1` lets it reach your server, `view=tools` opens **Shack → Tools**, and
   `tools=station-db` installs Station DB from the bundled project registry.
4. Under **Install by address**, enter `http://127.0.0.1:8790/tool.json` and select **Install…**.

    The prompt shows **My station log by `<your callsign>` requests: command, panel, ipc** and the label
    **Signed · unknown author key (trust-on-first-use)**.

5. Select **Approve and install**. A toast says the tool was installed, and the **My station log** panel appears.
6. Under **Run a tool command**, enter `/whois OE6XRR-9` and select **Run**.

To load a change to the script, build it, sign the manifest again and reload the page: the app starts your installed
tools again and runs the new script once its hash matches the signed manifest.

### Run the checks

Run what CI runs on a pull request:

```bash
pnpm test
node scripts/build.mjs --check
node scripts/verify.mjs
```

Then build the documentation site, in a Python virtual environment of its own:

```bash
python3 -m venv .venv && .venv/bin/pip install -r docs/requirements.txt
node scripts/fetch-mermaid.mjs
.venv/bin/mkdocs build --strict
```

## Check that it worked

- `pnpm test` passes, with a warning that `tools/my-station-log` has no registry entry yet.
- `verify.mjs` lists `tools/my-station-log/tool.json` as signed by your key, not listed in the registry.
- `mkdocs build --strict` builds the site, with **My station log** in the catalogue.
- In the local app, the panel **My station log** shows under the list of tools, `/seen` answers
  `No stations heard yet.` or a list of stations, and after `/whois OE6XRR-9` the panel's first row shows `OE6XRR-9`
  with its type, or `not heard`.

The demo data never hears a new station, so the station table stays empty there. Against a gateway that hears
stations (`pnpm dev --ingest` in the APRScaching checkout), with **Live stations** switched on, the table fills.

## Next

- [Contribute a tool](../project/contribute.md): propose your tool for the project registry, from a branch cut
  from `dev`.
- [Host a registry on GitHub](../publish/github.md): publish it in a registry of your own.
