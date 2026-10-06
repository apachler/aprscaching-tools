// SPDX-License-Identifier: MIT
// A stand-in for the APRScaching sandbox, for the tests: it runs a built tools/<name>/tool.js exactly as the
// sandbox's worker does (the body of a function of `register`, `ipc` and `tool`), with the API the tool reference
// documents and the same permission checks, and records what the tool asks of the host. Values cross the boundary
// through structuredClone, as postMessage copies them. Several tools can share one bus.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** What an instance implementing tool API 1.0 offers (`tool.has`). */
const FEATURES = [
  "command",
  "monitor",
  "event",
  "decoder",
  "panel",
  "map",
  "ipc",
  "beacon",
  "network",
  "tx",
  "commands.async",
  "commands.remote",
  "decoders.sample",
  "events.reply",
  "colours.src",
  "bus.provide",
];

/** A tool bus: topics, services (a tool's or the host's) and the sender of each message. */
export function createBus() {
  const subs = new Map();
  const services = new Map();
  return {
    emit(topic, data, from) {
      for (const fn of subs.get(topic) ?? []) fn(structuredClone(data), from);
    },
    subscribe(topic, fn) {
      if (!subs.has(topic)) subs.set(topic, []);
      subs.get(topic).push(fn);
    },
    provide(name, fn) {
      services.set(name, fn);
    },
    async call(name, args) {
      const fn = services.get(name);
      return fn ? structuredClone(await fn(structuredClone(args))) : undefined;
    },
    topics: () => [...subs.keys()],
  };
}

/** The colour a host draws for a monitor line from a tool's rules: exact callsigns first, then the prefixes. */
export function colourFor(rules, line) {
  const exact = rules.find((r) => r.src && r.src.toUpperCase() === line.src.toUpperCase());
  if (exact) return exact.colorVar;
  for (const r of rules) {
    if (r.src || !(r.srcPrefix || r.dstPrefix || r.textIncludes)) continue;
    if (r.srcPrefix && !line.src.toUpperCase().startsWith(r.srcPrefix.toUpperCase())) continue;
    if (r.dstPrefix && !line.dst.toUpperCase().startsWith(r.dstPrefix.toUpperCase())) continue;
    if (r.textIncludes && !line.text.includes(r.textIncludes)) continue;
    return r.colorVar;
  }
  return null;
}

export function readManifest(name) {
  return JSON.parse(fs.readFileSync(path.join(root, "tools", name, "tool.json"), "utf8"));
}

/**
 * Load a built tool. `opts.permissions` overrides the manifest's grants; `opts.bus` shares a bus; `opts.tx(info)`
 * and `opts.beacon(spec)` answer the tool's transmit and beacon requests (granted by default), and may throw as the
 * host does when its gate is closed.
 */
export function loadTool(name, opts = {}) {
  const manifest = readManifest(name);
  const file = path.join(root, "tools", name, manifest.entry ?? "tool.js");
  if (!fs.existsSync(file)) throw new Error(`no ${file}: run node scripts/build.mjs`);
  const script = fs.readFileSync(file, "utf8");
  const granted = opts.permissions ?? manifest.permissions;
  const bus = opts.bus ?? createBus();
  const s = {
    commands: {},
    colourRules: [],
    colourPublishes: 0,
    panel: null,
    map: null,
    decoders: {},
    decoderMeta: [],
    handlers: {},
    logs: [],
    txs: [],
    beacons: [],
  };
  const need = (c) => {
    if (!granted.includes(c)) throw new Error(`permission '${c}' not granted`);
  };
  const clone = (v) => structuredClone(v);
  const tool = {
    permissions: [...granted],
    // the instance's tool API and its features, as the sandbox passes them
    api: Object.freeze({ major: 1, minor: 0 }),
    has: (name) => FEATURES.includes(String(name)),
    log: (m) => s.logs.push(String(m)),
    setPanel: (spec) => {
      need("panel");
      s.panel = clone(spec);
    },
    setMapLayer: (spec) => {
      need("map");
      s.map = clone(spec);
    },
    setColourRules: (rules) => {
      need("monitor");
      // one message: the host drops one over 64 KB of JSON, and the tool log says so
      if (JSON.stringify(rules).length > 64 * 1024) return void s.logs.push("message over 64 KB dropped");
      s.colourPublishes++;
      s.colourRules = clone(rules);
    },
    on: (event, fn) => {
      need(event === "on_frame" ? "monitor" : "event");
      (s.handlers[event] ??= []).push(fn);
    },
    requestTx: async (info) => {
      need("tx");
      s.txs.push(String(info));
      return opts.tx ? opts.tx(String(info)) : true;
    },
    scheduleBeacon: async (spec) => {
      need("beacon");
      if (opts.beacon) opts.beacon(spec);
      s.beacons.push(spec == null ? null : clone(spec));
      return true;
    },
    emit: (topic, data) => {
      need("ipc");
      bus.emit(String(topic), clone(data), name);
    },
    subscribe: (topic, fn) => {
      need("ipc");
      bus.subscribe(String(topic), fn);
    },
    call: async (svc, args) => {
      need("ipc");
      return bus.call(String(svc), clone(args));
    },
    provide: (svc, fn) => {
      need("ipc");
      bus.provide(String(svc), fn);
    },
  };
  const ipc = granted.includes("ipc")
    ? { emit: tool.emit, subscribe: tool.subscribe, call: tool.call, provide: tool.provide, setPanel: tool.setPanel }
    : undefined;
  const register = (t) => {
    s.commands = {};
    for (const [w, v] of Object.entries(t?.commands ?? {})) {
      // as the sandbox does: a command is the operator's alone unless it opts in with { run, remote: true }
      if (typeof v === "function") s.commands[w] = { run: v, remote: false };
      else if (v && typeof v.run === "function") s.commands[w] = { run: v.run, remote: v.remote === true };
    }
    if (Array.isArray(t?.colourRules)) s.colourRules = clone(t.colourRules);
    if (t?.panel !== undefined) s.panel = clone(t.panel);
    s.decoders = {};
    s.decoderMeta = [];
    for (const d of t?.decoders ?? []) {
      s.decoders[d.id] = d.decode;
      s.decoderMeta.push({ id: d.id, label: d.label, kind: d.kind, sample: d.sample, placeholder: d.placeholder });
    }
  };
  new Function("register", "ipc", "tool", script)(register, ipc, tool);

  return {
    manifest,
    state: s,
    bus,
    get panel() {
      return s.panel;
    },
    get map() {
      return s.map;
    },
    commands: () => Object.keys(s.commands),
    /** Run a command as the operator, or as a remote peer: then only a remote tool's remote commands answer (null). */
    async run(word, args = "", { remote = false } = {}) {
      const c = s.commands[word];
      if (!c || (remote && (!manifest.remote || !c.remote))) return null;
      try {
        return [].concat((await c.run(args)) ?? []).map(String);
      } catch (e) {
        return [`error: ${e.message}`];
      }
    },
    async decode(id, input) {
      const fn = s.decoders[id];
      return fn ? String(await fn(String(input))) : "no such decoder";
    },
    /** Raise an event; `reply` stands for the connected surface's reply. Resolves once every handler settled. */
    async dispatch(event, payload = {}, reply) {
      const p = clone(payload);
      if (reply) p.reply = (text) => reply(String(text));
      await Promise.all((s.handlers[event] ?? []).map((fn) => fn(p)));
    },
    colour: (line) => colourFor(s.colourRules, { src: "", dst: "", text: "", ...line }),
  };
}

/** Every tool directory with a built script and a manifest. */
export function toolNames() {
  return fs
    .readdirSync(path.join(root, "tools"), { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(root, "tools", d.name, "tool.json")))
    .map((d) => d.name)
    .sort();
}

export const repoRoot = root;
