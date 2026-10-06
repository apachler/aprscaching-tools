// SPDX-License-Identifier: MIT
/* global register */
// CW encoder: /cw <text> answers with the text in Morse (dots and dashes), the send-side companion of the CW decoder.
import { encodeMorse } from "aprscaching/packages/tools/src/decoders/morse.ts";

register({
  commands: {
    cw: (args) => {
      const t = args.trim();
      return t ? [encodeMorse(t)] : ["Usage: /cw <text>"];
    },
  },
});
