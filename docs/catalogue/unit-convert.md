# Unit converter

The unit converter converts the units hams meet most: distances, speeds and temperatures. Connected stations may ask
it too.

## What it does

`/conv <value> <from> <to>` converts between these pairs, in either direction:

| Units | Names |
|---|---|
| kilometres and miles | `km`, `mi` |
| metres and feet | `m`, `ft` |
| metres and yards | `m`, `yd` |
| knots and kilometres an hour | `kn`, `kmh` |
| nautical miles and kilometres | `nm`, `km` |
| Celsius and Fahrenheit | `c`, `f` |

## Use it

| Command | Answer |
|---|---|
| `/conv 100 km mi` | `100 km = 62.14 mi` |
| `/conv 212 f c` | `212 F = 100.0 C` |

A connected station may send `conv <value> <from> <to>` and gets the same answer.

## Permissions

| Permission | Why |
|---|---|
| `command` | Registers `/conv` |

## Version and tool API

<!-- tool-facts -->

## Next

- [Grid & bearing](grid-bearing.md): distances between locators.
- [Tool catalogue](index.md): the other utilities.
