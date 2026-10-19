// SPDX-License-Identifier: MIT
/* global tool */
// Station DB (NAMES.GP): classifies every station it hears and shares that on the tool bus. It publishes
// `station.seen` { call, type, source } for a heard station and answers the `station.type` service with a heard
// station's type ("" for one it has not heard). It shows nothing itself; other tools (Station log, the info
// responder) read the bus.
//
// The app drops a tool's messages beyond 200 a second, so a busy feed is coalesced: a station is published again
// only when its type or source changes or SEEN_EVERY_MS has passed, and at most PER_SECOND stations a second, which
// leaves the rest of the budget to the station.type answers. A station held back by the second's cap is published
// the next time it is heard.
import { StationRegistry } from "aprscaching/packages/packet/src/names.ts";
import { asStr, callOf } from "../../../lib/text.js";

const KEPT = 5000;
const SEEN_EVERY_MS = 30_000;
const PER_SECOND = 100;
const registry = new StationRegistry();
const heard = new Map(); // callsign → { type, told }, least recent first; told is the last station.seen published
let second = 0;
let sent = 0;

tool.on("on_frame", (p) => {
  const call = callOf(p.peerCall);
  if (!call) return;
  const type = registry.classify(call, { dest: asStr(p.dst), payload: asStr(p.text) });
  const now = Date.now();
  let told = heard.get(call)?.told;
  heard.delete(call);
  const fresh = told && told.type === type && told.source === p.source && now - told.at < SEEN_EVERY_MS;
  if (!fresh) {
    if (now - second >= 1000) [second, sent] = [now, 0];
    if (sent < PER_SECOND) {
      sent++;
      told = { type, source: p.source, at: now };
      tool.emit("station.seen", { call, type, source: p.source });
    }
  }
  heard.set(call, { type, told });
  if (heard.size > KEPT) heard.delete(heard.keys().next().value);
});

tool.provide("station.type", (arg) => heard.get(callOf(typeof arg === "string" ? arg : arg?.call))?.type ?? "");
