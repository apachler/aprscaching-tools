// SPDX-License-Identifier: MIT
/* global register, tool */
// Beacon scheduler: /beacon <minutes> <comment> transmits the comment as an APRS status beacon every so many
// minutes, 10 through 1440 (one day); /beacon off stops it. The host sends the beacons over the browser radio link,
// only with a control-verified callsign and this tab's transmit consent.

const MIN_MINUTES = 10;
const MAX_MINUTES = 1440;
const USAGE = "Usage: /beacon <minutes> <comment>  |  /beacon off";

register({
  commands: {
    beacon: async (args) => {
      const [first, ...rest] = args.trim().split(/\s+/);
      if (first?.toLowerCase() === "off") {
        await tool.scheduleBeacon(null);
        return ["Beacon off."];
      }
      const n = Number(first);
      if (!first || !Number.isFinite(n)) return [USAGE];
      const minutes = Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.round(n)));
      const comment = rest.join(" ") || "APRScaching";
      try {
        await tool.scheduleBeacon({ comment, intervalSec: minutes * 60 });
      } catch (e) {
        return [`Beacon refused: ${e.message}.`];
      }
      return [`Beacon scheduled every ${minutes} min.`];
    },
  },
});
