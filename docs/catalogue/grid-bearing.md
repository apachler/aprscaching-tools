# Grid & bearing

Grid & bearing works out the distance and bearing between two Maidenhead locators, or one locator's position. It is
for operators planning a contact or a path; connected stations may ask it too.

## What it does

With one locator the tool answers with its position; with two it answers with the great-circle distance and the
bearing from the first to the second, and shows them in its panel.

## Use it

| Command | Answer |
|---|---|
| `/grid JN76` | `JN76 = 46.5000, 15.0000` |
| `/grid JN76jx JO30` | `JN76JX → JO30: <km> km, bearing <degrees>°`, also in the panel |

A connected station may send `grid <locator> [locator]` and gets the same answer.

## Permissions

| Permission | Why |
|---|---|
| `command` | Registers `/grid` |
| `panel` | Shows the last result |

## Version and tool API

<!-- tool-facts -->

## Next

- [Map waypoints](map-waypoints.md): put a locator on the map.
- [Unit converter](unit-convert.md): turn kilometres into miles.
