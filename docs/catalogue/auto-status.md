# Auto-status

Auto-status transmits an APRS status from your callsign on a timer. It is for operators with a verified callsign who
want their station's status text on the air at a steady interval.

## What it does

`/autostatus` sets the interval and the text. On the app's minute tick the tool counts down and, when the interval
has passed, asks the app to transmit `>text`, an APRS status. The tool log says `auto-status sent`, or
`auto-status held (TX gate closed)` when the app held it.

## Use it

| Command | Does |
|---|---|
| `/autostatus <minutes> <text>` | Starts: every `<minutes>`, 10 or more (10 when left out), the status `<text>` (`APRScaching` when left out, cut to 62 characters) |
| `/autostatus off` | Stops |

For example, `/autostatus 30 QRV on 144.800, 73` answers `Auto-status every 30 min: "QRV on 144.800, 73" (TX-gated).`

## What it transmits

- **One APRS status**, `>text`, from your callsign, every interval you set. A tool transmits status and messages
  only; the app refuses anything else.
- **Only through your gate.** The app sends it only while your callsign is control-verified and a radio is connected
  in **Settings → My radio** with your transmit consent for this tab. Without them the status is held.
- **Within the tool's budget.** Each tool may transmit once a minute and six times an hour. The budget lasts for the
  tab: switching the tool off and on, or reloading the page, does not refill it.
- **Only when you ask.** It transmits only after `/autostatus`, and stops on `/autostatus off`, when you switch the
  tool off, or when the tab closes.

Every status shows in **Recent transmissions** under the tool's title.

## Permissions

| Permission | Why |
|---|---|
| `command` | Registers `/autostatus` |
| `event` | Counts the minute tick |
| `tx` | Transmits the status; the app gates it on the verified callsign and the tab's consent |

## Version and tool API

<!-- tool-facts -->

## Next

- [Beacon scheduler](beacon-scheduler.md): the same job through a scheduled beacon.
- [Limits and budgets](../write/limits.md#the-transmit-budget): the transmit budget in full.
