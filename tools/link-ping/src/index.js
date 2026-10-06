// SPDX-License-Identifier: MIT
/* global register, tool */
// Link ping (RTT): keeps the rolling round-trip time to the connected station. The connected surface times the
// round trip and publishes samples as `link.rtt` { ms } on the bus; /ping asks for one with `link.ping.request`.

const KEPT = 50;
const samples = [];

function rebuild() {
  const last = samples.at(-1);
  const avg = samples.length ? samples.reduce((a, b) => a + b, 0) / samples.length : 0;
  tool.setPanel({
    title: "Link ping",
    nodes: samples.length
      ? [
          { kind: "kv", key: "Last", value: `${last} ms` },
          { kind: "kv", key: "Avg", value: `${avg.toFixed(0)} ms` },
          { kind: "kv", key: "Samples", value: String(samples.length) },
        ]
      : [{ kind: "text", text: "No samples - /ping or feed link.rtt.", tone: "muted" }],
  });
}

tool.subscribe("link.rtt", (data) => {
  const ms = Number(data?.ms);
  if (!isFinite(ms) || ms < 0) return;
  samples.push(ms);
  if (samples.length > KEPT) samples.shift();
  rebuild();
});

register({
  commands: {
    ping: () => {
      tool.emit("link.ping.request", {});
      return ["Ping requested (the terminal times the round-trip)."];
    },
  },
});

rebuild();
