# Beacon scheduler

The beacon scheduler transmits a status beacon from your callsign at a fixed interval. It is for operators with a
verified callsign who want a periodic beacon that the app itself keeps on time.

## What it does

`/beacon` hands the app a beacon: a comment and an interval. The app transmits the comment as an APRS status
(`>comment`) at once and then every interval, while the transmit gate is open. Unlike [Auto-status](auto-status.md),
the app keeps the schedule, so the beacon needs no tool event.

## Use it

| Command | Does |
|---|---|
| `/beacon <minutes> <comment>` | Starts the beacon: every `<minutes>`, 10 through 1440 (one day), with `<comment>` (`APRScaching` when left out). Without a number first it answers with its usage and schedules nothing |
| `/beacon off` | Ends it, in any letter case |

For example, `/beacon 60 OE8APR shack, QRV 144.800` beacons once an hour.

## What it transmits

- **One APRS status**, `>comment`, from your callsign, at once and then every interval, never more often than every
  10 minutes. The app clamps the interval to 10 minutes through one day and the comment to one line of 62
  characters. A tool transmits status and messages only.
- **Only through your gate.** The beacon runs only while your callsign is control-verified and a radio is connected
  in **Settings → My radio** with your transmit consent for this tab.
- **Within the tool's budget.** Each tool may transmit once a minute and six times an hour, beacons included.
- **Only when you ask.** It starts on `/beacon`. It ends on `/beacon off`, when you switch the tool off, disconnect
  the radio, end the consent, sign out or change callsign or SSID, or close the tab; then run `/beacon` again.

Every beacon shows in **Recent transmissions** under the tool's title.

## Permissions

| Permission | Why |
|---|---|
| `command` | Registers `/beacon` |
| `beacon` | Schedules the beacon; the app gates it on the verified callsign and the tab's consent |

## Version and tool API

<!-- tool-facts -->

## Next

- [Auto-status](auto-status.md): a status on the tool's own timer.
- [The sandbox API](../write/sandbox-api.md#transmit-and-beacons): `scheduleBeacon()`.
