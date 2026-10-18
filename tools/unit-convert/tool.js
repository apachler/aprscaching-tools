// SPDX-License-Identifier: MIT
// Unit converter 1.1.2, built by scripts/build.mjs from tools/unit-convert/src, lib/ and the
// aprscaching libraries lib.lock pins. Edit the sources, not this file.
(() => {
  // tools/unit-convert/src/index.js
  var UNITS = {
    m: ["length", 1],
    km: ["length", 1e3],
    mi: ["length", 1609.344],
    ft: ["length", 0.3048],
    yd: ["length", 0.9144],
    nm: ["length", 1852],
    kn: ["speed", 1852 / 3600],
    kmh: ["speed", 1 / 3.6]
  };
  var echo = (s) => String(s).slice(0, 8);
  var unit = (u) => (u ?? "").toLowerCase().replace("km/h", "kmh");
  register({
    commands: {
      conv: {
        remote: true,
        run: (args) => {
          const [nS, from, to] = args.trim().split(/\s+/);
          const n = Number(nS);
          const f = unit(from);
          const t = unit(to);
          if (!isFinite(n) || !f || !t)
            return ["Usage: /conv <value> <from> <to>   e.g.  /conv 100 km mi  |  /conv 20 c f"];
          if (f === "c" && t === "f") return [`${n} C = ${(n * 9 / 5 + 32).toFixed(1)} F`];
          if (f === "f" && t === "c") return [`${n} F = ${((n - 32) * 5 / 9).toFixed(1)} C`];
          const [df, bf] = Object.hasOwn(UNITS, f) ? UNITS[f] : [];
          const [dt, bt] = Object.hasOwn(UNITS, t) ? UNITS[t] : [];
          if (!df || df !== dt)
            return [`Can't convert ${echo(from)} -> ${echo(to)}. Known: km mi m ft yd nm, kn kmh, c f.`];
          return [`${n} ${f} = ${(n * bf / bt).toFixed(2)} ${t}`];
        }
      }
    }
  });
})();
