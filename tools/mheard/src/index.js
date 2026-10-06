// SPDX-License-Identifier: MIT
/* global tool */
// MHeard: a rolling list of recently heard stations, from every source that feeds heard frames (the packet
// terminal's RF, the live APRS layer, …), with the source each was last heard on. A burst of frames redraws the
// panel once, a second later; the ages refresh every minute.
import { ago, asStr, callOf } from "../../../lib/text.js";

const SHOWN = 14;
const KEPT = 500;
const REDRAW_MS = 1000;
const heard = new Map(); // callsign → { ts, src }, least recent first
let timer = null;

function rebuild() {
  clearTimeout(timer);
  timer = null;
  const rows = [...heard]
    .sort((a, b) => b[1].ts - a[1].ts)
    .slice(0, SHOWN)
    .map(([call, h]) => [call, h.src || "—", `${ago(h.ts)} ago`]);
  tool.setPanel({
    title: "MHeard",
    nodes: rows.length
      ? [{ kind: "table", head: ["Station", "Src", "Heard"], rows }]
      : [{ kind: "text", text: "Nothing heard yet.", tone: "muted" }],
  });
}

tool.on("on_frame", (p) => {
  const call = callOf(p.peerCall);
  if (!call) return;
  heard.delete(call);
  heard.set(call, { ts: Date.now(), src: asStr(p.source) });
  if (heard.size > KEPT) heard.delete(heard.keys().next().value);
  timer ??= setTimeout(rebuild, REDRAW_MS);
});
tool.on("on_tick", rebuild);
rebuild();
