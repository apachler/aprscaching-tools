// SPDX-License-Identifier: MIT
// The tools that answer connected sessions, transmit or run on the minute tick: Auto-responder, Connect bell, Link
// ping, Scheduled query, Auto-status and the Beacon scheduler.
import { describe, expect, it } from "vitest";
import { createBus, loadTool } from "./harness.mjs";

describe("auto-responder", () => {
  it("greets an incoming connect by callsign through the session's reply", async () => {
    const t = loadTool("auto-responder");
    const replies = [];
    await t.dispatch("on_connect", { surface: "bbs", peerCall: "OE3ABC", myCall: "OE8APR-1" }, (r) => replies.push(r));
    expect(replies).toEqual(["Welcome OE3ABC - this is OE8APR-1 auto-responder. Type H for help."]);
    await t.dispatch("on_connect", {}, (r) => replies.push(r));
    expect(replies[1]).toBe("Welcome - this is an APRScaching auto-responder. Type H for help.");
  });
  it("stays quiet when the surface offers no reply", async () => {
    await expect(loadTool("auto-responder").dispatch("on_connect", { peerCall: "OE3ABC" })).resolves.toBeUndefined();
  });
});

describe("connect-bell", () => {
  it("rings in the log and shows the last connect", async () => {
    const t = loadTool("connect-bell");
    expect(t.panel.nodes[0].text).toMatch(/Waiting for a connect/);
    await t.dispatch("on_connect", { peerCall: "OE3ABC" });
    expect(t.state.logs).toEqual(["*ring* OE3ABC connected"]);
    expect(t.panel.nodes[0]).toEqual({ kind: "kv", key: "Last connect", value: expect.stringMatching(/^OE3ABC at \d\d:\d\dZ$/) });
  });
});

describe("link-ping", () => {
  it("keeps rolling RTT samples from link.rtt and asks for a ping with /ping", async () => {
    const bus = createBus();
    const requests = [];
    bus.subscribe("link.ping.request", (d, from) => requests.push(from));
    const t = loadTool("link-ping", { bus });
    expect(t.panel.nodes[0].text).toMatch(/No samples/);
    bus.emit("link.rtt", { ms: 120 }, "(host)");
    bus.emit("link.rtt", { ms: 80 }, "(host)");
    bus.emit("link.rtt", { ms: -5 }, "(host)"); // ignored
    expect(t.panel.nodes).toEqual([
      { kind: "kv", key: "Last", value: "80 ms" },
      { kind: "kv", key: "Avg", value: "100 ms" },
      { kind: "kv", key: "Samples", value: "2" },
    ]);
    expect(await t.run("ping")).toEqual(["Ping requested (the terminal times the round-trip)."]);
    expect(requests).toEqual(["link-ping"]);
  });
});

describe("sched-query", () => {
  it("reports when no packet TNC offers session.script, and hands it the parsed steps once one does", async () => {
    const bus = createBus();
    const t = loadTool("sched-query", { bus });
    expect((await t.run("gpauto", "connect HB9W-8; send sh/dx; disconnect"))[0]).toMatch(/Open the packet TNC/);
    let got = null;
    bus.provide("session.script", (a) => {
      got = a;
      return { ok: true };
    });
    expect((await t.run("gpauto", "connect HB9W-8; send sh/dx; disconnect"))[0]).toBe("Running 3 steps…");
    expect(got.steps).toHaveLength(3);
    expect(await t.run("gpauto")).toEqual(["Script set (3 steps). /gpauto run"]);
    expect(await t.run("gpauto", "run")).toEqual(["Running 3 steps…"]);
  });

  it("says why a session.script refusal stopped it", async () => {
    const bus = createBus();
    bus.provide("session.script", () => {
      throw new Error("service \"session.script\" needs the 'tx' permission");
    });
    const t = loadTool("sched-query", { bus });
    expect((await t.run("gpauto", "connect HB9W-8"))[0]).toMatch(/^Refused: .*'tx' permission/);
  });

  it("runs a scheduled script on every Nth minute tick, and renders the terminal's progress", async () => {
    const bus = createBus();
    let runs = 0;
    bus.provide("session.script", () => {
      runs++;
      return { ok: true };
    });
    const t = loadTool("sched-query", { bus });
    expect(t.panel.nodes[0].text).toMatch(/^Idle/);
    expect((await t.run("gpauto", "every 2 connect HB9W-8; disconnect"))[0]).toBe(
      "Scheduled every 10 min. Running 2 steps…", // 10 minutes at the least
    );
    for (let i = 0; i < 20; i++) await t.dispatch("on_tick");
    expect(runs).toBe(3); // at once, then on ticks 10 and 20
    expect(t.state.logs).toEqual(["scheduled run: Running 2 steps…", "scheduled run: Running 2 steps…"]);
    bus.emit("session.progress", { status: "done", step: 2, total: 2, captured: ["DX de OE8APR"], note: "ok" }, "(host)");
    expect(t.panel.nodes[0]).toEqual({ kind: "kv", key: "Status", value: "done (2/2)", tone: "ok" });
    expect(t.panel.nodes.at(-1)).toEqual({ kind: "text", text: "DX de OE8APR" });
    expect(await t.run("gpauto", "off")).toEqual(["Scheduled query off."]);
  });

  it("logs a scheduled run the terminal refuses, and arms no schedule without steps", async () => {
    const bus = createBus();
    let refuse = false;
    bus.provide("session.script", () => {
      if (refuse) throw new Error("over the transmit budget");
      return { ok: true };
    });
    const t = loadTool("sched-query", { bus });
    expect((await t.run("gpauto", "every 10"))[0]).toMatch(/^No steps/);
    expect((await t.run("gpauto", "every 10 bogus"))[0]).toMatch(/^No steps/);
    for (let i = 0; i < 10; i++) await t.dispatch("on_tick");
    expect(t.state.logs).toEqual([]);
    await t.run("gpauto", "every 10 connect HB9W-8");
    refuse = true;
    for (let i = 0; i < 10; i++) await t.dispatch("on_tick");
    expect(t.state.logs).toEqual(["scheduled run: Refused: over the transmit budget"]);
  });
});

describe("auto-status", () => {
  it("transmits the status as an APRS status packet every N minute ticks, 10 or more", async () => {
    const t = loadTool("auto-status");
    expect(await t.run("autostatus", "2 QRV on 2m")).toEqual(['Auto-status every 10 min: "QRV on 2m" (TX-gated).']);
    expect(await t.run("autostatus", "12 QRV on 2m")).toEqual(['Auto-status every 12 min: "QRV on 2m" (TX-gated).']);
    for (let i = 0; i < 11; i++) await t.dispatch("on_tick");
    expect(t.state.txs).toEqual([]);
    await t.dispatch("on_tick");
    expect(t.state.txs).toEqual([">QRV on 2m"]);
    expect(t.state.logs).toEqual(["auto-status sent"]);
    expect(await t.run("autostatus", "off")).toEqual(["Auto-status off."]);
    await t.dispatch("on_tick");
    await t.dispatch("on_tick");
    expect(t.state.txs).toHaveLength(1);
  });
  it("stops on OFF in any case, and answers its usage without a number first", async () => {
    const t = loadTool("auto-status");
    await t.run("autostatus", "10 QRV");
    expect(await t.run("autostatus", "OFF")).toEqual(["Auto-status off."]);
    expect(await t.run("autostatus", "QRV on 144.800")).toEqual(["Usage: /autostatus <minutes> <text>  |  /autostatus off"]);
    expect(await t.run("autostatus", "")).toEqual(["Usage: /autostatus <minutes> <text>  |  /autostatus off"]);
    for (let i = 0; i < 20; i++) await t.dispatch("on_tick");
    expect(t.state.txs).toEqual([]);
  });
  it("logs a held status when the host's gate refuses it", async () => {
    const t = loadTool("auto-status", { tx: () => false });
    await t.run("autostatus", "10");
    for (let i = 0; i < 10; i++) await t.dispatch("on_tick");
    expect(t.state.txs).toEqual([">APRScaching"]);
    expect(t.state.logs).toEqual(["auto-status held (TX gate closed)"]);
  });
});

describe("beacon-scheduler", () => {
  it("schedules a beacon of at least 10 minutes and ends it with /beacon off", async () => {
    const t = loadTool("beacon-scheduler");
    expect(await t.run("beacon", "30 test")).toEqual(["Beacon scheduled every 30 min."]);
    expect(t.state.beacons.at(-1)).toEqual({ comment: "test", intervalSec: 1800 });
    expect(await t.run("beacon", "1 fast")).toEqual(["Beacon scheduled every 10 min."]);
    expect(t.state.beacons.at(-1)).toEqual({ comment: "fast", intervalSec: 600 });
    expect(await t.run("beacon", "2000 daily")).toEqual(["Beacon scheduled every 1440 min."]);
    expect(t.state.beacons.at(-1)).toEqual({ comment: "daily", intervalSec: 86400 });
    expect(await t.run("beacon", "60")).toEqual(["Beacon scheduled every 60 min."]);
    expect(t.state.beacons.at(-1)).toEqual({ comment: "APRScaching", intervalSec: 3600 });
    expect(await t.run("beacon", "off")).toEqual(["Beacon off."]);
    expect(t.state.beacons.at(-1)).toBeNull();
  });
  it("answers its usage, and schedules nothing, without a number first", async () => {
    const t = loadTool("beacon-scheduler");
    expect(await t.run("beacon", "")).toEqual(["Usage: /beacon <minutes> <comment>  |  /beacon off"]);
    expect(await t.run("beacon", "of")).toEqual(["Usage: /beacon <minutes> <comment>  |  /beacon off"]);
    expect(t.state.beacons).toEqual([]);
  });
  it("says why the host refused a beacon", async () => {
    const t = loadTool("beacon-scheduler", {
      beacon: (spec) => {
        if (spec) throw new Error("transmit needs a control-verified callsign and this tab's transmit consent");
      },
    });
    expect(await t.run("beacon", "30 test")).toEqual([
      "Beacon refused: transmit needs a control-verified callsign and this tab's transmit consent.",
    ]);
  });
});
