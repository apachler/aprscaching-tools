// SPDX-License-Identifier: MIT
/* global tool */
// Station DB (NAMES.GP): classifies every station it hears and shares that on the tool bus. It publishes
// `station.seen` { call, type, source } for each heard frame and answers the `station.type` service with a heard
// station's type ("" for one it has not heard). It shows nothing itself; other tools (Station log, the info
// responder) read the bus.
import { StationRegistry } from "aprscaching/packages/packet/src/names.ts";
import { asStr, callOf } from "../../../lib/text.js";

const KEPT = 5000;
const registry = new StationRegistry();
const heard = new Map(); // callsign → station type, least recent first

tool.on("on_frame", (p) => {
  const call = callOf(p.peerCall);
  if (!call) return;
  const type = registry.classify(call, { dest: asStr(p.dst), payload: asStr(p.text) });
  heard.delete(call);
  heard.set(call, type);
  if (heard.size > KEPT) heard.delete(heard.keys().next().value);
  tool.emit("station.seen", { call, type, source: p.source });
});

tool.provide("station.type", (arg) => heard.get(callOf(typeof arg === "string" ? arg : arg?.call)) ?? "");
