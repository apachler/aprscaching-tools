// SPDX-License-Identifier: MIT
/* global tool */
// Connect bell: rings when a station connects. It writes a notice to the tool log and shows the last connect in a
// panel; it pairs with Watch & alert.
import { ago } from "../../../lib/text.js";

tool.on("on_connect", (p) => {
  const who = p.peerCall ? String(p.peerCall) : "a station";
  tool.log(`*ring* ${who} connected`);
  tool.setPanel({
    title: "Connect bell",
    nodes: [{ kind: "kv", key: "Last connect", value: `${who} (${ago(Date.now())} ago)` }],
  });
});

tool.setPanel({
  title: "Connect bell",
  nodes: [{ kind: "text", text: "Waiting for a connect...", tone: "muted" }],
});
