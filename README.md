# APRScaching tools

The project's tool registry for APRScaching 1.x: a signed list of tools for the Shack's **Tools** app, and the
tools it lists. The app ships no tools of its own: every tool, the project's first-party ones included, comes from
a registry, is installed by the player on demand and runs in the app's sandbox.

- `registry.json` lists each tool with its author's public key and the address of its `tool.json`. The project's
  authority key signs the list.
- `tools/<name>/` holds one tool: its `tool.json`, its script (`tool.js`) and a `README.md` that explains its
  permissions and declares its licence. A tool built here also has its source in `src/`.
- `lib/` holds helpers the project's tools share; `lib.lock` pins the APRScaching commit whose MIT libraries
  (the APRS parser, the station-type registry, the panel model, the Morse and PSK31 decoders, the session-script
  parser) the tools bundle.
- `scripts/` holds `fetch-libs.mjs` and `build.mjs` to build the tools, `new-tool.mjs` to start one, `genkey.mjs`,
  `sign.mjs` and `sign-all.mjs` to make keys and sign, `verify.mjs` to check the registry and every listed tool,
  `release.mjs` to release a tag step by step, and `doctor.mjs` to check that a computer can do all of that. The
  signing keys stay in a folder outside every repository, by default `~/.config/aprscaching-tools/keys`.

## The tools

| Tool | What it does |
|---|---|
| [Packet decoder](tools/packet-decoder/) | Decodes a raw TNC2 or APRS-IS line into its fields |
| [PSK31 + CW decoders](tools/digimode-decoders/) | Decodes CW and PSK31, typed or by ear |
| [7PLUS reassembler](tools/sevenplus/) | Reads 7PLUS parts and says what is missing |
| [MHeard](tools/mheard/) | The stations heard most recently, from every source |
| [Watch & alert](tools/watch-alert/) | Records and highlights the callsigns you watch |
| [Monitor colouriser](tools/monitor-colouriser/) | Colours the monitor by station type |
| [Station DB](tools/station-db/) | Classifies heard stations and shares them on the tool bus |
| [Station log](tools/station-log/) | Lists the stations Station DB hears, with `/seen` and `/whois` |
| [CTEXT macro pack](tools/ctext-macros/) | `/cq`, `/73` and `/qth` |
| [Grid & bearing](tools/grid-bearing/) | Distance and bearing between Maidenhead locators |
| [Unit converter](tools/unit-convert/) | km, mi, ft, kn, °C/°F and more |
| [CW encoder](tools/cw-encoder/) | Text to Morse |
| [Map waypoints](tools/map-waypoints/) | Markers on the map |
| [Block art](tools/block-art/) | CP437/ANSI art in a panel |
| [APRS SSID guide](tools/aprs-ssid-guide/) | The conventional APRS SSIDs |
| [Auto-responder](tools/auto-responder/) | Greets a station that connects |
| [Away note](tools/away-note/) | Takes notes from connecting stations while you are away |
| [Connect bell](tools/connect-bell/) | Rings when a station connects |
| [Info / menu responder](tools/info-responder/) | Answers a peer's INFO, MENU and WHOIS |
| [Link ping](tools/link-ping/) | Round-trip time to the connected station |
| [Scheduled query](tools/sched-query/) | Scripted BBS and cluster queries (GPAUTO) |
| [Auto-status](tools/auto-status/) | A periodic APRS status (transmits) |
| [Beacon scheduler](tools/beacon-scheduler/) | A periodic status beacon (transmits) |
| [Hello tool](tools/hello/) | The example from the tool walkthrough |

## Build

Node 22 or later and pnpm (through corepack). The build fetches the MIT libraries at the `lib.lock` commit, then
bundles each `tools/<name>/src/` into one readable, self-contained `tools/<name>/tool.js` for the sandbox's
Worker. The same sources give the same bytes on any machine; CI fails when a committed `tool.js` differs from a
fresh build.

```bash
corepack enable && pnpm install --frozen-lockfile --ignore-scripts
node scripts/fetch-libs.mjs        # or: --source <a local APRScaching clone>
node scripts/build.mjs             # writes each tools/<name>/tool.js
pnpm test                          # runs every built tool in a stand-in for the sandbox
node scripts/build.mjs --check     # what CI runs: the committed scripts match their sources
```

A change to a tool's source, to `lib/` or to the library code at the `lib.lock` commit changes its `tool.js`, so
the tool must be signed again. Code only the tools use (the packet decoder's text form, the 7PLUS parser, the
locator maths) lives in `lib/` here; `lib.lock` names only libraries the app itself still has.

To bump `lib.lock` safely: set `ref` to a full commit (a release tag's commit) that exists on GitHub, then run
`node scripts/fetch-libs.mjs` and `node scripts/build.mjs --check`. A tool whose check fails changed with its
libraries: rebuild it, run the tests and sign it again.

The app checks the registry's signature against the authority key it pins, and shows a tool as registry-listed
only when its `tool.json` comes from the address its entry names and carries a signature by the key the entry
lists.

## How instances use it

- **Bundled.** Each APRScaching release ships a tagged release of this registry, so every instance shows it with
  no setup.
- **Added by source.** A sysop adds `github:apachler/aprscaching-tools@<tag>` under **Instance settings → Tools**
  to follow a newer tag than the bundled one. Players add the same source in their own **Tools** settings.

Entry addresses are relative to `registry.json`, so the same files work bundled with an instance and served from
`https://raw.githubusercontent.com/apachler/aprscaching-tools/<tag>/registry.json`.

## Authority key

The registry is signed by this Ed25519 public key (base64url):

```text
22usQMnB0VLUKlwA176NK2EZwqcSxcgx0M_rS2jNWp0
```

It is in `authority.pub`, in `registry.json` as `authority`, and in the APRScaching app as the default
`VITE_TOOL_REGISTRY_AUTHORITY`. Compare all three before you trust a copy of this registry. Check a checkout
yourself:

```bash
node scripts/verify.mjs
```

## Propose a tool

Open a pull request into `dev` with your tool's directory, signed with your own author key.
[Contribute a tool](https://apachler.github.io/aprscaching-tools/project/contribute/) lists the steps and what the
review checks; [Maintain the registry](https://apachler.github.io/aprscaching-tools/project/maintain/) covers listing,
signing and releasing.

## Documentation

The documentation site, https://apachler.github.io/aprscaching-tools/, is built from `docs/` with MkDocs:

- [Tool catalogue](https://apachler.github.io/aprscaching-tools/catalogue/): every tool, its commands and its
  permissions
- [Write your first tool](https://apachler.github.io/aprscaching-tools/write/first-tool/), the
  [sandbox API](https://apachler.github.io/aprscaching-tools/write/sandbox-api/) and
  [tool API versions](https://apachler.github.io/aprscaching-tools/api/)
- [Publish a registry](https://apachler.github.io/aprscaching-tools/publish/) of your own

Players and sysops find the Tools app in the [APRScaching manual](https://apachler.github.io/aprscaching/). To build
the site locally:

```bash
python3 -m venv .venv && .venv/bin/pip install -r docs/requirements.txt
node scripts/fetch-mermaid.mjs
.venv/bin/mkdocs serve
```

## Licence

The registry file, the scripts and the documentation are MIT ([LICENSE](LICENSE)). Each tool is under the licence
it declares in its own directory.
