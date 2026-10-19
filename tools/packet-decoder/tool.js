// SPDX-License-Identifier: MIT
// Packet decoder 1.1.1, built by scripts/build.mjs from tools/packet-decoder/src, lib/ and the
// aprscaching libraries lib.lock pins. Edit the sources, not this file.
(() => {
  // vendor/aprscaching/packages/aprs/src/tnc2.ts
  function parseTNC2(line) {
    const s = line.trimEnd();
    if (!s || s.startsWith("#")) return null;
    const colon = s.indexOf(":");
    if (colon < 0) return null;
    const header = s.slice(0, colon);
    const payload = s.slice(colon + 1);
    const gt = header.indexOf(">");
    if (gt < 0) return null;
    const src = header.slice(0, gt);
    const rest = header.slice(gt + 1).split(",");
    const dst = rest[0] ?? "";
    if (!src || !dst) return null;
    const path = rest.slice(1);
    return { src, dst, path, payload, raw: s };
  }

  // vendor/aprscaching/packages/aprs/src/qconstruct.ts
  var RF_Q = /* @__PURE__ */ new Set(["qAR", "qAr", "qAo", "qAO"]);
  var NET_Q = /* @__PURE__ */ new Set(["qAC", "qAX", "qAU", "qAS", "qAI"]);
  function classifyQ(path) {
    for (let i = 0; i < path.length; i++) {
      const tok = path[i];
      if (RF_Q.has(tok)) return { heardVia: "rf", igateCall: path[i + 1] };
      if (NET_Q.has(tok)) return { heardVia: "aprs_is", igateCall: path[i + 1] };
    }
    return { heardVia: "aprs_is" };
  }

  // vendor/aprscaching/packages/aprs/src/geo.ts
  function isValidLatLon(lat, lon) {
    return typeof lat === "number" && typeof lon === "number" && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  }
  function fromMaidenhead(locator) {
    const m = /^([A-R])([A-R])(\d)(\d)(?:([A-X])([A-X]))?$/.exec(locator.toUpperCase());
    if (!m) return null;
    const at = (c) => c.charCodeAt(0) - 65;
    let lon = at(m[1]) * 20 + Number(m[3]) * 2 - 180;
    let lat = at(m[2]) * 10 + Number(m[4]) - 90;
    if (m[5]) {
      lon += (at(m[5]) + 0.5) * (2 / 24);
      lat += (at(m[6]) + 0.5) * (1 / 24);
    } else {
      lon += 1;
      lat += 0.5;
    }
    return { lat: Math.round(lat * 1e6) / 1e6, lon: Math.round(lon * 1e6) / 1e6 };
  }

  // vendor/aprscaching/packages/aprs/src/sun.ts
  var RAD = Math.PI / 180;

  // vendor/aprscaching/packages/aprs/src/symbols.ts
  var PRIMARY = {
    "!": ["Police/Sheriff", "infra"],
    "#": ["Digipeater", "digi"],
    $: ["Phone", "infra"],
    "%": ["DX cluster", "infra"],
    "&": ["HF gateway", "digi"],
    "'": ["Small aircraft", "air"],
    "(": ["Mobile satellite station", "infra"],
    ")": ["Wheelchair", "vehicle"],
    "*": ["Snowmobile", "vehicle"],
    "+": ["Red Cross", "infra"],
    ",": ["Boy Scouts", "event"],
    "-": ["House (HF)", "station"],
    ".": ["X (unknown)", "other"],
    "/": ["Red dot", "other"],
    "0": ["Circle (number)", "other"],
    "<": ["Motorcycle", "vehicle"],
    "=": ["Railroad engine", "vehicle"],
    ">": ["Car", "vehicle"],
    A: ["Aid station", "infra"],
    B: ["BBS", "infra"],
    C: ["Canoe", "marine"],
    E: ["Eyeball (event)", "event"],
    F: ["Farm vehicle/tractor", "vehicle"],
    I: ["TCP/IP", "infra"],
    K: ["School", "infra"],
    O: ["Balloon", "air"],
    P: ["Police", "infra"],
    R: ["Recreational vehicle", "vehicle"],
    U: ["Bus", "vehicle"],
    V: ["ATV", "vehicle"],
    W: ["National weather service", "weather"],
    X: ["Helicopter", "air"],
    Y: ["Yacht/sailboat", "marine"],
    "[": ["Jogger", "station"],
    "^": ["Large aircraft", "air"],
    _: ["Weather station", "weather"],
    a: ["Ambulance", "vehicle"],
    b: ["Bicycle", "vehicle"],
    f: ["Fire truck", "vehicle"],
    g: ["Glider", "air"],
    h: ["Hospital", "infra"],
    j: ["Jeep", "vehicle"],
    k: ["Truck", "vehicle"],
    l: ["Laptop", "station"],
    m: ["Mic-E repeater", "digi"],
    n: ["Node", "infra"],
    o: ["EOC", "infra"],
    p: ["Dog/rover", "station"],
    r: ["Antenna/repeater", "digi"],
    s: ["Ship/power boat", "marine"],
    t: ["Truck stop", "infra"],
    u: ["Truck (18-wheeler)", "vehicle"],
    v: ["Van", "vehicle"],
    y: ["Yagi at QTH", "station"],
    "<>": ["", ""]
  };
  var ALTERNATE = {
    "!": ["Emergency", "event"],
    "#": ["Overlay digipeater", "digi"],
    "&": ["Overlay gateway", "digi"],
    "(": ["Cloudy", "weather"],
    "*": ["Snow", "weather"],
    "<": ["Gale/storm", "weather"],
    ">": ["Overlay car", "vehicle"],
    A: ["Overlay box", "other"],
    O: ["Rocket", "air"],
    W: ["Flooding", "weather"],
    _: ["Weather (alt)", "weather"],
    i: ["Point of interest", "other"],
    n: ["Overlay triangle", "other"],
    s: ["Overlay ship", "marine"],
    u: ["Overlay truck", "vehicle"]
  };
  function lookupSymbol(table, code) {
    const isPrimary = table === "/";
    const isAlt = table === "\\";
    const overlay = !isPrimary && !isAlt ? table : void 0;
    const map = isPrimary ? PRIMARY : ALTERNATE;
    const hit = map[code];
    if (hit && hit[0]) return { table, code, label: hit[0], category: hit[1], overlay };
    return { table, code, label: `Symbol ${table}${code}`, category: "other", overlay };
  }
  var XY_BLOCKS = [
    { primary: "B", alternate: "O", from: "B", to: "P", code: "!" },
    { primary: "P", alternate: "A", from: "0", to: "9", code: "0" },
    { primary: "M", alternate: "N", from: "R", to: "X", code: ":" },
    { primary: "P", alternate: "A", from: "A", to: "Z", code: "A" },
    { primary: "H", alternate: "D", from: "S", to: "X", code: "[" },
    { primary: "L", alternate: "S", from: "A", to: "Z", code: "a" },
    { primary: "J", alternate: "Q", from: "1", to: "4", code: "{" }
  ];
  var SSID_SYMBOLS = " aUfbYX's><OjRkv";
  function symbolFromAddress(dst, src) {
    const call = dst.split("-")[0].toUpperCase();
    const cnn = /^GPS([CE])(\d{2})$/.exec(call);
    if (cnn) {
      const n = Number(cnn[2]);
      if (n >= 1 && n <= 94) return lookupSymbol(cnn[1] === "C" ? "/" : "\\", String.fromCharCode(32 + n));
    }
    const xyz = /^(?:GPS|SPC|SYM)([A-Z])([A-Z0-9])([A-Z0-9 ]?)$/.exec(call);
    if (xyz) {
      const x = xyz[1], y = xyz[2], z = xyz[3].trim();
      for (const b of XY_BLOCKS) {
        const alternate = x === b.alternate;
        if (x !== b.primary && !alternate || y < b.from || y > b.to) continue;
        const code = String.fromCharCode(b.code.charCodeAt(0) + y.charCodeAt(0) - b.from.charCodeAt(0));
        return lookupSymbol(alternate ? z || "\\" : "/", code);
      }
    }
    const ssid = Number(src.split("-")[1] ?? 0);
    return Number.isInteger(ssid) && ssid >= 1 && ssid <= 15 ? lookupSymbol("/", SSID_SYMBOLS[ssid]) : void 0;
  }

  // vendor/aprscaching/packages/aprs/src/compressed.ts
  var d = (c) => c.charCodeAt(0) - 33;
  function isCompressedLead(c) {
    return c === "/" || c === "\\" || c >= "A" && c <= "Z" || c >= "a" && c <= "j";
  }
  function parseCompressed(s) {
    if (s.length < 13 || !isCompressedLead(s[0])) return null;
    for (let i = 1; i <= 8; i++) {
      const v = d(s[i]);
      if (v < 0 || v > 90) return null;
    }
    const y = d(s[1]) * 753571 + d(s[2]) * 8281 + d(s[3]) * 91 + d(s[4]);
    const x = d(s[5]) * 753571 + d(s[6]) * 8281 + d(s[7]) * 91 + d(s[8]);
    const lat = 90 - y / 380926;
    const lon = -180 + x / 190463;
    const lead = s[0];
    const table = lead >= "a" && lead <= "j" ? String(lead.charCodeAt(0) - 97) : lead, code = s[9];
    const c = s[10], cc = s[11], t = s[12];
    const fix = { lat, lon, table, code };
    const csDigits = d(c) >= 0 && d(c) <= 90 && d(cc) >= 0 && d(cc) <= 90;
    if (c !== " " && csDigits) {
      const tByte = t.charCodeAt(0) - 33;
      if ((tByte & 24) === 16) {
        const alt = Math.pow(1.002, d(c) * 91 + d(cc));
        fix.altitudeM = Math.round(alt * 0.3048 * 10) / 10;
      } else if (d(c) >= 0 && d(c) <= 89) {
        fix.course = d(c) * 4;
        fix.speedKn = Math.round((Math.pow(1.08, d(cc)) - 1) * 10) / 10;
      } else if (c === "{") {
        fix.rangeKm = Math.round(2 * Math.pow(1.08, d(cc)) * 1.609 * 10) / 10;
      }
    }
    return fix;
  }

  // vendor/aprscaching/packages/aprs/src/dao.ts
  var DAO_RE = /!([0-9A-Za-z])([ -{])([ -{])!/g;
  function extraMinutes(c, form) {
    if (c === " " || form === "none") return 0;
    if (form === "digit") return c >= "0" && c <= "9" ? Number(c) / 1e3 : null;
    return Math.round((c.charCodeAt(0) - 33) / 91 * 100) / 1e4;
  }
  function extractDao(comment) {
    let found = null;
    for (const m of comment.matchAll(DAO_RE)) {
      const d2 = m[1];
      const form = d2 >= "A" && d2 <= "Z" ? "digit" : d2 >= "a" && d2 <= "z" ? "base91" : "none";
      const latMin = extraMinutes(m[2], form), lonMin = extraMinutes(m[3], form);
      if (latMin === null || lonMin === null) continue;
      found = { index: m.index, datum: d2.toUpperCase(), latMin, lonMin };
    }
    if (!found) return null;
    const { index, ...dao } = found;
    return { ...dao, comment: comment.slice(0, index) + comment.slice(index + 5) };
  }
  var addMinutes = (deg, negative, minutes) => (Math.abs(deg) + minutes / 60) * (negative ? -1 : 1);

  // vendor/aprscaching/packages/aprs/src/locator.ts
  var LOCATOR_RE = /^([A-Ra-r]{2}\d{2}(?:[A-Xa-x]{2})?)([/\\0-9A-Z])([!-~])(?: |$)/;
  function readLocator(text) {
    const m = LOCATOR_RE.exec(text);
    if (!m) return null;
    const grid = m[1].toUpperCase();
    const centre = fromMaidenhead(grid);
    if (!centre) return null;
    return { locator: { grid, ...centre }, table: m[2], code: m[3], text: text.slice(m[0].length).trim() };
  }

  // vendor/aprscaching/packages/aprs/src/text.ts
  var utf8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
  var utf8Out = new TextEncoder();

  // vendor/aprscaching/packages/aprs/src/mice.ts
  var STD_MSG = ["Emergency", "Priority", "Special", "Committed", "Returning", "In Service", "En Route", "Off Duty"];
  var CUSTOM_MSG = ["Emergency", "Custom-6", "Custom-5", "Custom-4", "Custom-3", "Custom-2", "Custom-1", "Custom-0"];
  var UNKNOWN_MSG = "Unknown";
  function decodeDest(dest) {
    const call = dest.split("-")[0];
    if (call.length < 6) return null;
    const digits = [], mbits = [];
    let custom = false, standard = false, ambiguity = 0;
    let north = false, lonOffset = false, west = false;
    for (let i = 0; i < 6; i++) {
      const c = call[i];
      let digit = 0, mbit = 0, high = false, space = false;
      if (c >= "0" && c <= "9") {
        digit = c.charCodeAt(0) - 48;
      } else if (c >= "A" && c <= "K") {
        if (i >= 3) return null;
        if (c === "K") space = true;
        else digit = c.charCodeAt(0) - 65;
        mbit = 1;
        custom = true;
      } else if (c === "L") {
        space = true;
        mbit = 0;
      } else if (c >= "P" && c <= "Y") {
        digit = c.charCodeAt(0) - 80;
        mbit = 1;
        high = true;
        if (i < 3) standard = true;
      } else if (c === "Z") {
        space = true;
        mbit = 1;
        high = true;
        if (i < 3) standard = true;
      } else return null;
      if (space) ambiguity++;
      digits.push(digit);
      mbits.push(mbit);
      if (i === 3) north = high;
      if (i === 4) lonOffset = high;
      if (i === 5) west = high;
    }
    return { digits, mbits, custom, mixed: custom && standard, north, lonOffset, west, ambiguity };
  }
  function decodeMicE(dest, info) {
    const dd = decodeDest(dest);
    if (!dd || info.length < 9) return null;
    const [d0, d1, d2, d3, d4, d5] = dd.digits;
    const latDeg = d0 * 10 + d1;
    const latMin = d2 * 10 + d3 + (d4 * 10 + d5) / 100;
    if (latMin >= 60) return null;
    let lat = latDeg + latMin / 60;
    if (!dd.north) lat = -lat;
    let lonDeg = info.charCodeAt(1) - 28;
    if (dd.lonOffset) lonDeg += 100;
    if (lonDeg >= 180 && lonDeg <= 189) lonDeg -= 80;
    else if (lonDeg >= 190 && lonDeg <= 199) lonDeg -= 190;
    let lonMin = info.charCodeAt(2) - 28;
    if (lonMin >= 60) lonMin -= 60;
    let lonHund = info.charCodeAt(3) - 28;
    if (lonDeg < 0 || lonMin < 0 || lonHund < 0 || lonHund > 99 || lonMin + lonHund / 100 >= 60) return null;
    if (dd.ambiguity >= 1) lonHund -= lonHund % 10;
    if (dd.ambiguity >= 2) lonHund = 0;
    if (dd.ambiguity >= 3) lonMin -= lonMin % 10;
    if (dd.ambiguity >= 4) lonMin = 0;
    let lon = lonDeg + (lonMin + lonHund / 100) / 60;
    if (dd.west) lon = -lon;
    if (!isValidLatLon(lat, lon)) return null;
    const sp = info.charCodeAt(4) - 28, dc = info.charCodeAt(5) - 28, se = info.charCodeAt(6) - 28;
    let speedKn, course2;
    if ([sp, dc, se].every((v) => v >= 0 && v <= 99)) {
      speedKn = sp * 10 + Math.floor(dc / 10);
      course2 = dc % 10 * 100 + se;
      if (speedKn >= 800) speedKn -= 800;
      if (course2 >= 400) course2 -= 400;
      if (course2 === 0 || course2 > 360) course2 = void 0;
    }
    const code = info[7] ?? "/";
    const table = info[8] ?? "/";
    const msgNum = dd.mbits[0] << 2 | dd.mbits[1] << 1 | dd.mbits[2];
    const messageType = dd.mixed ? UNKNOWN_MSG : (dd.custom ? CUSTOM_MSG : STD_MSG)[msgNum];
    const fix = {
      lat: round(lat),
      lon: round(lon),
      table,
      code,
      course: course2,
      speedKn,
      messageType,
      ambiguity: dd.ambiguity
    };
    const text = statusText(info.slice(9));
    if (text.altitudeM !== void 0) fix.altitudeM = text.altitudeM;
    let comment = text.comment ?? "";
    const dao = extractDao(comment);
    if (dao) {
      fix.datum = dao.datum;
      comment = dao.comment.trim();
      if (!dd.ambiguity) {
        const daoLat = addMinutes(lat, !dd.north, dao.latMin), daoLon = addMinutes(lon, dd.west, dao.lonMin);
        if (isValidLatLon(daoLat, daoLon)) {
          fix.lat = round(daoLat);
          fix.lon = round(daoLon);
        }
      }
    }
    const loc = readLocator(comment);
    if (loc) {
      fix.locator = loc.locator;
      comment = loc.text;
    }
    if (comment) fix.comment = comment;
    if (text.device) fix.device = text.device;
    return fix;
  }
  var MICE_CODE = /[_|(^*:[].$/;
  function statusText(rest) {
    const prefix = /^[>\]`']/.test(rest) ? rest[0] : "";
    let text = rest.slice(prefix.length);
    let altitudeM;
    const alt = /^([!-{])([!-{])([!-{])\}/.exec(text);
    if (alt) {
      const v = (alt[1].charCodeAt(0) - 33) * 8281 + (alt[2].charCodeAt(0) - 33) * 91 + (alt[3].charCodeAt(0) - 33);
      altitudeM = v - 1e4;
      text = text.slice(4);
    }
    const tail = prefix === ">" || prefix === "]" ? 1 : 2;
    const device = prefix ? { prefix, suffix: text.length >= tail ? text.slice(-tail) : "" } : void 0;
    if (prefix === ">") text = text.replace(/[=^&]$/, "");
    else if (prefix === "]") text = text.replace(/=$/, "");
    else if (prefix) text = text.replace(MICE_CODE, "");
    const comment = text.trim();
    return {
      ...altitudeM !== void 0 ? { altitudeM } : {},
      ...comment ? { comment } : {},
      ...device ? { device } : {}
    };
  }
  var round = (n) => Math.round(n * 1e6) / 1e6;

  // vendor/aprscaching/packages/aprs/src/nmea.ts
  var HEAD_RE = /^\$(GP|GN|GL|GA|GB|BD)(GGA|GLL|RMC|VTG|WPL),/;
  var CHECKSUM_RE = /\*([0-9A-Fa-f]{2})[\r\n]*$/;
  var LAT_RE = /^(\d{2})(\d{2}(?:\.\d{1,8})?)$/;
  var LON_RE = /^(\d{3})(\d{2}(?:\.\d{1,8})?)$/;
  var NUM_RE = /^\d{1,6}(?:\.\d{1,6})?$/;
  var SIGNED_NUM_RE = /^-?\d{1,6}(?:\.\d{1,6})?$/;
  var MAX_LEN = 200;
  function coord(v, hemi, re, pos, neg) {
    const m = re.exec(v ?? "");
    if (!m || hemi !== pos && hemi !== neg) return null;
    const min = Number(m[2]);
    if (min >= 60) return null;
    const deg = Number(m[1]) + min / 60;
    return hemi === neg ? -deg : deg;
  }
  function position(f, at) {
    const lat = coord(f[at], f[at + 1], LAT_RE, "N", "S"), lon = coord(f[at + 2], f[at + 3], LON_RE, "E", "W");
    if (lat === null || lon === null || !isValidLatLon(lat, lon)) return null;
    return { lat: round2(lat), lon: round2(lon) };
  }
  function course(v) {
    if (!v || !NUM_RE.test(v)) return void 0;
    const c = Math.round(Number(v));
    if (c > 360) return void 0;
    return c === 0 ? 360 : c;
  }
  var num = (v) => v && NUM_RE.test(v) ? Number(v) : void 0;
  var time = (v) => v && /^\d{6}(?:\.\d{1,3})?$/.test(v) ? v.slice(0, 6) : void 0;
  var round2 = (n) => Math.round(n * 1e6) / 1e6;
  var round1 = (n) => Math.round(n * 10) / 10;
  function parseNmea(info) {
    if (info.length > MAX_LEN) return null;
    const head = HEAD_RE.exec(info);
    if (!head) return null;
    let body = info.slice(1);
    const sum = CHECKSUM_RE.exec(info);
    if (sum) {
      body = info.slice(1, sum.index);
      let x = 0;
      for (let i = 0; i < body.length; i++) x ^= body.charCodeAt(i);
      if (x !== parseInt(sum[1], 16)) return null;
    } else if (info.includes("*")) return null;
    const f = body.trimEnd().split(",");
    const sentence = head[2];
    switch (sentence) {
      case "RMC": {
        if (f[2] !== "A" || f[12] === "N") return null;
        const fix = position(f, 3);
        if (!fix) return null;
        const speed = num(f[7]);
        return {
          sentence,
          ...fix,
          ...speed !== void 0 ? { speedKn: round1(speed) } : {},
          ...opt("course", course(f[8])),
          ...opt("time", time(f[1]))
        };
      }
      case "GGA": {
        if (!f[6] || f[6] === "0" || !/^\d$/.test(f[6])) return null;
        const fix = position(f, 2);
        if (!fix) return null;
        const alt = f[10] === "M" && f[9] && SIGNED_NUM_RE.test(f[9]) ? Math.round(Number(f[9])) : void 0;
        return { sentence, ...fix, ...opt("altitudeM", alt), ...opt("time", time(f[1])) };
      }
      case "GLL": {
        if (f[6] === "V" || f[7] === "N") return null;
        const fix = position(f, 1);
        if (!fix) return null;
        return { sentence, ...fix, ...opt("time", time(f[5])) };
      }
      case "WPL": {
        const fix = position(f, 1);
        const waypoint = (f[5] ?? "").trim();
        if (!fix || !waypoint) return null;
        return { sentence, ...fix, waypoint };
      }
      case "VTG": {
        if (f[9] === "N") return null;
        const speed = num(f[5]);
        return {
          sentence,
          ...opt("course", course(f[1])),
          ...speed !== void 0 ? { speedKn: round1(speed) } : {}
        };
      }
    }
  }
  function opt(key, value) {
    return value === void 0 ? {} : { [key]: value };
  }

  // vendor/aprscaching/packages/aprs/src/decode.ts
  var UNCOMP_RE = /^(\d{2})([0-7 ][0-9 ]\.[0-9 ]{2})([NS])(.)(\d{3})([0-7 ][0-9 ]\.[0-9 ]{2})([EW])(.)/;
  function parseUncompressed(s) {
    const m = UNCOMP_RE.exec(s);
    if (!m) return null;
    const [whole, latDeg, latMin, ns, table, lonDeg, lonMin, ew, code] = m;
    const ambiguity = latMin.match(/ /g)?.length ?? 0;
    const latMinNum = Number(latMin.replace(/ /g, "0"));
    const lonMinNum = Number(maskMinutes(lonMin, ambiguity));
    if (!(latMinNum < 60 && lonMinNum < 60)) return null;
    let lat = Number(latDeg) + latMinNum / 60;
    let lon = Number(lonDeg) + lonMinNum / 60;
    if (ns === "S") lat = -lat;
    if (ew === "W") lon = -lon;
    if (!isValidLatLon(lat, lon)) return null;
    const fix = { lat: round3(lat), lon: round3(lon), symbol: lookupSymbol(table, code), ambiguity };
    return { fix, rest: s.slice(whole.length), lat, lon, south: ns === "S", west: ew === "W" };
  }
  function maskMinutes(mmhh, level) {
    const digits = [...mmhh.replace(/ /g, "0")];
    for (const at of [4, 3, 1, 0].slice(0, level)) digits[at] = "0";
    return digits.join("");
  }
  var KM_PER_MI = 1.609344;
  var M_PER_FT = 0.3048;
  var PHG_RE = /^PHG(\d)([0-~])(\d)([0-8])(?:([0-9A-Z])\/)?/;
  var RNG_RE = /^RNG(\d{4})/;
  var DFS_RE = /^DFS(\d)([0-~])(\d)([0-8])/;
  var BRG_NRQ_RE = /^\/(\d{3})\/(\d)(\d)(\d)/;
  var DF_ACCURACY_DEG = [0, 240, 120, 64, 32, 16, 8, 4, 2, 1];
  var heightFt = (code) => 10 * 2 ** (code.charCodeAt(0) - 48);
  var directivity = (code) => code === "0" ? {} : { directivityDeg: Number(code) * 45 };
  function phgRangeMi(powerW, haatFt, gainDb) {
    return Math.sqrt(2 * haatFt * Math.sqrt(powerW / 10 * (10 ** (gainDb / 10) / 2)));
  }
  function applyRangeExtension(fix, comment) {
    const phg = PHG_RE.exec(comment);
    if (phg) {
      const powerW = Number(phg[1]) ** 2, ft = heightFt(phg[2]), gainDb = Number(phg[3]), rate = phg[5];
      fix.phg = {
        powerW,
        heightM: round12(ft * M_PER_FT),
        gainDb,
        ...directivity(phg[4]),
        ...rate ? { beaconsPerHour: parseInt(rate, 36) } : {}
      };
      fix.rangeKm = round12(phgRangeMi(powerW, ft, gainDb) * KM_PER_MI);
      return comment.slice(phg[0].length);
    }
    const rng = RNG_RE.exec(comment);
    if (rng) {
      fix.rangeKm = round12(Number(rng[1]) * KM_PER_MI);
      return comment.slice(7);
    }
    const dfs = DFS_RE.exec(comment);
    if (dfs) {
      fix.dfs = {
        strength: Number(dfs[1]),
        heightM: round12(heightFt(dfs[2]) * M_PER_FT),
        gainDb: Number(dfs[3]),
        ...directivity(dfs[4])
      };
      return comment.slice(7);
    }
    return comment;
  }
  function applyDfBearing(fix, comment) {
    const m = BRG_NRQ_RE.exec(comment);
    if (!m) return comment;
    const bearingDeg = Number(m[1]);
    if (bearingDeg > 360) return comment;
    const n = Number(m[2]), r = Number(m[3]), q = Number(m[4]);
    const df = { bearingDeg };
    if (n !== 0) {
      if (n === 9) df.manual = true;
      else df.hits = n;
      df.rangeKm = round12(2 ** r * KM_PER_MI);
      if (q !== 0) df.accuracyDeg = DF_ACCURACY_DEG[q];
    }
    fix.df = df;
    return comment.slice(8);
  }
  var isDfSymbol = (fix) => fix.symbol?.table === "/" && fix.symbol.code === "\\";
  function applyExtensions(fix, comment, opts = {}) {
    const cs = opts.compressed ? null : /^(\d{3})\/(\d{3})/.exec(comment);
    if (cs) {
      const course2 = Number(cs[1]), speed = Number(cs[2]);
      if (course2 >= 1 && course2 <= 360) fix.course = course2;
      if (course2 !== 0 || speed !== 0) fix.speedKn = speed;
    }
    if (cs || !opts.compressed && /^(\.{3}| {3})\/(\.{3}| {3})/.test(comment)) {
      comment = comment.slice(7);
      if (isDfSymbol(fix)) comment = applyDfBearing(fix, comment);
    } else if (!opts.compressed) {
      comment = applyRangeExtension(fix, comment);
    }
    const alt = /\/A=(-\d{5,6}|\d{6})/.exec(comment);
    if (alt) {
      fix.altitudeM = Math.round(Number(alt[1]) * 0.3048);
      comment = comment.replace(alt[0], "");
    }
    const c = comment.trim();
    if (c) fix.comment = c;
  }
  var KN_PER_MPH = 0.868976;
  var WX_HEAD = /^([\d. ]{3})\/([\d. ]{3})/;
  var WX_FIELDS = { c: 3, s: 3, g: 3, t: 3, r: 3, p: 3, P: 3, h: 2, b: 5, L: 3, l: 3, "#": 3 };
  function scanWeatherFields(s) {
    const fields = {};
    let i = 0, count = 0;
    while (i < s.length) {
      const w = WX_FIELDS[s[i]];
      if (!w || i + 1 + w > s.length) break;
      const v = s.slice(i + 1, i + 1 + w);
      if (!/^(-?\d+|[. ]+)$/.test(v)) break;
      if (/^-?\d+$/.test(v)) fields[s[i]] = Number(v);
      count++;
      i += 1 + w;
    }
    return { fields, count };
  }
  function setWind(wx, dir, mph) {
    if (dir !== void 0 && dir <= 360) wx.windDirDeg = dir;
    if (mph !== void 0) wx.windKn = round12(mph * KN_PER_MPH);
  }
  function parseWeather(s, compressedWind) {
    const wx = {};
    const head = WX_HEAD.exec(s);
    const digits = (v) => v && /^\d+$/.test(v) ? Number(v) : void 0;
    if (head) setWind(wx, digits(head[1]), digits(head[2]));
    const { fields: f } = scanWeatherFields(head ? s.slice(7) : s);
    if (!head) setWind(wx, f.c, f.s);
    if (compressedWind) {
      if (compressedWind.dir !== void 0) wx.windDirDeg = compressedWind.dir;
      if (compressedWind.kn !== void 0) wx.windKn = compressedWind.kn;
    }
    if (f.g !== void 0) wx.gustKn = round12(f.g * KN_PER_MPH);
    if (f.t !== void 0) wx.tempC = round12((f.t - 32) * 5 / 9);
    if (f.r !== void 0) wx.rain1hMm = round3(f.r * 0.254);
    if (f.p !== void 0) wx.rain24hMm = round3(f.p * 0.254);
    if (f.P !== void 0) wx.rainMidnightMm = round3(f.P * 0.254);
    if (f.h !== void 0) wx.humidity = f.h === 0 ? 100 : f.h;
    if (f.b !== void 0) wx.pressureHpa = round3(f.b * 0.1);
    return wx;
  }
  var isWeather = (s) => WX_HEAD.test(s);
  var isCompressedWeather = (s) => scanWeatherFields(s).count > 0;
  function decodeAprs(frame) {
    return decodeFrame(frame, 0);
  }
  var MAX_THIRD_PARTY_DEPTH = 1;
  function decodeFrame(frame, depth) {
    const p = frame.payload;
    const t = p[0] ?? "";
    if ((t === "`" || t === "'" || t === "" || t === "") && frame.dst) {
      const me = decodeMicE(frame.dst, p);
      if (me)
        return {
          kind: "position",
          lat: me.lat,
          lon: me.lon,
          symbol: lookupSymbol(me.table, me.code),
          course: me.course,
          speedKn: me.speedKn,
          altitudeM: me.altitudeM,
          comment: me.comment,
          ambiguity: me.ambiguity,
          messageType: me.messageType,
          ...me.device ? { micEDevice: me.device } : {},
          ...me.datum ? { datum: me.datum } : {},
          ...me.locator ? { locator: me.locator } : {}
        };
    }
    switch (t) {
      case "!":
      case "=":
      case "@":
      case "/": {
        let body = p.slice(1), timestamp;
        if (t === "@" || t === "/") {
          timestamp = body.slice(0, 7);
          body = body.slice(7);
        }
        return decodePosition(body, timestamp);
      }
      case ";":
        return decodeObject(p);
      case ")":
        return decodeItem(p);
      case ":":
        return decodeMessage(p);
      case ">": {
        const stamp = /^\d{6}z/.exec(p.slice(1));
        if (stamp) return { kind: "status", text: p.slice(8).trim(), timestamp: stamp[0] };
        const loc = readLocator(p.slice(1));
        if (loc)
          return { kind: "status", text: loc.text, locator: loc.locator, symbol: lookupSymbol(loc.table, loc.code) };
        return { kind: "status", text: p.slice(1).trim() };
      }
      case "$":
        return decodeNmea(frame);
      case "}": {
        const inner = depth < MAX_THIRD_PARTY_DEPTH ? parseTNC2(p.slice(1)) : null;
        if (!inner || !inner.src || !inner.dst) return { kind: "other" };
        return { kind: "thirdparty", inner, data: decodeFrame(inner, depth + 1) };
      }
      case "_": {
        return { kind: "weather", ...parseWeather(p.slice(9)) };
      }
      case "T": {
        return decodeTelemetry(p);
      }
      default:
        return { kind: "other" };
    }
  }
  function decodePosition(body, timestamp) {
    let fix = null, rest = "", compressed = false;
    const comp = parseCompressed(body);
    if (comp && isValidLatLon(comp.lat, comp.lon)) {
      compressed = true;
      fix = {
        lat: round3(comp.lat),
        lon: round3(comp.lon),
        symbol: lookupSymbol(comp.table, comp.code),
        course: comp.course,
        speedKn: comp.speedKn,
        altitudeM: comp.altitudeM,
        ...comp.rangeKm !== void 0 ? { rangeKm: comp.rangeKm } : {}
      };
      rest = body.slice(13);
      const dao = extractDao(rest);
      if (dao) {
        fix.datum = dao.datum;
        rest = dao.comment;
      }
    } else {
      const u = parseUncompressed(body);
      if (u) {
        fix = u.fix;
        rest = u.rest;
        const dao = extractDao(rest);
        if (dao) {
          fix.datum = dao.datum;
          rest = dao.comment;
          if (!fix.ambiguity) {
            const lat = addMinutes(u.lat, u.south, dao.latMin), lon = addMinutes(u.lon, u.west, dao.lonMin);
            if (isValidLatLon(lat, lon)) {
              fix.lat = round3(lat);
              fix.lon = round3(lon);
            }
          }
        }
      }
    }
    if (!fix) return { kind: "other" };
    if (timestamp) fix.timestamp = timestamp;
    if (fix.symbol?.code === "_") {
      const where = {
        lat: fix.lat,
        lon: fix.lon,
        symbol: fix.symbol,
        ...fix.datum ? { datum: fix.datum } : {},
        ...timestamp ? { timestamp } : {}
      };
      if (compressed && isCompressedWeather(rest))
        return { kind: "weather", ...where, ...parseWeather(rest, { dir: fix.course, kn: fix.speedKn }) };
      if (!compressed && isWeather(rest)) return { kind: "weather", ...where, ...parseWeather(rest) };
    }
    applyExtensions(fix, rest, { compressed });
    return { kind: "position", ...fix };
  }
  function decodeNmea(frame) {
    const n = parseNmea(frame.payload);
    if (!n || n.lat === void 0 || n.lon === void 0) return { kind: "other" };
    const symbol = symbolFromAddress(frame.dst, frame.src);
    const where = { lat: n.lat, lon: n.lon, ...symbol ? { symbol } : {}, nmea: n.sentence };
    if (n.waypoint !== void 0) return { kind: "item", name: n.waypoint, alive: true, ...where };
    return {
      kind: "position",
      ...where,
      ...n.course !== void 0 ? { course: n.course } : {},
      ...n.speedKn !== void 0 ? { speedKn: n.speedKn } : {},
      ...n.altitudeM !== void 0 ? { altitudeM: n.altitudeM } : {},
      ...n.time ? { timestamp: `${n.time}h` } : {}
    };
  }
  function posFields(pos) {
    if (pos.kind !== "position" && pos.kind !== "weather") return {};
    const { kind, ...fields } = pos;
    return fields;
  }
  var STAMP = /^\d{6}[zh/]/;
  function decodeObject(p) {
    const mark = p[10];
    if (mark !== "*" && mark !== "_") return { kind: "other" };
    const name = p.slice(1, 10).trimEnd();
    const after = p.slice(11);
    const timestamp = STAMP.test(after) ? after.slice(0, 7) : void 0;
    const body = timestamp ? after.slice(7) : after;
    return {
      kind: "object",
      name,
      alive: mark === "*",
      ...posFields(decodePosition(body)),
      ...timestamp ? { timestamp } : {}
    };
  }
  function decodeItem(p) {
    const m = /^\)([^!_]{3,9})([!_])(.*)$/s.exec(p);
    if (!m) return { kind: "other" };
    return { kind: "item", name: m[1].trim(), alive: m[2] === "!", ...posFields(decodePosition(m[3])) };
  }
  function decodeMessage(p) {
    const m = /^:(.{9}):(.*)$/s.exec(p);
    if (!m) return { kind: "other" };
    const addressee = m[1].trim();
    const text = m[2];
    const out = { kind: "message", addressee, text };
    const ackRej = /^(ack|rej)([A-Za-z0-9]{1,5})(?:\}[A-Za-z0-9]{0,5})?\s*$/.exec(text);
    if (ackRej) {
      if (ackRej[1] === "ack") out.ack = true;
      else out.rej = true;
      out.msgNo = ackRej[2];
      out.text = "";
      return out;
    }
    const num2 = /\{([A-Za-z0-9]{1,5})(?:\}([A-Za-z0-9]{0,5}))?\s*$/.exec(text);
    if (num2) {
      out.msgNo = num2[1];
      if (num2[2]) out.replyAck = num2[2];
      out.text = text.slice(0, num2.index);
    }
    if (/^(BLN|NWS|SKY)/.test(addressee)) out.bulletin = addressee;
    return out;
  }
  var LINE_BREAK = /[\n\r\u2028\u2029]/;
  function decodeTelemetry(p) {
    const s = p.slice(1);
    if (LINE_BREAK.test(s)) return { kind: "telemetry", analog: [], digital: [] };
    let i = s[0] === "#" ? 1 : 0;
    let seq;
    if (s.startsWith("MIC", i)) {
      i += 3;
    } else {
      const seqStart = i;
      while (i < s.length && s.charCodeAt(i) >= 48 && s.charCodeAt(i) <= 57) i++;
      const seqNum = Number(s.slice(seqStart, i));
      seq = i > seqStart && Number.isSafeInteger(seqNum) ? seqNum : void 0;
    }
    if (s[i] === ",") i++;
    const parts = s.slice(i).split(",");
    const analog = parts.slice(0, 5).map(Number).filter((n) => Number.isFinite(n));
    const bits = parts[5] ?? "";
    const digital = /^[01]{1,8}$/.test(bits) ? [...bits].map((b) => b === "1") : [];
    return { kind: "telemetry", seq, analog, digital };
  }
  var round3 = (n) => Math.round(n * 1e6) / 1e6;
  var round12 = (n) => Math.round(n * 10) / 10;

  // vendor/aprscaching/packages/aprs/src/ax25.ts
  function crcTable(poly, xor = 0) {
    const t = new Uint16Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? c >>> 1 ^ poly : c >>> 1;
      t[i] = c ^ xor;
    }
    return t;
  }
  var SMACK_TABLE = crcTable(40961);
  var FLEX_TABLE = crcTable(33800, 3975);
  var KISS_TIMING_DEFAULTS = Object.freeze({ txDelay: 30, persist: 63, slotTime: 10 });

  // vendor/aprscaching/packages/aprs/src/meshcom/parse.ts
  var utf82 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false });

  // vendor/aprscaching/packages/aprs/src/meshcom/encode.ts
  var utf83 = new TextEncoder();

  // lib/aprs-decode.js
  var PACKET_SAMPLE = "OE8APR-9>APRS,WIDE1-1,qAR,OE8XXX:!4704.41N/01526.27E>088/036/A=001234Mobile";
  function decodeAprsLine(input) {
    const raw = String(input).split(/\r?\n/).find((l) => l.trim())?.trim() ?? "";
    if (!raw) return { ok: false, error: "Paste a raw TNC2 or APRS-IS line." };
    const frame = parseTNC2(raw);
    if (!frame) return { ok: false, error: "Not a TNC2 line: expected SOURCE>DEST,PATH:payload." };
    const q = classifyQ(frame.path);
    const data = decodeAprs(frame);
    return {
      ok: true,
      frame: {
        src: frame.src,
        dst: frame.dst,
        path: frame.path,
        payload: frame.payload,
        heardVia: q.heardVia,
        ...q.igateCall ? { igateCall: q.igateCall } : {}
      },
      data
    };
  }
  function aprsFields(data) {
    const out = [];
    for (const [k, v] of Object.entries(data)) {
      if (k === "kind" || v == null) continue;
      if (typeof v === "object") {
        const str = (x) => typeof x === "string" ? x : "";
        if (k === "symbol" && typeof v.label === "string") {
          out.push([k, `${v.label} (${str(v.table)}${str(v.code)})`]);
          continue;
        }
        out.push([k, JSON.stringify(v)]);
      } else out.push([k, typeof v === "string" ? v : JSON.stringify(v)]);
    }
    return out;
  }

  // tools/packet-decoder/src/index.js
  var VIA = {
    rf: { text: "RF", tone: "ok" },
    aprs_is: { text: "APRS-IS", tone: "muted" }
  };
  function show(r) {
    if (!r.ok) {
      tool.setPanel({ title: "Packet decoder", nodes: [{ kind: "text", text: r.error, tone: "bad" }] });
      return r.error;
    }
    const { frame, data } = r;
    const via = VIA[frame.heardVia] ?? { text: String(frame.heardVia), tone: "default" };
    const fields = aprsFields(data);
    tool.setPanel({
      title: "Packet decoder",
      nodes: [
        { kind: "kv", key: "Source", value: frame.src, tone: "accent" },
        { kind: "kv", key: "Destination", value: frame.dst },
        { kind: "kv", key: "Path", value: frame.path.join(" · ") || "(no path)" },
        { kind: "kv", key: "Heard via", value: frame.igateCall ? `${via.text} (${frame.igateCall})` : via.text },
        { kind: "badge", text: String(data.kind), tone: via.tone },
        ...fields.length ? [{ kind: "table", head: ["Field", "Value"], rows: fields }] : []
      ]
    });
    return `${frame.src} > ${frame.dst}: ${data.kind}, ${fields.length} field${fields.length === 1 ? "" : "s"} in the Packet decoder panel.`;
  }
  tool.setPanel({
    title: "Packet decoder",
    nodes: [{ kind: "text", text: "Paste a raw TNC2 or APRS-IS line into Decode.", tone: "muted" }]
  });
  register({
    decoders: [
      {
        id: "aprs",
        label: "APRS packet",
        kind: "aprs",
        decode: (input) => show(decodeAprsLine(input)),
        sample: PACKET_SAMPLE,
        placeholder: "paste a raw TNC2 / APRS-IS line…"
      }
    ]
  });
})();
