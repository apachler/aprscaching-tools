# Write your first tool

This tutorial takes you from a copy of the Station log example to your own signed tool, running in a local
aprscaching app and covered by a test. It is for developers who know some JavaScript. At the end your tool is ready
to host, or to propose for the project registry.

## Before you start

- Node 22 or newer, with corepack (it ships with Node) for pnpm.
- Your fork of [apachler/aprscaching-tools](https://github.com/apachler/aprscaching-tools), cloned.
- A checkout of [apachler/aprscaching](https://github.com/apachler/aprscaching) with `pnpm install` run once, for
  the local app ([Run from source](https://apachler.github.io/aprscaching/contribute/run-from-source/) in the
  aprscaching manual).
- A Chromium-based browser, Firefox or Safari.
- [The sandbox API](sandbox-api.md) open beside you: it lists every call this page uses.

## Steps

### Set up the repository

1. In your clone of the tools repository, install the build and test tools and fetch the shared libraries:

    ```bash
    corepack enable && pnpm install --frozen-lockfile --ignore-scripts
    node scripts/fetch-libs.mjs
    ```

    `fetch-libs` writes the aprscaching MIT libraries at the `lib.lock` commit into `vendor/aprscaching/`.

2. Copy the Station log example to a folder of your own:

    ```bash
    cp -r tools/station-log tools/my-station-log
    ```

    It holds `tool.json` (the manifest), `tool.js` (the script), `serve.mjs` (a small local web server) and a
    `README.md`.

### Give the tool its identity

Open `tools/my-station-log/tool.json`, give the tool its own name, title and author, and delete the `pubkey`,
`signature` and `entrySha256` fields; signing writes them again:

```json
{
  "name": "my-station-log",
  "title": "My station log",
  "author": "<your callsign>",
  "version": "0.1.0",
  "api": "1.0",
  "permissions": ["command", "panel", "ipc"],
  "surfaces": ["web", "terminal"],
  "description": "Lists the stations the Station DB tool hears.",
  "entry": "tool.js"
}
```

- `name` is the tool's identity: lower case, 2 to 40 characters of `a-z`, `0-9` and `-`.
- `api` is the tool API the tool needs. `1.0` runs on every aprscaching 1.x instance.
- `permissions` is everything the tool asks the player for: a command, a panel and the tool bus.
- `surfaces` puts the panel in the **Tools** app and the packet terminal.

[The manifest](manifest.md) lists every field.

### Read the script

`tool.js` is the body of a function the sandbox calls with three arguments: `register`, `ipc` and `tool`. It has no
`import`; everything is in this one file.

1. It subscribes to `station.seen`, which the [Station DB (NAMES.GP)](../catalogue/station-db.md) tool publishes
   for every station the app hears, and redraws its panel:

    ```js
    if (ipc) {
      ipc.subscribe("station.seen", (data) => {
        // keep the ten newest { call, type, source } entries, then:
        ipc.setPanel(panel());
      });
    }
    ```

    `ipc` is `undefined` unless the player granted `ipc`, so the script checks it first.

2. It calls `register()` once, with two commands and a first panel:

    ```js
    register({
      commands: {
        seen: () => seen.map((s) => `${s.call}  ${s.type || "-"}  ${s.source || "-"}`),
        whois: (args) => {
          ipc.call("station.type", args.trim().toUpperCase()).then((type) => ipc.setPanel(/* … */));
          return ["Asked Station DB …; the answer shows in the panel."];
        },
      },
      panel: panel(),
    });
    ```

    A command answers at once with its lines. `/whois` asks another tool through `ipc.call()`, which answers later,
    so its result goes to the panel.

3. A panel is data, not HTML: a title and a list of nodes such as `kv`, `table` and `text`. The app draws it with
   its own elements, in the player's theme.

Change the panel's title in `panel()` to `My station log`, so you can tell your copy from the example.

### Sign it

The app installs only signed tools. Make an author key once, on a computer you trust, and sign the manifest:

```bash
node scripts/genkey.mjs --raw > ~/my-tool-author.key && chmod 600 ~/my-tool-author.key
TOOL_PRIVATE_KEY="$(cat ~/my-tool-author.key)" node scripts/sign.mjs manifest tools/my-station-log/tool.json
```

`sign.mjs` writes the script's SHA-256 into `entrySha256`, your public key into `pubkey`, and the `signature`.
Keep the key file out of the repository: `.gitignore` excludes `*.key`. [Sign a tool](sign.md) explains the keys.

### Run it in your local app

1. Serve the tool's folder:

    ```bash
    node tools/my-station-log/serve.mjs
    ```

    It prints `serving … at http://127.0.0.1:8790/tool.json` and sends the CORS header the app needs to read the
    files.

2. In the aprscaching checkout, start the web app:

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

To load a change to the script, sign the manifest again and reload the page: the app starts your installed tools
again and runs the new script once its hash matches the signed manifest.

## Check that it worked

- The panel **My station log** shows under the list of tools.
- `/seen` answers `No stations heard yet.`, or a list of stations.
- After `/whois OE6XRR-9`, the panel's first row shows `OE6XRR-9` with its type, or `not heard`.

The demo data never hears a new station, so the station table stays empty there. Against a gateway that hears
stations (`pnpm dev --ingest` in the aprscaching checkout), with **Live stations** switched on, the table fills.

## Test it

Add `test/my-station-log.test.mjs`. The harness runs the script the way the sandbox does:

```js
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

Run it with `pnpm test`. [Test a tool](test.md) covers the harness in full.

## Next

- [Contribute a tool](../project/contribute.md): propose your tool for the project registry.
- [Host a registry on GitHub](../publish/github.md): publish it in a registry of your own.
