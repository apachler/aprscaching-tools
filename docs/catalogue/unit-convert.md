# Unit converter

The unit converter converts the units hams meet most: distances, speeds and temperatures. Connected stations may ask
it too.

## What it does

`/conv <value> <from> <to>` converts between any two units of one kind:

| Kind | Names |
|---|---|
| Distance | `km`, `m`, `mi`, `ft`, `yd`, `nm` (nautical miles) |
| Speed | `kn`, `kmh` (or `km/h`) |
| Temperature | `c`, `f` |

## Use it

| Command | Answer |
|---|---|
| `/conv 100 km mi` | `100 km = 62.14 mi` |
| `/conv 212 f c` | `212 F = 100.0 C` |

A station connected to your packet terminal may send `conv <value> <from> <to>` and gets the same answer.

## Permissions

| Permission | Why |
|---|---|
| `command` | Registers `/conv` |

## Version and tool API

<!-- tool-facts -->

## Next

- [Grid & bearing](grid-bearing.md): distances between locators.
- [Tool catalogue](index.md): the other utilities.
