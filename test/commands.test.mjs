// SPDX-License-Identifier: MIT
// The command tools: CTEXT macros, Grid & bearing, Unit converter, CW encoder, Block art, Map waypoints, Away note,
// and the APRS SSID guide's panel.
import { describe, expect, it } from "vitest";
import { createBus, loadTool } from "./harness.mjs";

describe("ctext-macros", () => {
  it("answers /cq /73 /qth with their canned text, tokens left for the surface", async () => {
    const t = loadTool("ctext-macros");
    expect(t.commands().sort()).toEqual(["73", "cq", "qth"]);
    expect(await t.run("cq")).toEqual(["CQ CQ CQ de {call} k"]);
    expect(await t.run("73")).toEqual(["73 es gud dx de {call}"]);
    expect(await t.run("qth")).toEqual(["QTH is {grid}"]);
  });
  it("is operator-only: a remote peer gets no answer", async () => {
    expect(await loadTool("ctext-macros").run("cq", "", { remote: true })).toBeNull();
  });
});

describe("grid-bearing", () => {
  it("computes distance and bearing, shows the result in its panel, and answers peers", async () => {
    const t = loadTool("grid-bearing");
    const g = await t.run("grid", "JN76jx JO30", { remote: true });
    expect(g[0]).toMatch(/^JN76JX → JO30: \d+ km, bearing \d+°$/);
    expect(t.panel.nodes.map((n) => n.key)).toEqual(["JN76JX", "JO30", "Distance", "Bearing"]);
    expect(await t.run("grid", "JN76")).toEqual(["JN76 = 46.5000, 15.0000"]);
    expect(await t.run("grid", "JN76 XX99")).toEqual(["Bad locator: XX99"]);
    expect((await t.run("grid", ""))[0]).toMatch(/^Usage: grid/);
  });
});

describe("unit-convert", () => {
  it("converts the ham units and temperatures", async () => {
    const t = loadTool("unit-convert");
    expect((await t.run("conv", "100 km mi"))[0]).toMatch(/62\.14 mi/);
    expect((await t.run("conv", "0 c f"))[0]).toMatch(/32\.0 F/);
    expect((await t.run("conv", "212 f c", { remote: true }))[0]).toBe("212 F = 100.0 C");
    expect((await t.run("conv", "10 kn km/h"))[0]).toBe("10 kn = 18.52 kmh");
    expect((await t.run("conv", "1 km parsec"))[0]).toMatch(/^Can't convert km -> parsec/);
    expect((await t.run("conv", "x"))[0]).toMatch(/^Usage/);
  });
});

describe("cw-encoder", () => {
  it("encodes text to Morse", async () => {
    const t = loadTool("cw-encoder");
    expect(await t.run("cw", "SOS")).toEqual(["... --- ..."]);
    expect(await t.run("cw", "")).toEqual(["Usage: /cw <text>"]);
  });
});

describe("block-art", () => {
  it("shows the sample, renders text into a blocks panel and takes a render.blocks push", async () => {
    const bus = createBus();
    const t = loadTool("block-art", { bus });
    expect(t.panel.nodes[0].kind).toBe("blocks");
    expect(await t.run("art", "AB\\nCD")).toEqual(["Rendered."]);
    let b = t.panel.nodes[0];
    expect(b.cols).toBe(2);
    expect(b.cells.map((c) => c.ch).join("")).toBe("ABCD");
    bus.emit("render.blocks", { text: "XY" }, "another-tool");
    expect(t.panel.nodes[0].cells.map((c) => c.ch).join("")).toBe("XY");
    bus.emit(
      "render.blocks",
      {
        cols: 999,
        cells: [
          { ch: "QZ", c: 3 },
          { ch: "!", c: 99 },
        ],
      },
      "another-tool",
    );
    b = t.panel.nodes[0];
    expect(b.cols).toBe(200);
    expect(b.cells).toEqual([{ ch: "Q", c: 3 }, { ch: "!" }]);
    expect((await t.run("art", ""))[0]).toMatch(/^Rendered the sample/);
  });
});

describe("map-waypoints", () => {
  it("drops markers by locator or lat,lon and clears them", async () => {
    const t = loadTool("map-waypoints");
    expect(t.map).toBeNull();
    expect((await t.run("wp", "JN76jx home"))[0]).toMatch(/^Waypoint 1: .* \(home\)$/);
    expect(await t.run("wp", "47.07,15.44")).toEqual(["Waypoint 2: 47.0700,15.4400"]);
    expect(t.map.id).toBe("waypoints");
    expect(t.map.points.map((p) => p.label)).toEqual(["home", undefined]);
    expect(t.map.points.every((p) => p.tone === "accent")).toBe(true);
    expect(await t.run("wp", "91,0")).toEqual(["Usage: /wp <locator|lat,lon> [label]"]);
    expect(await t.run("wpclear")).toEqual(["Waypoints cleared."]);
    expect(t.map.points).toEqual([]);
  });
  it("needs 'map' for its layer", async () => {
    const t = loadTool("map-waypoints", { permissions: ["command"] });
    expect((await t.run("wp", "JN76"))[0]).toMatch(/^error: permission 'map' not granted/);
  });
});

describe("away-note", () => {
  it("lets a peer leave a note but not toggle away; greets a connect while away", async () => {
    const t = loadTool("away-note");
    expect(t.panel.nodes[0]).toEqual({ kind: "badge", text: "here", tone: "ok" });
    expect(await t.run("note", "back at 1900z", { remote: true })).toEqual(["Note saved - 73!"]);
    expect(await t.run("away", "on", { remote: true })).toBeNull();
    expect(await t.run("notes", "", { remote: true })).toBeNull();
    expect(await t.run("notes")).toEqual(["back at 1900z"]);
    const replies = [];
    await t.dispatch("on_connect", { peerCall: "OE3ABC" }, (r) => replies.push(r));
    expect(replies).toEqual([]); // not away: no greeting
    expect(await t.run("away", "QRT until Monday")).toEqual(['Away on: "QRT until Monday"']);
    expect(t.panel.nodes[0].text).toBe("AWAY");
    await t.dispatch("on_connect", { peerCall: "OE3ABC" }, (r) => replies.push(r));
    expect(replies).toEqual(["QRT until Monday Leave a note with:  NOTE <text>"]);
    expect(await t.run("away", "off")).toEqual(["Away off."]);
  });
  it("keeps the last 20 notes of 120 characters", async () => {
    const t = loadTool("away-note");
    for (let i = 0; i < 25; i++) await t.run("note", `n${i} ${"x".repeat(200)}`);
    const notes = await t.run("notes");
    expect(notes).toHaveLength(20);
    expect(notes[0].startsWith("n5 ")).toBe(true);
    expect(notes[0]).toHaveLength(120);
  });
});

describe("aprs-ssid-guide", () => {
  it("shows the SSID table", () => {
    const t = loadTool("aprs-ssid-guide");
    expect(t.panel.title).toMatch(/SSID/);
    const table = t.panel.nodes.find((n) => n.kind === "table");
    expect(table.rows.map((r) => r[0])).toEqual(["-0", "-1", "-5", "-7", "-9", "-10", "-13", "-15"]);
  });
});
