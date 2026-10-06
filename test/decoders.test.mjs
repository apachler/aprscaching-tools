// SPDX-License-Identifier: MIT
// The decoder tools: 7PLUS, PSK31 + CW, and the packet decoder; and the 7PLUS parser's linear-time scan.
import { describe, expect, it } from "vitest";
import { loadTool } from "./harness.mjs";
import { decode7plus } from "../lib/sevenplus.js";
import { encodeVaricode } from "../vendor/aprscaching/packages/tools/src/decoders/psk31.ts";

describe("sevenplus", () => {
  it("summarises a 7PLUS block", async () => {
    const t = loadTool("sevenplus");
    const out = await t.decode("7plus", "file.zip part 1 of 3\ngo_7+. abcd\nQUJD\nstop_7+");
    expect(out).toMatch(/part\(s\) 1 of 3/);
    expect(out).toMatch(/missing part\(s\) 2, 3/);
    expect(await t.decode("7plus", "nothing here")).toMatch(/No 7plus block/);
  });

  it("reads real part headers and collects every pasted part", () => {
    const part = (n, of) => ` go_7+. ${String(n).padStart(3, "0")} of ${String(of).padStart(3, "0")} TEST.ZIP 0012345 FFFF (7PLUS v2.2)\nQUJD\n stop_7+. (TEST.P0${n}/7F)`;
    const one = decode7plus(part(1, 2));
    expect(one).toMatch(/part\(s\) 1 of 2/);
    expect(one).toMatch(/file: TEST\.ZIP/);
    expect(one).toMatch(/missing part\(s\) 2/);
    expect(decode7plus(part(3, 3))).toMatch(/missing part\(s\) 1, 2/); // the last part alone is not the file
    const both = decode7plus(`${part(1, 2)}\n${part(2, 2)}`);
    expect(both).toMatch(/part\(s\) 1, 2 of 2/);
    expect(both).toMatch(/status: complete/);
    expect(decode7plus(" go_7+. 001 of 001 A.ZIP\nQUJD")).toMatch(/no stop_7\+ line/);
  });
});

describe("the 7PLUS file name scan", () => {
  // The decoder reads text pasted from or received over the air: a long crafted line must parse in linear time.
  const N = 200_000;
  const timed = (fn) => {
    const t0 = performance.now();
    const value = fn();
    return { value, ms: performance.now() - t0 };
  };
  it("a long run of '-' before the marker parses fast", () => {
    const { value, ms } = timed(() => decode7plus("-".repeat(N) + " go_7+."));
    expect(ms).toBeLessThan(1000);
    expect(value).toContain("file: (unknown)");
  });
  it("a long word without a marker parses fast", () => {
    const { value, ms } = timed(() => decode7plus(" go_7+.\n" + "a-".repeat(N)));
    expect(ms).toBeLessThan(1000);
    expect(value).toContain("file: (unknown)");
  });
  it("keeps the file-name semantics", () => {
    const file = (s) => /file: (.*)/.exec(decode7plus(s))[1];
    expect(file(" go_7+. 001 of 002 TEST.ZIP 0012345 FFFF (7PLUS v2.2)")).toBe("TEST.ZIP");
    expect(file("my-file.zip go_7+. part 1 of 1")).toBe("my-file.zip");
    expect(file("x.y.zip go_7+.")).toBe("y.zip");
    expect(file("a.toolong go_7+.")).toBe("(unknown)");
    expect(file("a.b\n\n GO_7+.")).toBe("a.b");
    expect(file("go_7+.\nfoo.7pl part 3 of 5")).toBe("foo.7pl");
    expect(file("x.a go_7+. y.b go_7+.")).toBe("x.a");
    expect(file("x.toolong go_7+. y.b go_7+.")).toBe("y.b");
    expect(file("go_7+. x.a part 1 of 2 y.b go_7+.")).toBe("y.b");
  });
});

describe("digimode-decoders", () => {
  it("contributes the CW and PSK31 decoders", async () => {
    const t = loadTool("digimode-decoders");
    expect(t.state.decoderMeta.map((d) => d.id)).toEqual(["cw", "psk31"]);
    expect(await t.decode("cw", ".... . .-.. .-.. ---")).toBe("HELLO");
    expect(await t.decode("cw", "-.-. --.-  -.. .")).toBe("CQ DE");
    expect(await t.decode("psk31", encodeVaricode("cq de oe8apr 73"))).toBe("cq de oe8apr 73");
    expect(t.state.decoderMeta.every((d) => d.placeholder)).toBe(true);
    expect(await t.decode("cw", t.state.decoderMeta[0].placeholder)).toBe("HELLO"); // the example decodes
  });
});

describe("packet-decoder", () => {
  const LINE = "OE8APR-9>APRS,WIDE1-1,qAR,OE8XXX:!4704.41N/01526.27E>088/036/A=001234Mobile";

  it("offers a sample and decodes it into a summary and a panel of fields", async () => {
    const t = loadTool("packet-decoder");
    const meta = t.state.decoderMeta[0];
    expect(meta).toMatchObject({ id: "aprs", label: "APRS packet", kind: "aprs", sample: LINE });
    expect(t.panel.nodes[0].text).toMatch(/Paste a raw TNC2/);
    const out = await t.decode("aprs", meta.sample);
    expect(out).toMatch(/^OE8APR-9 > APRS: position, \d+ fields in the Packet decoder panel\.$/);
    const kv = Object.fromEntries(t.panel.nodes.filter((n) => n.kind === "kv").map((n) => [n.key, n.value]));
    expect(kv).toEqual({
      Source: "OE8APR-9",
      Destination: "APRS",
      Path: "WIDE1-1 · qAR · OE8XXX",
      "Heard via": "RF (OE8XXX)",
    });
    expect(t.panel.nodes.find((n) => n.kind === "badge")).toEqual({ kind: "badge", text: "position", tone: "ok" });
    const fields = Object.fromEntries(t.panel.nodes.find((n) => n.kind === "table").rows);
    expect(Number(fields.lat)).toBeCloseTo(47.0735, 3);
    expect(fields.symbol).toMatch(/\(\/>\)$/);
  });

  it("says what is wrong with a line that is not TNC2", async () => {
    const t = loadTool("packet-decoder");
    expect(await t.decode("aprs", "not a frame")).toMatch(/^Not a TNC2 line/);
    expect(t.panel.nodes[0]).toMatchObject({ kind: "text", tone: "bad" });
    expect(await t.decode("aprs", "  \n ")).toMatch(/^Paste/);
  });
});
