// SPDX-License-Identifier: MIT
/* global register, tool */
// Beacon scheduler: /beacon <minutes> <comment> transmits the comment as an APRS status beacon every so many
// minutes; /beacon off stops it. The host sends the beacons over the browser radio link, only with a
// control-verified callsign and this tab's transmit consent, and never more often than every 10 minutes.

const MIN_MINUTES = 10;
const DEFAULT_MINUTES = 30;

register({
  commands: {
    beacon: async (args) => {
      const [first, ...rest] = args.trim().split(/\s+/);
      if (first?.toLowerCase() === "off") {
        await tool.scheduleBeacon(null);
        return ["Beacon off."];
      }
      const minutes = Math.max(MIN_MINUTES, Math.round(Number(first) || DEFAULT_MINUTES));
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
