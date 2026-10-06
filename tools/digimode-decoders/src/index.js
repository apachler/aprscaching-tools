// SPDX-License-Identifier: MIT
/* global register */
// PSK31 + CW decoders: decode CW written as dots and dashes, and PSK31 varicode written as bits — the decoders the
// audio caches use. The app's Listen (mic) button feeds them live audio through its own front-end.
import { decodeMorse } from "aprscaching/packages/tools/src/decoders/morse.ts";
import { decodeVaricode } from "aprscaching/packages/tools/src/decoders/psk31.ts";

register({
  decoders: [
    { id: "cw", label: "CW (Morse)", kind: "cw", decode: decodeMorse, placeholder: ".... . .-.. .-.. ---" },
    { id: "psk31", label: "PSK31", kind: "psk31", decode: decodeVaricode, placeholder: "00…11…00 varicode bits" },
  ],
});
