// SPDX-License-Identifier: MIT
/* global register, tool */
// Auto-status: /autostatus <minutes> <text> transmits an APRS status (`>text`) every so many minutes, 10 or more,
// counted on the host's one-minute tick. Each transmission passes the host's gate: a control-verified callsign and this tab's
// transmit consent, at most once a minute, within the tool's transmit budget. Without them the status is held and the
// log says so. A status led by a grid locator is refused when it is set: APRS reads it as a position.

const MIN_MINUTES = 10;
const STATUS_MAX = 62; // an APRS status text
let everyMin = 0;
let text = "APRScaching";
let ticks = 0;
const LOCATOR_LED = /^[A-R]{2}[0-9]{2}/i;

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
      const next = (parts.slice(1).join(" ") || "APRScaching").slice(0, STATUS_MAX);
      if (LOCATOR_LED.test(next)) return ["A status may not start with a grid locator; APRS reads it as a position."];
      everyMin = Math.max(MIN_MINUTES, Math.round(minutes));
      text = next;
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
  tool.log(sent ? "auto-status sent" : "auto-status held (TX gate, transmit budget or format)");
});
