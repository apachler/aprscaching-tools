// SPDX-License-Identifier: MIT
// Maidenhead locators and great-circle geometry for the grid and waypoint tools.

// Maidenhead pair bases: field 18 · square 10 · subsquare 24 · extended square 10 · extended subsquare 24.
const MH_BASES = [18, 10, 24, 10, 24];

/** A Maidenhead locator (4, 6, 8 or 10 characters) as the latitude/longitude of its smallest cell's centre, or null. */
export function gridToLatLon(loc) {
  const g = String(loc).trim().toUpperCase();
  if (!/^[A-R]{2}[0-9]{2}([A-X]{2}([0-9]{2}([A-X]{2})?)?)?$/.test(g)) return null;
  const pairs = g.match(/../g);
  let lon = -180;
  let lat = -90;
  let lonCell = 360;
  let latCell = 180;
  for (let p = 0; p < pairs.length; p++) {
    lonCell /= MH_BASES[p];
    latCell /= MH_BASES[p];
    const base = p === 0 || p % 2 === 0 ? 65 : 48;
    lon += (pairs[p].charCodeAt(0) - base) * lonCell;
    lat += (pairs[p].charCodeAt(1) - base) * latCell;
  }
  return { lat: lat + latCell / 2, lon: lon + lonCell / 2 };
}

/** Great-circle distance (km) and initial bearing (degrees) from `a` to `b`. */
export function distBearing(a, b) {
  const R = 6371;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const la1 = a.lat * rad;
  const la2 = b.lat * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  const km = 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  const y = Math.sin(dLon) * Math.cos(la2);
  const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLon);
  return { km, bearing: (Math.atan2(y, x) / rad + 360) % 360 };
}
