// SPDX-License-Identifier: MIT
// Small text helpers the tools share.

/** A compact relative-time label for a timestamp in milliseconds: "42s", "5m", "3h". */
export function ago(ms, now = Date.now()) {
  const s = Math.max(0, Math.floor((now - ms) / 1000));
  return s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m` : `${Math.floor(s / 3600)}h`;
}

/** The UTC time of a timestamp in milliseconds, as hams log it: "14:05Z". */
export function utcTime(ms) {
  const d = new Date(ms);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}Z`;
}

/** An untrusted payload value as a string; an object becomes "" (never "[object Object]"). */
export const asStr = (v) => (typeof v === "string" || typeof v === "number" || typeof v === "boolean" ? String(v) : "");

/** A callsign from an event payload, upper-cased; "" when there is none. */
export const callOf = (v) => asStr(v).trim().toUpperCase();
