// SPDX-License-Identifier: MIT
/* global register, tool */
// Away note: while the operator is away, a connecting peer is told so and may leave a short note with NOTE <text>.
// The notes stay in this page, at most 20 of 120 characters each; this is not a mailbox. /away and /notes are the
// operator's alone: a remote peer reaches NOTE only.

const MAX_NOTES = 20;
const notes = [];
let away = false;
let awayMsg = "";
const message = () => awayMsg || "Operator is away.";

function rebuild() {
  tool.setPanel({
    title: "Away note",
    nodes: [
      { kind: "badge", text: away ? "AWAY" : "here", tone: away ? "warn" : "ok" },
      ...notes.slice(-8).map((n) => ({ kind: "text", text: n })),
      ...(notes.length ? [] : [{ kind: "text", text: "No notes.", tone: "muted" }]),
    ],
  });
}

tool.on("on_connect", (p) => {
  if (away) p.reply?.(`${message()} Leave a note with:  NOTE <text>`);
});

register({
  commands: {
    note: {
      remote: true,
      run: (args) => {
        const t = args.trim();
        if (!t) return ["Usage: NOTE <text>"];
        notes.push(t.slice(0, 120));
        if (notes.length > MAX_NOTES) notes.shift();
        rebuild();
        return ["Note saved - 73!"];
      },
    },
    away: {
      run: (args) => {
        const a = args.trim();
        if (a.toLowerCase() === "off") {
          away = false;
          rebuild();
          return ["Away off."];
        }
        away = true;
        if (a) awayMsg = a.slice(0, 160);
        rebuild();
        return [`Away on: "${message()}"`];
      },
    },
    notes: () => (notes.length ? [...notes] : ["No notes."]),
  },
});

rebuild();
