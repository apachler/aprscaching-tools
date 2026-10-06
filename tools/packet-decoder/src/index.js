// SPDX-License-Identifier: MIT
/* global register, tool */
// Packet decoder: paste a raw TNC2 or APRS-IS line and see every field it carries. The decoder answers with a short
// summary, and the panel shows the decode as fields: the AX.25 header, how the line arrived, the packet type and
// each APRS field. It runs the same pure parser the APRScaching gateway ingests with, so it decodes offline.
import { aprsFields, decodeAprsLine, PACKET_SAMPLE } from "../../../lib/aprs-decode.js";

const VIA = {
  rf: { text: "RF", tone: "ok" },
  aprs_is: { text: "APRS-IS", tone: "muted" },
};

function show(r) {
  if (!r.ok) {
    tool.setPanel({ title: "Packet decoder", nodes: [{ kind: "text", text: r.error, tone: "bad" }] });
    return r.error;
  }
  const { frame, data } = r;
  const via = VIA[frame.heardVia] ?? { text: String(frame.heardVia), tone: "default" };
  const fields = aprsFields(data);
  tool.setPanel({
    title: "Packet decoder",
    nodes: [
      { kind: "kv", key: "Source", value: frame.src, tone: "accent" },
      { kind: "kv", key: "Destination", value: frame.dst },
      { kind: "kv", key: "Path", value: frame.path.join(" · ") || "(no path)" },
      { kind: "kv", key: "Heard via", value: frame.igateCall ? `${via.text} (${frame.igateCall})` : via.text },
      { kind: "badge", text: String(data.kind), tone: via.tone },
      ...(fields.length ? [{ kind: "table", head: ["Field", "Value"], rows: fields }] : []),
    ],
  });
  return `${frame.src} > ${frame.dst}: ${data.kind}, ${fields.length} field${fields.length === 1 ? "" : "s"} in the Packet decoder panel.`;
}

tool.setPanel({
  title: "Packet decoder",
  nodes: [{ kind: "text", text: "Paste a raw TNC2 or APRS-IS line into Decode.", tone: "muted" }],
});

register({
  decoders: [
    {
      id: "aprs",
      label: "APRS packet",
      kind: "aprs",
      decode: (input) => show(decodeAprsLine(input)),
      sample: PACKET_SAMPLE,
      placeholder: "paste a raw TNC2 / APRS-IS line…",
    },
  ],
});
