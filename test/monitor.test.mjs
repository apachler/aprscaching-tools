// SPDX-License-Identifier: MIT
// The tools that listen to heard frames: Monitor colouriser, Watch & alert, MHeard, and Station DB with the info
// responder that asks it over the bus.
import { afterEach, describe, expect, it, vi } from "vitest";
import { createBus, loadTool } from "./harness.mjs";

afterEach(() => vi.useRealTimers());

describe("monitor-colouriser", () => {
  it("colours each heard station's lines by its NAMES.GP type", async () => {
    vi.useFakeTimers();
    const t = loadTool("monitor-colouriser");
    await t.dispatch("on_frame", { peerCall: "OE8APR-9", dst: "APRS", text: "!4704.41N/01526.27E>", source: "RF" });
    await t.dispatch("on_frame", { peerCall: "OE6XRR-10", dst: "APRS", text: "!4704.41N/01526.27E&", source: "RF" });
    expect(t.state.colourRules).toEqual([]); // a burst of frames publishes once
    vi.advanceTimersByTime(1000);
    expect(t.colour({ src: "OE8APR-9", dst: "APRS" })).toBe("--st-beacon");
    expect(t.colour({ src: "OE6XRR-10" })).toMatch(/^--st-/);
    expect(t.colour({ src: "DL1ABC" })).toBeNull(); // not heard: the host's own colour stays
  });

  it("keeps one rule per station and publishes only when a type changes", async () => {
    vi.useFakeTimers();
    const t = loadTool("monitor-colouriser");
    for (let i = 0; i < 3; i++) await t.dispatch("on_frame", { peerCall: "OE8APR-9", dst: "APRS", text: "!x" });
    vi.advanceTimersByTime(1000);
    expect(t.state.colourRules.filter((r) => r.src === "OE8APR-9")).toHaveLength(1);
  });

  it("needs 'monitor' to hear frames", () => {
    expect(() => loadTool("monitor-colouriser", { permissions: [] })).toThrow(/permission 'monitor' not granted/);
  });
});

describe("watch-alert", () => {
  it("lists what it watches, records hits from any source, and colours the watched lines", async () => {
    const t = loadTool("watch-alert");
    expect(await t.run("watch")).toEqual(["Watching nothing. /watch <CALL>"]);
    expect(t.panel.nodes[0].text).toMatch(/No calls watched/);
    expect(await t.run("watch", "oe8apr")).toEqual(["Watching OE8APR."]);
    expect(await t.run("watch", "OE6XRR-9")).toEqual(["Watching OE6XRR-9."]);
    expect(await t.run("watch")).toEqual(["Watching: OE8APR OE6XRR-9"]);
    expect(t.panel.nodes[0].rows).toEqual([
      ["OE8APR", "—"],
      ["OE6XRR-9", "—"],
    ]);
    await t.dispatch("on_frame", { peerCall: "OE8APR-7", source: "APRS" }); // a base call catches every SSID
    expect(t.panel.nodes[0].rows[0]).toEqual(["OE8APR", "0s ago"]);
    expect(t.colour({ src: "OE8APR-7" })).toBe("--warn");
    expect(t.colour({ src: "OE8APR" })).toBe("--warn");
    expect(t.colour({ src: "OE6XRR-9" })).toBe("--warn");
    expect(t.colour({ src: "OE6XRR-10" })).toBeNull(); // an SSID watch catches that station only
    expect(await t.run("unwatch", "OE8APR")).toEqual(["Unwatched OE8APR."]);
    expect(t.colour({ src: "OE8APR-7" })).toBeNull();
  });
});

describe("mheard", () => {
  it("records heard stations from on_frame across sources, once each, newest first", async () => {
    const t = loadTool("mheard");
    expect(t.panel.nodes[0].text).toBe("Nothing heard yet.");
    await t.dispatch("on_frame", { peerCall: "OE8XBM-7", source: "RF" });
    await t.dispatch("on_frame", { peerCall: "oe8xbm-7", source: "RF" }); // the same station collapses
    await t.dispatch("on_frame", { peerCall: "OE1XDS-1", source: "APRS" });
    const rows = t.panel.nodes.find((n) => n.kind === "table").rows;
    expect(rows.map((r) => r[0]).sort()).toEqual(["OE1XDS-1", "OE8XBM-7"]);
    expect(rows.find((r) => r[0] === "OE1XDS-1")[1]).toBe("APRS");
    expect(rows.find((r) => r[0] === "OE8XBM-7")[1]).toBe("RF");
  });

  it("refreshes the ages on the minute tick", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-06T12:00:00Z"));
    const t = loadTool("mheard");
    await t.dispatch("on_frame", { peerCall: "OE8XBM-7", source: "RF" });
    vi.setSystemTime(new Date("2026-10-06T12:05:00Z"));
    await t.dispatch("on_tick");
    expect(t.panel.nodes[0].rows[0][2]).toBe("5m ago");
  });
});

describe("station-db and info-responder", () => {
  it("station-db publishes station.seen and answers station.type for heard stations only", async () => {
    const bus = createBus();
    const seen = [];
    bus.subscribe("station.seen", (data, from) => seen.push([from, data]));
    const db = loadTool("station-db", { bus });
    await db.dispatch("on_frame", { peerCall: "OE8XBM-1", source: "RF", text: "" });
    expect(seen).toEqual([["station-db", { call: "OE8XBM-1", type: expect.any(String), source: "RF" }]]);
    expect(await bus.call("station.type", "oe8xbm-1")).toBe(seen[0][1].type);
    expect(await bus.call("station.type", { call: "OE8XBM-1" })).toBe(seen[0][1].type);
    expect(await bus.call("station.type", "ZZ9ZZZ")).toBe("");
  });

  it("info-responder's WHOIS asks station-db over the bus; a peer reaches INFO but not /setinfo", async () => {
    const bus = createBus();
    const db = loadTool("station-db", { bus });
    const info = loadTool("info-responder", { bus });
    await db.dispatch("on_frame", { peerCall: "OE8XBM-1", source: "RF", text: "" });
    expect((await info.run("whois", "OE8XBM-1", { remote: true }))[0]).toMatch(/^OE8XBM-1: \w+$/);
    expect((await info.run("whois", "ZZ9ZZZ"))[0]).toMatch(/not heard yet/);
    expect(await info.run("whois", "")).toEqual(["Usage: WHOIS <CALL>"]);
    expect(await info.run("info", "", { remote: true })).toEqual([
      "APRScaching shack station. Type MENU for commands. 73!",
    ]);
    expect(await info.run("menu", "", { remote: true })).toEqual([
      "Commands: INFO  MENU  WHOIS <call>  GRID <loc> [loc]  CONV <n> <from> <to>",
    ]);
    expect(await info.run("setinfo", "hax", { remote: true })).toBeNull();
    expect(await info.run("setinfo", "QRV on 2m")).toEqual(["Info text updated."]);
    expect(await info.run("info", "", { remote: true })).toEqual(["QRV on 2m"]);
    expect(info.panel.nodes[1]).toEqual({ kind: "kv", key: "Peer info", value: "QRV on 2m" });
  });

  it("info-responder reads a station as not heard when no Station DB answers", async () => {
    const info = loadTool("info-responder");
    expect((await info.run("whois", "OE8XBM-1"))[0]).toMatch(/not heard yet \(enable Station DB/);
  });
});
