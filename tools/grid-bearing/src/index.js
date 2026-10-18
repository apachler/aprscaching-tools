// SPDX-License-Identifier: MIT
/* global register, tool */
// Grid & bearing: /grid <locator> [locator] shows a locator's position, or the distance and bearing between two,
// and keeps the last result in a panel. Connected peers may ask it too.
import { distBearing, gridToLatLon } from "../../../lib/geo.js";

const fix = (p) => `${p.lat.toFixed(4)}, ${p.lon.toFixed(4)}`;
// rounded before the wrap, so 359.6° reads 0°, not 360°
const deg = (b) => `${Math.round(b) % 360}°`;
// a peer's text goes back over the air: echo no more of it than a locator's length
const echo = (s) => String(s).slice(0, 10);

function panel(a, pa, b, pb) {
  return {
    title: "Grid & bearing",
    nodes: [
      { kind: "kv", key: a.toUpperCase(), value: fix(pa) },
      ...(b && pb
        ? [
            { kind: "kv", key: b.toUpperCase(), value: fix(pb) },
            { kind: "kv", key: "Distance", value: `${pb.km.toFixed(0)} km`, tone: "accent" },
            { kind: "kv", key: "Bearing", value: deg(pb.bearing), tone: "accent" },
          ]
        : []),
    ],
  };
}

register({
  commands: {
    grid: {
      remote: true,
      run: (args) => {
        const [a, b] = args.trim().split(/\s+/);
        const pa = gridToLatLon(a ?? "");
        if (!pa) return ["Usage: grid <locatorA> [locatorB]   e.g.  grid JN76jx JO30"];
        if (!b) {
          tool.setPanel(panel(a, pa));
          return [`${a.toUpperCase()} = ${fix(pa)}`];
        }
        const pb = gridToLatLon(b);
        if (!pb) return [`Bad locator: ${echo(b)}`];
        const db = distBearing(pa, pb);
        tool.setPanel(panel(a, pa, b, { ...pb, ...db }));
        return [`${a.toUpperCase()} → ${b.toUpperCase()}: ${db.km.toFixed(0)} km, bearing ${deg(db.bearing)}`];
      },
    },
  },
});
