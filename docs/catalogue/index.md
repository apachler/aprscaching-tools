# Tool catalogue

This catalogue lists every tool in the project registry, grouped by the job it does. Each page says what the tool
does, its commands, the permissions it asks for and why, and its version and tool API.

Players install these tools in the Shack's **Tools** app; [Tools and plugins](https://apachler.github.io/aprscaching/shack/tools/)
in the APRScaching manual shows how. A tool runs in the player's browser, in a sandbox, with only the permissions
the player approves.

## Decoders

Paste a line or a code, or listen through the microphone, and read what it carries.

| Tool | What it does | Permissions |
|---|---|---|
| [Packet decoder](packet-decoder.md) | Decodes a raw TNC2 or APRS-IS line into its fields | `decoder` `panel` |
| [PSK31 + CW decoders](digimode-decoders.md) | Decodes CW and PSK31, typed or by ear | `decoder` |
| [7PLUS reassembler](sevenplus.md) | Reads 7PLUS parts and says which are missing | `decoder` |

## Monitor and station tools

Follow what the radio and the live map hear.

| Tool | What it does | Permissions |
|---|---|---|
| [MHeard](mheard.md) | The stations heard most recently, from every source | `monitor` `event` `panel` |
| [Watch & alert](watch-alert.md) | Records and highlights the callsigns you watch | `command` `monitor` `panel` |
| [Monitor colouriser](monitor-colouriser.md) | Colours the packet monitor by station type | `monitor` |
| [Station DB (NAMES.GP)](station-db.md) | Classifies heard stations and shares them with other tools | `monitor` `ipc` |
| [Station log](station-log.md) | Lists the stations Station DB hears, with `/seen` and `/whois` | `command` `panel` `ipc` |
| [Connect bell](connect-bell.md) | Rings when a station connects | `event` `panel` |
| [Link ping (RTT)](link-ping.md) | The round-trip time to the connected station | `command` `ipc` `panel` |

## Responders

Answer a station that connects to you.

| Tool | What it does | Permissions |
|---|---|---|
| [Auto-responder](auto-responder.md) | Greets a station that connects | `event` |
| [Away note](away-note.md) | Takes notes from connecting stations while you are away | `command` `event` `panel` |
| [Info / menu responder](info-responder.md) | Answers a station's INFO, MENU and WHOIS | `command` `panel` `ipc` |

## Transmit tools

Transmit under your callsign. Each needs your control-verified callsign and a transmit consent (the tab's, or for
Scheduled query the packet terminal's own), and each tool may transmit at most once a minute and six times an hour.

| Tool | What it does | Permissions |
|---|---|---|
| [Auto-status](auto-status.md) | A periodic APRS status | `command` `event` `tx` |
| [Beacon scheduler](beacon-scheduler.md) | A periodic status beacon, kept on time by the app | `command` `beacon` |
| [Scheduled query (GPAUTO)](sched-query.md) | Scripted BBS and cluster queries | `command` `event` `ipc` `panel` `tx` |

## Utilities

Small jobs at the keyboard.

| Tool | What it does | Permissions |
|---|---|---|
| [CTEXT macro pack](ctext-macros.md) | `/cq`, `/73` and `/qth` | `command` |
| [Grid & bearing](grid-bearing.md) | Distance and bearing between Maidenhead locators | `command` `panel` |
| [Unit converter](unit-convert.md) | km, mi, ft, kn, °C/°F and more | `command` |
| [CW encoder](cw-encoder.md) | Text to Morse | `command` |
| [Map waypoints](map-waypoints.md) | Markers on the map | `command` `map` |
| [Block art (GIP)](block-art.md) | CP437 and ANSI art in a panel | `command` `panel` `ipc` |
| [APRS SSID guide](aprs-ssid-guide.md) | The conventional APRS SSIDs | `panel` |
| [Hello tool](hello.md) | The example: a command, a colour rule, a panel and a decoder | `command` `monitor` `panel` `decoder` |

## Next

- [Write your first tool](../write/first-tool.md): add a tool of your own.
- [Contribute a tool](../project/contribute.md): list it here.
