// SPDX-License-Identifier: MIT
/* global tool */
// Monitor colouriser: classifies each heard station by its NAMES.GP type (BBS, node, digi, weather, …) and colours
// its monitor lines with that type's colour token. The host colours a line from rules the tool publishes, so the
// tool keeps one exact-callsign rule per station it heard, newest last, and republishes them at most once a second.
import { StationRegistry } from "aprscaching/packages/packet/src/names.ts";
import { asStr, callOf } from "../../../lib/text.js";

/** Stations kept; the oldest goes first. The host takes up to 2000 exact-callsign rules. */
const MAX_STATIONS = 2000;
const PUBLISH_MS = 1000;

const registry = new StationRegistry();
const types = new Map(); // callsign → station type, oldest first
let timer = null;

function publish() {
  timer = null;
  tool.setColourRules([...types].map(([src, type]) => ({ src, colorVar: `--st-${type}` })));
}

tool.on("on_frame", (p) => {
  const call = callOf(p.peerCall);
  if (!call) return;
  const type = registry.classify(call, { dest: asStr(p.dst), payload: asStr(p.text) });
  if (types.get(call) === type) return;
  types.delete(call);
  types.set(call, type);
  if (types.size > MAX_STATIONS) types.delete(types.keys().next().value);
  timer ??= setTimeout(publish, PUBLISH_MS);
});
