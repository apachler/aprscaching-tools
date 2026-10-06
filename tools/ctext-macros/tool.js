// SPDX-License-Identifier: MIT
// CTEXT macro pack 1.0.0, built by scripts/build.mjs from tools/ctext-macros/src, lib/ and the
// aprscaching libraries at 32b5862c5c03ef1e4eda02611bf2ab1c8712a810 (lib.lock). Edit the sources, not this file.
(() => {
  // tools/ctext-macros/src/index.js
  var MACROS = {
    cq: "CQ CQ CQ de {call} k",
    73: "73 es gud dx de {call}",
    qth: "QTH is {grid}"
  };
  register({ commands: Object.fromEntries(Object.entries(MACROS).map(([word, text]) => [word, () => [text]])) });
})();
