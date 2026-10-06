// SPDX-License-Identifier: MIT
// The packet decoder's core: a raw TNC2 monitor line or APRS-IS line in, the AX.25 header and every APRS field it
// carries out. It runs the same pure parser the aprscaching gateway ingests with, so it decodes with no network.
import { classifyQ, decodeAprs, parseTNC2 } from "aprscaching/packages/aprs/src/index.ts";

/** A line to try the decoder on: a mobile position heard on RF and gated by OE8XXX. */
export const PACKET_SAMPLE = "OE8APR-9>APRS,WIDE1-1,qAR,OE8XXX:!4704.41N/01526.27E>088/036/A=001234Mobile";

/** Decode one raw line (the first non-empty line of `input`): `{ ok, frame, data }` or `{ ok: false, error }`. */
export function decodeAprsLine(input) {
  const raw =
    String(input)
      .split(/\r?\n/)
      .find((l) => l.trim())
      ?.trim() ?? "";
  if (!raw) return { ok: false, error: "Paste a raw TNC2 or APRS-IS line." };
  const frame = parseTNC2(raw);
  if (!frame) return { ok: false, error: "Not a TNC2 line: expected SOURCE>DEST,PATH:payload." };
  const q = classifyQ(frame.path);
  const data = decodeAprs(frame);
  return {
    ok: true,
    frame: {
      src: frame.src,
      dst: frame.dst,
      path: frame.path,
      payload: frame.payload,
      heardVia: q.heardVia,
      ...(q.igateCall ? { igateCall: q.igateCall } : {}),
    },
    data,
  };
}

/** The decoded APRS fields as display strings, `kind` left out (a view shows it as the heading). */
export function aprsFields(data) {
  const out = [];
  for (const [k, v] of Object.entries(data)) {
    if (k === "kind" || v == null) continue;
    if (typeof v === "object") {
      const str = (x) => (typeof x === "string" ? x : "");
      if (k === "symbol" && typeof v.label === "string") {
        out.push([k, `${v.label} (${str(v.table)}${str(v.code)})`]);
        continue;
      }
      out.push([k, JSON.stringify(v)]);
    } else out.push([k, typeof v === "string" ? v : JSON.stringify(v)]);
  }
  return out;
}

/** The decode as plain text, one field per line. */
export function decodeAprsText(input) {
  const r = decodeAprsLine(input);
  if (!r.ok) return r.error;
  const { frame, data } = r;
  return [
    `${frame.src} > ${frame.dst} via ${frame.path.join(",") || "(no path)"}`,
    `heard via: ${frame.heardVia}${frame.igateCall ? ` (${frame.igateCall})` : ""}`,
    `type: ${data.kind}`,
    ...aprsFields(data).map(([k, v]) => `${k}: ${v}`),
  ].join("\n");
}
