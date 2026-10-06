#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Sign a tool.json manifest OR a tool registry with a TOOL_PRIVATE_KEY (from genkey.mjs). The canonical
// bytes match the APRScaching app's verifier (packages/tools/src/registry.ts in apachler/aprscaching)
// EXACTLY (stableStringify; manifest omits `signature`, registry signs `{ format, entries }`) so the app verifies
// what this signs.
//
//   TOOL_PRIVATE_KEY=... node scripts/sign.mjs manifest path/to/tool.json [script]
//   TOOL_PRIVATE_KEY=... node scripts/sign.mjs registry path/to/registry.json   # entries[] or {entries}
//
// A manifest's script is its `entry` beside it, which must stay in the manifest's folder. A tool whose `entry` is an
// absolute address, a script its author hosts, names the local copy of that script as the third argument.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

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

const [, , kind, file, scriptArg] = process.argv;
const privB64 = process.env.TOOL_PRIVATE_KEY;
if (!kind || !file || !privB64) {
  console.error("usage: TOOL_PRIVATE_KEY=... node scripts/sign.mjs <manifest|registry> <file> [script]");
  process.exit(2);
}

const { pkcs8, pub } = JSON.parse(Buffer.from(privB64, "base64").toString());
const key = await crypto.subtle.importKey("pkcs8", Buffer.from(pkcs8, "base64"), { name: "Ed25519" }, false, ["sign"]);
const signB64 = async (bytes) => Buffer.from(await crypto.subtle.sign("Ed25519", key, bytes)).toString("base64");
const enc = (s) => new TextEncoder().encode(s);

const doc = JSON.parse(fs.readFileSync(file, "utf8"));
let out;
if (kind === "manifest") {
  // The signature covers the code too: entrySha256 is the SHA-256 of the entry script's exact bytes.
  const entry = doc.entry ?? "tool.js";
  let script;
  if (/^[a-z][a-z0-9+.-]*:/i.test(entry)) {
    if (!scriptArg) {
      console.error(`entry ${entry} is an address: name the local copy of the script as the third argument`);
      process.exit(2);
    }
    script = scriptArg;
  } else {
    script = path.join(path.dirname(file), entry);
    const r = path.relative(path.dirname(path.resolve(file)), path.resolve(script));
    if (!r || r.startsWith("..") || path.isAbsolute(r)) {
      console.error(`entry ${entry} leaves the manifest's folder`);
      process.exit(2);
    }
  }
  const entrySha256 = createHash("sha256").update(fs.readFileSync(script)).digest("base64");
  const m = { ...doc, entrySha256, pubkey: pub };
  delete m.signature;
  out = { ...m, signature: await signB64(enc(stable(m))) };
} else if (kind === "registry") {
  const entries = Array.isArray(doc) ? doc : doc.entries;
  if (!Array.isArray(entries)) {
    console.error("registry file must be an entries[] array or { entries }");
    process.exit(2);
  }
  // the registry format (1) is signed with the entries, so a reader can tell a newer format from a forged file
  const format = 1;
  out = { format, entries, authority: pub, sig: await signB64(enc(stable({ format, entries }))) };
} else {
  console.error("kind must be 'manifest' or 'registry'");
  process.exit(2);
}

fs.writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
console.log(`signed ${kind} -> ${file}  (authority/pubkey base64url: ${pub})`);
