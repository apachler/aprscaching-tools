// SPDX-License-Identifier: MIT
/* global register */
// CTEXT macro pack: /cq, /73 and /qth answer with canned text. The `{call}` and `{grid}` tokens stay in the text;
// the surface that sends it expands them with the station's own values.

const MACROS = {
  cq: "CQ CQ CQ de {call} k",
  73: "73 es gud dx de {call}",
  qth: "QTH is {grid}",
};

register({ commands: Object.fromEntries(Object.entries(MACROS).map(([word, text]) => [word, () => [text]])) });
