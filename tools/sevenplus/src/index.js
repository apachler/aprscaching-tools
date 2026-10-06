// SPDX-License-Identifier: MIT
/* global register */
// 7PLUS reassembler: a decoder that reads pasted 7PLUS parts and reports the file, the parts found and the parts missing.
import { decode7plus } from "../../../lib/sevenplus.js";

register({
  decoders: [
    {
      id: "7plus",
      label: "7PLUS",
      kind: "7plus",
      decode: decode7plus,
      placeholder: "paste the 7PLUS part(s), from go_7+. to stop_7+",
    },
  ],
});
