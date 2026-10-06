#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Verify this repository the way the APRScaching app verifies it: the registry's Ed25519 signature against a
// pinned authority key, then every entry's tool.json signature against the manifest's own `pubkey`, and the
// entry's `pubkey` against the manifest's. No dependencies: Node's WebCrypto Ed25519 and the same canonical
// JSON as the app (packages/tools/src/registry.ts in apachler/aprscaching).
//
//   node scripts/verify.mjs [registry.json] [--strict]
//
// The pinned authority comes from the AUTHORITY environment variable, or else from authority.pub beside the
// registry. A signature that is missing or no longer holds (the registry's, a manifest's, a script's hash) is listed
// as unsigned: a changed tool on dev stays unsigned until the next release. --strict, for main and release tags,
// fails on those, and on an entry address that leaves the repository when the registry is served from a subpath
// (raw.githubusercontent.com/<owner>/<repo>/<tag>/registry.json), which is otherwise a warning. The registry format,
// each manifest's api and every file the registry names are checked either way.
// Exits 1 on any failure, 2 on a usage error.
import fs from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const args = process.argv.slice(2);
const strict = args.includes("--strict");
const registryPath = path.resolve(args.find((a) => !a.startsWith("--")) ?? "registry.json");
const root = path.dirname(registryPath);

// The canonical bytes: object keys sorted, unset fields left out — byte for byte what the app signs and checks.
const stable = (v) =>
  v === null || typeof v !== "object"
    ? JSON.stringify(v)
    : Array.isArray(v)
      ? `[${v.map(stable).join(",")}]`
      : `{${Object.keys(v)
          .filter((k) => v[k] !== undefined)
          .sort()
          .map((k) => `${JSON.stringify(k)}:${stable(v[k])}`)
          .join(",")}}`;
const enc = (s) => new TextEncoder().encode(s);
// Accepts base64 and base64url alike, as the app's b64ToBytes does.
const bytes = (b64) => Uint8Array.from(atob(b64.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function ed25519Verify(pubB64url, sigB64, data) {
  try {
    const key = await crypto.subtle.importKey("raw", bytes(pubB64url), { name: "Ed25519" }, false, ["verify"]);
    return await crypto.subtle.verify("Ed25519", key, bytes(sigB64), data);
  } catch {
    return false;
  }
}

/** A manifest's `api`: the tool API version it needs, MAJOR.MINOR (packages/tools api.ts in the app). */
const API_RE = /^(0|[1-9][0-9]{0,3})\.(0|[1-9][0-9]{0,3})$/;

let failures = 0;
let warnings = 0;
const ok = (m) => console.log(`ok    ${m}`);
const info = (m) => console.log(`info  ${m}`);
const warn = (m) => {
  warnings++;
  console.log(`warn  ${m}`);
};
const fail = (m) => {
  failures++;
  console.log(`FAIL  ${m}`);
};
// A signature that is missing or no longer holds: on dev a changed tool stays unsigned until the next release, so
// it is listed; --strict (main, release tags) fails on it.
let unsignedCount = 0;
const unsigned = (m) => {
  if (strict) return fail(m);
  unsignedCount++;
  console.log(`UNSIG ${m}`);
};
const rel = (p) => path.relative(root, p) || ".";

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    fail(`${rel(file)}: ${e.code === "ENOENT" ? "missing" : `not valid JSON (${e.message})`}`);
    return null;
  }
}

// The manifest's own signature: every field except `signature`, with `pubkey` included.
async function manifestSig(m) {
  if (typeof m.signature !== "string" || typeof m.pubkey !== "string" || !m.signature || !m.pubkey) return "unsigned";
  const rest = { ...m };
  delete rest.signature;
  return (await ed25519Verify(m.pubkey, m.signature, enc(stable(rest)))) ? "valid" : "invalid";
}

// ---- the pinned authority ----
let authority = process.env.AUTHORITY?.trim();
let authoritySource = "AUTHORITY";
if (!authority) {
  const file = path.join(root, "authority.pub");
  if (!fs.existsSync(file)) {
    console.error("no pinned authority: set AUTHORITY or write the key to authority.pub beside the registry");
    process.exit(2);
  }
  authority = fs.readFileSync(file, "utf8").trim();
  authoritySource = "authority.pub";
}
info(`pinned authority ${authority} (from ${authoritySource})`);

// ---- the registry ----
const reg = readJson(registryPath);
if (!reg) process.exit(1);
if (!Array.isArray(reg.entries) || typeof reg.sig !== "string") {
  fail(`${rel(registryPath)}: needs an entries array and a sig`);
  process.exit(1);
}
if (reg.format !== 1) fail(`registry format ${reg.format ?? "(none)"}: this verifier and the app read format 1`);
if (reg.authority !== authority) fail(`registry authority ${reg.authority} is not the pinned key`);
else if (!(await ed25519Verify(reg.authority, reg.sig, enc(stable({ format: reg.format, entries: reg.entries })))))
  unsigned("registry signature does not verify over its format and entries");
else ok(`registry signature verifies (${reg.entries.length} entries)`);

// Entry addresses resolve against the registry's own URL. Simulate the subpath it is published under, so an
// address that only works at a web root shows up here and not on a user's screen.
const SERVED = "https://raw.githubusercontent.com/OWNER/aprscaching-tools/TAG/";
const servedRegistry = new URL("registry.json", SERVED);
const listed = new Set();
const names = new Set();

for (const [i, e] of reg.entries.entries()) {
  const label = `entry ${i} (${e?.name ?? "?"})`;
  for (const k of ["name", "title", "author", "version", "pubkey", "entry"])
    if (typeof e?.[k] !== "string" || !e[k]) fail(`${label}: field ${k} missing`);
  if (typeof e?.entry !== "string" || typeof e?.name !== "string") continue;
  if (names.has(e.name)) fail(`${label}: name listed twice`);
  names.add(e.name);

  let url;
  try {
    url = new URL(e.entry, servedRegistry);
  } catch {
    fail(`${label}: entry "${e.entry}" is not a URL`);
    continue;
  }

  let manifest;
  let manifestFile;
  if (url.origin !== servedRegistry.origin) {
    // Hosted by its author elsewhere: fetch it as the app would, without cookies.
    try {
      const res = await fetch(url, { credentials: "omit" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      manifest = await res.json();
    } catch (err) {
      fail(`${label}: cannot fetch ${url.href} (${err.message})`);
      continue;
    }
    info(`${label}: fetched ${url.href}`);
  } else {
    let local;
    if (url.href.startsWith(SERVED)) local = decodeURIComponent(url.href.slice(SERVED.length));
    else {
      // Root-absolute ("/tools/hello/tool.json"): right at an instance's web root, wrong under a repo subpath.
      local = decodeURIComponent(url.pathname).replace(/^\/+/, "");
      const msg = `${label}: entry "${e.entry}" resolves to ${url.href} when served from a subpath, outside the repository; write it relative to registry.json ("${local}")`;
      if (strict) fail(msg);
      else warn(msg);
    }
    manifestFile = path.join(root, local);
    listed.add(path.resolve(manifestFile));
    manifest = readJson(manifestFile);
    if (!manifest) continue;
  }

  if (manifest.name !== e.name) fail(`${label}: manifest name is "${manifest.name}"`);
  if (!API_RE.test(manifest.api ?? ""))
    fail(`${label}: manifest needs "api": "MAJOR.MINOR", the tool API version it needs (got ${JSON.stringify(manifest.api)})`);
  // the entry repeats what the manifest says; sign-all copies it at release, so on dev a changed tool may differ
  for (const k of ["title", "author", "version", "description"]) {
    if (manifest[k] === e[k] || (k === "description" && e[k] === undefined)) continue;
    const msg = `${label}: ${k} "${e[k]}" differs from the manifest's "${manifest[k]}"`;
    if (strict) fail(msg);
    else warn(msg);
  }

  const sig = await manifestSig(manifest);
  if (sig === "unsigned") unsigned(`${label}: manifest is unsigned; a listed tool must be signed by its author`);
  else if (sig === "invalid") unsigned(`${label}: manifest signature does not verify with its pubkey`);
  else if (manifest.pubkey !== e.pubkey)
    fail(`${label}: entry pubkey ${e.pubkey} is not the manifest's ${manifest.pubkey}`);
  else ok(`${label}: manifest signed by ${manifest.pubkey}, matching the entry`);

  if (manifestFile) {
    const script = path.join(path.dirname(manifestFile), manifest.entry ?? "tool.js");
    if (!fs.existsSync(script)) fail(`${label}: script ${rel(script)} is missing`);
    else {
      const hash = createHash("sha256").update(fs.readFileSync(script)).digest("base64");
      if (typeof manifest.entrySha256 !== "string") unsigned(`${label}: manifest has no entrySha256; sign it again with scripts/sign.mjs`);
      else if (manifest.entrySha256 !== hash) unsigned(`${label}: ${rel(script)} does not match the manifest's entrySha256`);
      else ok(`${label}: script matches the signed entrySha256`);
    }
  }
}

// ---- tools in the repository that the registry does not list (proposals awaiting signature or listing) ----
const toolsDir = path.join(root, "tools");
if (fs.existsSync(toolsDir)) {
  for (const d of fs.readdirSync(toolsDir, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const file = path.join(toolsDir, d.name, "tool.json");
    if (!fs.existsSync(file) || listed.has(path.resolve(file))) continue;
    const m = readJson(file);
    if (!m) continue;
    const sig = await manifestSig(m);
    if (sig === "invalid") unsigned(`${rel(file)}: manifest signature does not verify with its pubkey`);
    else if (sig === "unsigned") info(`${rel(file)}: unsigned and not listed in the registry`);
    else info(`${rel(file)}: signed by ${m.pubkey}, not listed in the registry`);
  }
}

console.log(`\n${failures} failure(s), ${warnings} warning(s), ${unsignedCount} unsigned (signed at release; --strict fails on them)`);
process.exit(failures ? 1 : 0);
