// SPDX-License-Identifier: MIT
/* global register, tool */
// Auto-status: /autostatus <minutes> <text> transmits an APRS status (`>text`) every so many minutes, 10 or more,
// counted on the host's one-minute tick. Each transmission passes the host's gate: a control-verified callsign and this tab's
// transmit consent, at most once a minute. Without them the status is held and the log says so.

const MIN_MINUTES = 10;
const STATUS_MAX = 62; // an APRS status text
let everyMin = 0;
let text = "APRScaching";
let ticks = 0;

register({
  commands: {
    autostatus: (args) => {
      const parts = args.trim().split(/\s+/);
      if (parts[0].toLowerCase() === "off") {
        everyMin = 0;
        return ["Auto-status off."];
      }
      const minutes = Number(parts[0]);
      if (!parts[0] || !Number.isFinite(minutes)) return ["Usage: /autostatus <minutes> <text>  |  /autostatus off"];
      everyMin = Math.max(MIN_MINUTES, Math.round(minutes));
      text = (parts.slice(1).join(" ") || "APRScaching").slice(0, STATUS_MAX);
      ticks = 0;
      return [`Auto-status every ${everyMin} min: "${text}" (TX-gated).`];
    },
  },
});

tool.on("on_tick", async () => {
  if (everyMin <= 0) return;
  ticks++;
  if (ticks < everyMin) return;
  ticks = 0;
  const sent = await tool.requestTx(`>${text}`);
  tool.log(sent ? "auto-status sent" : "auto-status held (TX gate closed)");
});
