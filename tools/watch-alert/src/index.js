// SPDX-License-Identifier: MIT
/* global register, tool */
// Watch & alert: /watch a callsign, and the tool records when it is heard (from every source that feeds heard
// frames, so it works whichever surface is open), lists the hits in a panel and colours its monitor lines. Watching
// a base call (OE8APR) also catches every SSID of it (OE8APR-9); watching OE8APR-9 catches that station only. A hit
// goes to the tool log when the call had not been heard for ten minutes, so a busy station logs once, not per frame.
import { callOf, utcTime } from "../../../lib/text.js";

const QUIET_MS = 10 * 60 * 1000;

const watched = new Set(); // in the order they were added
const hits = new Map(); // watched entry → when it was last heard

const base = (call) => call.split("-")[0];
/** The callsigns in a command's arguments, separated by spaces or commas. */
const calls = (args) => String(args).split(/[\s,]+/).map(callOf).filter(Boolean);
/** The watched entry a heard callsign matches: the call itself, else its base call; null when not watched. */
const match = (call) => (watched.has(call) ? call : watched.has(base(call)) ? base(call) : null);

function rebuild() {
  const rows = [...watched].map((c) => [c, hits.has(c) ? utcTime(hits.get(c)) : "—"]);
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
      const cs = calls(args);
      if (!cs.length) return [watched.size ? `Watching: ${[...watched].join(" ")}` : "Watching nothing. /watch <CALL>"];
      for (const c of cs) watched.add(c);
      rebuild();
      return [`Watching ${cs.join(" ")}.`];
    },
    unwatch: (args) => {
      const cs = calls(args);
      if (!cs.length) return ["Usage: /unwatch <CALL> [CALL …]"];
      for (const c of cs) {
        watched.delete(c);
        hits.delete(c);
      }
      rebuild();
      return [`Unwatched ${cs.join(" ")}.`];
    },
  },
});

tool.on("on_frame", (p) => {
  const hit = match(callOf(p.peerCall));
  if (!hit) return;
  const now = Date.now();
  if (!hits.has(hit) || now - hits.get(hit) >= QUIET_MS) tool.log(`heard ${callOf(p.peerCall)} (watching ${hit})`);
  hits.set(hit, now);
  rebuild();
});

rebuild();
