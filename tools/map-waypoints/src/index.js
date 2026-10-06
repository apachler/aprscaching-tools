// SPDX-License-Identifier: MIT
/* global register, tool */
// Map waypoints: /wp <locator|lat,lon> [label] drops a marker on the map, /wpclear removes them all. The markers are
// a declarative map layer; the host draws them with the theme's colours.
import { gridToLatLon } from "../../../lib/geo.js";

const MAX_POINTS = 500;
const points = [];
const push = () => tool.setMapLayer({ id: "waypoints", points: points.map((p) => ({ ...p, tone: "accent" })) });

register({
  commands: {
    wp: (args) => {
      const [loc, ...rest] = args.trim().split(/\s+/);
      const label = rest.join(" ") || undefined;
      let p = gridToLatLon(loc ?? "");
      if (!p) {
        const m = (loc ?? "").match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
        if (m) p = { lat: Number(m[1]), lon: Number(m[2]) };
      }
      if (!p || Math.abs(p.lat) > 90 || Math.abs(p.lon) > 180) return ["Usage: /wp <locator|lat,lon> [label]"];
      points.push({ ...p, ...(label ? { label } : {}) });
      if (points.length > MAX_POINTS) points.shift();
      push();
      return [`Waypoint ${points.length}: ${p.lat.toFixed(4)},${p.lon.toFixed(4)}${label ? ` (${label})` : ""}`];
    },
    wpclear: () => {
      points.length = 0;
      push();
      return ["Waypoints cleared."];
    },
  },
});
