# Build with the shared libraries

This page shows you how to build a tool from sources with this repository's build, which bundles your code, the
helpers in `lib/` and the APRScaching MIT libraries into one readable `tool.js`. It is for tool authors whose tool
needs more than one file, or the APRS parser. At the end your tool's script is a reproducible build CI can check.

## Before you start

- A clone of [apachler/aprscaching-tools](https://github.com/apachler/aprscaching-tools) with its dependencies:

    ```bash
    corepack enable && pnpm install --frozen-lockfile --ignore-scripts
    ```

- A tool folder `tools/<name>/` with its `tool.json` ([Write your first tool](first-tool.md)).

## What you can bundle

| Source | Where it lives | How to import it |
|---|---|---|
| Your tool's own modules | `tools/<name>/src/`, starting at `src/index.js` | `import { x } from "./x.js"` |
| The helpers the project's tools share | `lib/`: `aprs-decode.js` (the packet decoder's text form), `geo.js` (Maidenhead locators, distance and bearing), `sevenplus.js` (the 7PLUS parser), `text.js` (small text helpers) | `import { gridToLatLon } from "../../../lib/geo.js"` |
| The APRScaching MIT libraries | `vendor/aprscaching/`, fetched at the commit `lib.lock` pins | `import { parseScript } from "aprscaching/packages/tools/src/session-script.ts"` |

`lib.lock` names the APRScaching commit and the paths fetched from it:

| Path | What it is |
|---|---|
| `packages/aprs/src` | The APRS parser the gateway ingests with |
| `packages/packet/src/names.ts` | The station-type registry (NAMES.GP) |
| `packages/tools/src/panel.ts` | The panel model |
| `packages/tools/src/decoders/morse.ts` | The Morse decoder |
| `packages/tools/src/decoders/psk31.ts` | The PSK31 varicode decoder |
| `packages/tools/src/session-script.ts` | The session-script parser |

Every fetched file must carry an `SPDX-License-Identifier: MIT` line, so code under another licence never enters a
tool. Nothing from `node_modules` or elsewhere on the computer may enter a bundle.

## Steps

1. Write the tool's entry as `tools/<name>/src/index.js`. It is the script body, so it calls `register` and uses
   `tool` and `ipc` as globals:

    ```js
    // SPDX-License-Identifier: MIT
    /* global register, tool */
    import { gridToLatLon } from "../../../lib/geo.js";

    register({
      commands: {
        where: (args) => {
          const p = gridToLatLon(args.trim());
          return p ? [`${p.lat.toFixed(4)}, ${p.lon.toFixed(4)}`] : ["Usage: /where <locator>"];
        },
      },
    });
    ```

2. Fetch the libraries at the `lib.lock` commit, into `vendor/aprscaching/` (git ignores it):

    ```bash
    node scripts/fetch-libs.mjs
    ```

    With `--source <a local APRScaching clone>` it reads the commit from the clone instead of GitHub.

3. Build:

    ```bash
    node scripts/build.mjs <name>
    ```

    It prints `built <name>: tools/<name>/tool.js (<bytes> bytes)`. Without a name it builds every tool with a
    `src/index.js`.

4. Commit both the sources and the built `tool.js`, then sign the manifest ([Sign a tool](sign.md)).

## What the build makes

`scripts/build.mjs` runs esbuild with one fixed set of options:

- one immediately-invoked function (`iife`), for the browser, ES2022, with no imports left: the classic script the
  sandbox's worker runs;
- not minified, with no source map: a reviewer reads the bytes players run;
- a banner naming the tool, its version and its sources, under the `SPDX-License-Identifier: MIT` line;
- no legal comments copied from the libraries, so the bytes do not change with a comment.

The build fails a bundle that imports from outside `tools/<name>/src/`, `lib/` and `vendor/aprscaching/`, one that
loads code or reaches Node at run time (`require(`, `import(`, `process.`, `importScripts(`), and one over 512 KB.

## Check that it worked

```bash
node scripts/build.mjs --check
```

It builds in memory and prints `ok    <name>: tools/<name>/tool.js matches its sources` for every tool, or fails
when a committed `tool.js` differs from a fresh build. CI runs it on every pull request, so the bytes the
maintainer signs are the bytes the sources give. The same sources, the same library code and the same esbuild
version give the same bytes on any computer.

## Move `lib.lock` to a new commit

1. Set `ref` in `lib.lock` to a full commit that exists on GitHub, such as an APRScaching release tag's commit.
2. Fetch and check:

    ```bash
    node scripts/fetch-libs.mjs
    node scripts/build.mjs --check
    ```

3. A tool whose check fails changed with its libraries: rebuild it with `node scripts/build.mjs`, run `pnpm test`,
   raise its `version` and sign it again.

The banner names no commit, so moving `lib.lock` to a commit whose libraries are unchanged leaves every `tool.js` as
it is.

## A tool built elsewhere

A tool hosted outside this repository may use any bundler, as long as the result is one classic script with no
`import`, readable rather than minified, with an `SPDX-License-Identifier` line at the top. Publish its sources
beside it, so a reviewer can rebuild the bytes.

## Next

- [Test a tool](test.md): run the built script in the test harness.
- [Sign a tool](sign.md): sign the bytes you built.
