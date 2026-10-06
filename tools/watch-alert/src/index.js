// SPDX-License-Identifier: MIT
/* global register, tool */
// Watch & alert: /watch a callsign, and the tool records when it is heard (from every source that feeds heard
// frames, so it works whichever surface is open), lists the hits in a panel and colours its monitor lines. Watching
// a base call (OE8APR) also catches every SSID of it (OE8APR-9); watching OE8APR-9 catches that station only.
import { ago, callOf } from "../../../lib/text.js";

const watched = new Set(); // in the order they were added
const hits = new Map(); // watched entry → when it was last heard

const base = (call) => call.split("-")[0];
/** The watched entry a heard callsign matches: the call itself, else its base call; null when not watched. */
const match = (call) => (watched.has(call) ? call : watched.has(base(call)) ? base(call) : null);

function rebuild() {
  const rows = [...watched].map((c) => [c, hits.has(c) ? `${ago(hits.get(c))} ago` : "—"]);
  tool.setPanel({
    title: "Watch",
    nodes: rows.length
      ? [{ kind: "table", head: ["Call", "Last heard"], rows }]
      : [{ kind: "text", text: "No calls watched — /watch <CALL>", tone: "muted" }],
  });
  tool.setColourRules(
    [...watched].flatMap((c) =>
      c.includes("-")
        ? [{ src: c, colorVar: "--warn" }]
        : [
            { src: c, colorVar: "--warn" },
            { srcPrefix: `${c}-`, colorVar: "--warn" },
          ],
    ),
  );
}

register({
  commands: {
    watch: (args) => {
      const c = callOf(args);
      if (!c) return [watched.size ? `Watching: ${[...watched].join(" ")}` : "Watching nothing. /watch <CALL>"];
      watched.add(c);
      rebuild();
      return [`Watching ${c}.`];
    },
    unwatch: (args) => {
      const c = callOf(args);
      watched.delete(c);
      hits.delete(c);
      rebuild();
      return [`Unwatched ${c}.`];
    },
  },
});

tool.on("on_frame", (p) => {
  const hit = match(callOf(p.peerCall));
  if (!hit) return;
  hits.set(hit, Date.now());
  rebuild();
});

rebuild();
