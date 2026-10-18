// SPDX-License-Identifier: MIT
/* global tool */
// Connect bell: rings when a station connects to this one; the operator's own outgoing connects stay quiet. It writes a notice to the tool log and shows the last connect in a
// panel; it pairs with Watch & alert.
import { utcTime } from "../../../lib/text.js";

tool.on("on_connect", (p) => {
  if (p.direction === "outgoing") return;
  const who = p.peerCall ? String(p.peerCall) : "a station";
  tool.log(`*ring* ${who} connected`);
  tool.setPanel({
    title: "Connect bell",
    nodes: [{ kind: "kv", key: "Last connect", value: `${who} at ${utcTime(Date.now())}` }],
  });
});

tool.setPanel({
  title: "Connect bell",
  nodes: [{ kind: "text", text: "Waiting for a connect...", tone: "muted" }],
});
