# PSK31 + CW decoders

The CW and PSK31 decoders the audio caches use: CW written as dots and dashes, PSK31 written as varicode bits. In the Tools app, **Listen (mic)** feeds them live audio through the app's own audio front-end.

## Use it

- In **Tools → Decode**, pick **CW (Morse)** or **PSK31** and paste the code, or listen with the microphone.

It shows on: web.

## Permissions

| Permission | Why |
|---|---|
| `decoder` | Adds the **CW (Morse)** and **PSK31** decoders |

## Source

`src/index.js` is the source. `tool.js` is built from it, from `lib/` and from the MIT libraries of the APRScaching
repository at the commit `lib.lock` pins (`node scripts/build.mjs`); CI checks that the committed `tool.js` matches a
fresh build.

## Signature

Signed by OE8APR's author key, the key in `tool.json`'s `pubkey`. The maintainer signs it again at each release that
changes it, and the registry lists it with that key.

## Licence

MIT, as the `SPDX-License-Identifier` line in each file states.
