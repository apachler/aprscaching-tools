# Test a tool

This page shows you how to test a tool with the repository's harness, which runs the built script the way the
sandbox does. It is for tool authors. At the end your tool's commands, events, bus messages and transmit requests
are covered by tests that run in CI.

## Before you start

- A clone of [apachler/aprscaching-tools](https://github.com/apachler/aprscaching-tools) with its dependencies
  installed (`corepack enable && pnpm install --frozen-lockfile --ignore-scripts`).
- Your tool in `tools/<name>/`, with a built `tool.js` ([Build with the shared libraries](build.md)).

## The harness

`test/harness.mjs` is a stand-in for the sandbox. `loadTool(name)` reads `tools/<name>/tool.json`, runs its script
as the body of a function of `register`, `ipc` and `tool`, with the API of tool API 1.0 and the same permission
checks, and records what the tool asks of the app. Values cross the boundary through `structuredClone`, as
`postMessage` copies them, and bus payloads travel as JSON, so a `Date` arrives as its string, as in the app. The
harness keeps the app's rules where a test could otherwise pass wrongly:

- **The bus.** `provide` is refused for a service another tool holds, and for names that start with `session.` or
  `host.` or `link.`; a tool may not publish those topics either, except `link.ping.request`. A call to `session.script` without `tx` is refused with the
  app's reason ([The tool bus](tool-bus.md)).
- **Transmit format.** `requestTx()` holds what the app would not send, such as a status over 62 characters or one
  that starts with a grid locator, and resolves `false` ([The sandbox API](sandbox-api.md#toolrequesttxinfo)).
- **Message size.** A colour-rule set over 64 KB of JSON is dropped and logged, as the app drops a message over its
  budget ([Limits and budgets](limits.md)).

| Call | Does |
|---|---|
| `loadTool(name, opts?)` | Loads the tool. `opts.permissions` overrides the manifest's grants; `opts.bus` shares a bus between tools; `opts.tx(info)` and `opts.beacon(spec)` answer transmit and beacon requests (granted by default) and may throw, as the app does when its gate is closed. |
| `createBus()` | A tool bus several tools can share. `bus.emit(topic, data, from)` publishes as any sender, such as `"(host)"`. |
| `t.run(word, args?, { remote? })` | Runs a command and resolves its lines; as a remote station, only a remote tool's remote commands answer (`null` otherwise). |
| `t.decode(id, input)` | Runs a decoder. |
| `t.dispatch(event, payload?, reply?)` | Raises an event; `reply` stands for the connected session's reply. Resolves once every handler settled. |
| `t.panel`, `t.map` | The tool's panel and map layer. |
| `t.colour(line)` | The colour token the monitor draws for `{ src, dst, text }`, from the tool's colour rules. |
| `t.state` | What the tool did: `logs`, `txs` (sent), `txHeld` (held for their format), `beacons`, `colourRules` and `colourPublishes` (how often it published them), `commands`, `decoders`. |
| `t.commands()` | The registered command words. |

## Steps

1. Add `test/<name>.test.mjs`:

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

2. Run it:

    ```bash
    pnpm exec vitest run test/<name>.test.mjs
    ```

## What to test

- **Each command**, its usage line and a bad input.
- **Remote use.** A command meant for connected stations answers with `{ remote: true }`; one that is the
  operator's alone answers `null`:

    ```js
    expect(await t.run("setinfo", "hello", { remote: true })).toBeNull();
    ```

- **Events.** Raise them with `dispatch`, including the minute tick. Auto-status stays idle until `/autostatus`
  sets its interval, so the test runs that first:

    ```js
    const t = loadTool("auto-status");
    await t.run("autostatus", "10");
    for (let i = 0; i < 10; i++) await t.dispatch("on_tick");
    expect(t.state.txs).toEqual([">APRScaching"]);
    ```

- **A closed gate.** Make the app refuse, and check the tool says so:

    ```js
    const t = loadTool("auto-status", { tx: () => false });
    ```

- **Missing permissions.** Load the tool with fewer grants and check it degrades instead of throwing at load:

    ```js
    const t = loadTool("station-log", { permissions: ["command", "panel"] });
    ```

- **The bus.** Share one `createBus()` between your tool and the tool it talks to, or publish as `"(host)"` for what
  the app sends.

## The repository checks

`pnpm test` also runs `test/repository.test.mjs`, which checks every tool folder the way the review does:

- a manifest the app accepts, with `"api": "1.0"` and `"entry": "tool.js"`; a tool built here lives in a folder of
  its manifest's name;
- an entry in `registry.json` with the manifest's name, title, author, version and description;
- a README with a row for every permission and a **Licence** section, and an `SPDX-License-Identifier: MIT` first
  line in the script and its source.

A new tool has no registry entry until the maintainer adds it. Until then the check prints a warning and passes; with
`STRICT=1`, which CI sets on `main`, on pull requests into it and on release tags, it fails.

## Check that it worked

```bash
pnpm test
node scripts/build.mjs --check
node scripts/verify.mjs
```

CI runs the same three on every pull request. `verify.mjs` lists a tool that is not yet signed as `UNSIG` without
failing; it fails only with `--strict`, which `main` runs.

## Next

- [Sign a tool](sign.md): sign what you tested.
- [Limits and budgets](limits.md): the limits a test should stay within.
