// SPDX-License-Identifier: MIT
/* global register, tool */
// Scheduled query (GPAUTO): /gpauto <steps> runs a connect / waitfor / send / disconnect script against a BBS or a
// cluster, now or every so many minutes, and shows its progress and the captured reply in a panel. The packet
// terminal owns the connection: it offers the `session.script` service while its TNC is open, and that service
// asks for the 'tx' permission, since a script connects and sends.
import { parseScript } from "aprscaching/packages/tools/src/session-script.ts";

let script = "";
let everyMin = 0;
let ticks = 0;

async function runOnce(text) {
  const steps = parseScript(text);
  if (!steps.length) return "No steps. e.g. /gpauto connect HB9W-8; waitfor Cluster; send sh/dx; disconnect";
  let ok;
  try {
    ok = await tool.call("session.script", { steps });
  } catch (e) {
    return `Refused: ${e.message}`;
  }
  return ok ? `Running ${steps.length} steps…` : "Open the packet TNC first (no session service).";
}

function render(st) {
  tool.setPanel({
    title: "Scheduled query",
    nodes: st
      ? [
          {
            kind: "kv",
            key: "Status",
            value: `${st.status} (${st.step}/${st.total})`,
            tone: st.status === "error" ? "bad" : st.status === "done" ? "ok" : "accent",
          },
          ...(st.note ? [{ kind: "text", text: st.note, tone: "muted" }] : []),
          ...(Array.isArray(st.captured) ? st.captured : []).slice(-10).map((l) => ({ kind: "text", text: String(l) })),
        ]
      : [{ kind: "text", text: "Idle. /gpauto <steps>  or  /gpauto every <min> <steps>.", tone: "muted" }],
  });
}

tool.subscribe("session.progress", (data) => render(data && typeof data === "object" ? data : undefined));

register({
  commands: {
    gpauto: async (args) => {
      const a = args.trim();
      if (!a)
        return [
          script
            ? `Script set (${parseScript(script).length} steps). /gpauto run`
            : "No script. /gpauto <steps> or /gpauto every <min> <steps>",
        ];
      if (a.toLowerCase() === "off") {
        everyMin = 0;
        return ["Scheduled query off."];
      }
      const every = a.match(/^every\s+(\d+)\s+([\s\S]+)$/i);
      if (every) {
        everyMin = Math.max(1, Number(every[1]));
        script = every[2];
        ticks = 0;
        return [`Scheduled every ${every[1]} min. ${await runOnce(script)}`];
      }
      if (a.toLowerCase() === "run") return [script ? await runOnce(script) : "No stored script — /gpauto <steps> first."];
      script = a;
      return [await runOnce(a)];
    },
  },
});

tool.on("on_tick", () => {
  if (everyMin <= 0) return;
  ticks++;
  if (ticks < everyMin) return;
  ticks = 0;
  if (script) void runOnce(script);
});

render();
