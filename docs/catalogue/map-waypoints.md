# Map waypoints

Map waypoints puts markers on the map from a locator or a latitude and longitude. It is for operators who want a
point of interest on the map while they plan.

## What it does

Each marker is part of the tool's map layer, which the app draws in the theme's colours. The tool keeps the last 500
markers; they last while the tool runs.

## Use it

| Command | Does |
|---|---|
| `/wp <locator> [label]` | Adds a marker at the locator's centre, for example `/wp JN76jx Home` |
| `/wp <lat>,<lon> [label]` | Adds a marker at a position, for example `/wp 47.07,15.44 Graz` |
| `/wpclear` | Removes every marker |

`/wp JN76jx Home` answers `Waypoint 1: <lat>,<lon> (Home)`.

## Permissions

| Permission | Why |
|---|---|
| `command` | Registers `/wp` and `/wpclear` |
| `map` | Draws the markers on the map |

## Version and tool API

<!-- tool-facts -->

## Next

- [The sandbox API](../write/sandbox-api.md#the-map-layer): `setMapLayer()`.
- [Grid & bearing](grid-bearing.md): distance and bearing between locators.
