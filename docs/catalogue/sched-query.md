# Scheduled query (GPAUTO)

The scheduled query runs a short script against a BBS or a DX cluster: connect, wait for a prompt, send a command,
capture the reply, disconnect. It is for operators who check the same BBS or cluster again and again, as Graphic
Packet's GPAUTO did.

## What it does

The packet terminal owns the connection. While its TNC is open it offers the `session.script` service, which runs
one script at a time. The tool hands it the steps and shows the progress and the last ten captured lines in its
panel.

A script is up to 20 steps, separated by `;` or one per line:

| Step | Does |
|---|---|
| `connect <call>` | Connects to the station; always the first step |
| `waitfor <text> [seconds]` | Waits until a received line contains `<text>`; 60 seconds when left out |
| `send <line>` | Sends one line |
| `wait <seconds>` | Waits |
| `disconnect` or `bye` | Disconnects |

A line that starts with `#` or `rem` is a comment, and the parser skips a line it does not know.

## Use it

| Command | Does |
|---|---|
| `/gpauto <steps>` | Runs the script now, and keeps it |
| `/gpauto every <minutes> <steps>` | Runs it now, then every `<minutes>`, 10 or more. Each scheduled run's outcome goes to the tool log |
| `/gpauto run` | Runs the kept script again |
| `/gpauto off` | Ends the schedule |
| `/gpauto` | Says whether a script is kept |

For example:

```text
/gpauto connect HB9W-8; waitfor Cluster; send sh/dx; disconnect
```

Open the packet terminal's TNC first; without it the tool answers `Open the packet TNC first (no session service).`

## What it transmits

- **The connect, the lines your script sends and the disconnect**, through the packet terminal's own session. That
  session transmits only while your callsign is control-verified, with the terminal's own transmit consent.
- **Within the tool's budget.** Each run draws on the tool's transmit budget of one transmission a minute and six an
  hour: one for each `connect`, and one more for each five `send` steps. A run the budget cannot cover is
  refused: a run you start answers `Refused:` with the reason, and a scheduled one writes it to the tool log.
- **Only the scripts you give it**, when you ask or on the schedule you set. A new script closes the channel the
  last one held, and switching the tool off or removing it cancels its script.

## Permissions

| Permission | Why |
|---|---|
| `command` | Registers `/gpauto` |
| `event` | Counts the minute tick for scheduled runs |
| `ipc` | Calls the terminal's `session.script` service and reads `session.progress` |
| `panel` | Shows the progress and the captured reply |
| `tx` | The `session.script` service connects and sends over your TNC, so it requires this permission |

## Version and tool API

<!-- tool-facts -->

## Next

- [The tool bus](../write/tool-bus.md#the-names-in-use): `session.script` and `session.progress`.
- [Limits and budgets](../write/limits.md#the-transmit-budget): what a script costs.
