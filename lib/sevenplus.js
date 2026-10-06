// SPDX-License-Identifier: MIT
// A tolerant 7PLUS parser. 7PLUS was the packet-BBS way to move binary files as 7-bit text split across numbered
// message parts. This recognises the `go_7+.` / `stop_7+` markers and the part headers (`go_7+. 001 of 002 NAME` or
// `part N of M`), and reports the file, the parts found and the parts still missing, so scattered parts can be
// collected. It does not rebuild the binary.

/** A 7PLUS part header: `go_7+. 001 of 002 TEST.ZIP …`, the part, the number of parts and the file. */
const HEADER = /go_7\+\.?[ \t]+(\d{1,3})[ \t]+of[ \t]+(\d{1,3})(?:[ \t]+([\w.-]{1,64}))?/gi;
/** The `part N of M` form some BBSes put in the subject instead. */
const PART = /part[ \t]+(\d{1,3})[ \t]+of[ \t]+(\d{1,3})/gi;

/**
 * A summary of the 7PLUS text in `input`: markers, the parts found and of how many, the file name, the encoded lines,
 * and which parts are still missing. Every part header in the input counts, so several pasted parts are checked
 * together.
 */
export function decode7plus(input) {
  const text = String(input);
  const lines = text.split(/\r?\n/);
  const starts = lines.filter((l) => /go_7\+/i.test(l)).length;
  const stops = lines.filter((l) => /stop_7\+/i.test(l)).length;
  if (starts === 0) return "No 7plus block found — expected a 'go_7+.' header line.";

  const parts = new Set();
  let total = 0;
  let named = null;
  for (const m of [...text.matchAll(HEADER), ...text.matchAll(PART)]) {
    const n = Number(m[1]);
    const of = Number(m[2]);
    if (n < 1 || of < 1 || n > of) continue;
    parts.add(n);
    total = Math.max(total, of);
    named ??= m[3] ?? null;
  }
  const file = named ?? fileNameBefore(text, /go_7\+/gi) ?? fileNameBefore(text, /part\s+\d/gi);
  const body = lines.filter((l) => l.trim() && !/go_7\+|stop_7\+|part\s+\d+\s+of/i.test(l));
  const missing = [];
  for (let i = 1; i <= total; i++) if (!parts.has(i)) missing.push(i);
  const closed = stops >= starts;
  const complete = closed && missing.length === 0;

  return [
    `7plus block — ${starts} start / ${stops} stop marker(s)`,
    total ? `part(s) ${[...parts].sort((a, b) => a - b).join(", ")} of ${total}` : "single part",
    `file: ${file ?? "(unknown)"}`,
    `${body.length} encoded lines (${body.join("").length} chars)`,
    complete
      ? "status: complete"
      : missing.length
        ? `status: incomplete — missing part(s) ${missing.join(", ")}`
        : "status: incomplete — a part has no stop_7+ line",
  ].join("\n");
}

const isWord = (c) => c !== undefined && /\w/.test(c);
const isSpace = (c) => c !== undefined && /\s/.test(c);

/**
 * The first `name.ext` (name of word characters and '-', extension of 1–4 word characters) that is followed by
 * whitespace and then a match of `marker` (a global pattern). Found by walking back from each marker, which stays
 * linear on a crafted line; a single leftmost-match pattern over the whole input would retry the long name run from
 * every start position.
 */
function fileNameBefore(input, marker) {
  for (const m of input.matchAll(marker)) {
    let i = m.index;
    const spaceEnd = i;
    while (isSpace(input[i - 1])) i--;
    if (i === spaceEnd) continue;
    const extEnd = i;
    while (isWord(input[i - 1])) i--;
    const extLen = extEnd - i;
    if (extLen < 1 || extLen > 4 || input[i - 1] !== ".") continue;
    const nameEnd = i - 1;
    i = nameEnd;
    while (isWord(input[i - 1]) || input[i - 1] === "-") i--;
    if (i === nameEnd) continue;
    return input.slice(i, extEnd);
  }
  return null;
}
