# PSK31 + CW decoders

These decoders turn Morse and PSK31 into text. They are the decoders the app's audio caches use, for operators who
read a signal by hand or by ear.

## What it does

The tool adds two decoders to **Tools → Decode**:

| Decoder | Input | Placeholder |
|---|---|---|
| **CW (Morse)** | Dots and dashes, letters split by spaces | `…. . .-.. .-.. ---` |
| **PSK31** | Varicode bits, `0` and `1` | `00…11…00 varicode bits` |

In the Tools app, **Listen (mic)** feeds the decoders live audio through the app's own audio front-end, so a signal
from a speaker reaches them through the microphone.

## Use it

1. In **Tools → Decode**, pick **CW (Morse)** or **PSK31**.
2. Paste the code, or select **Listen (mic)** and play the signal.
3. Select **Decode**.

`.... . .-.. .-.. ---` decodes to `HELLO`.

## Permissions

| Permission | Why |
|---|---|
| `decoder` | Adds the **CW (Morse)** and **PSK31** decoders |

## Version and tool API

<!-- tool-facts -->

## Next

- [Audio caches](https://apachler.github.io/aprscaching/play/cache-types/audio/) in the aprscaching manual: where
  players meet these signals.
- [CW encoder](cw-encoder.md): the send side.
