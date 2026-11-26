#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Sign a tool.json manifest OR a tool registry with a key file from genkey.mjs. The canonical bytes match the
// APRScaching app's verifier (packages/tools/src/registry.ts in apachler/aprscaching) EXACTLY (stableStringify;
// manifest omits `signature`, registry signs `{ format, entries }`) so the app verifies what this signs.
//
//   node scripts/sign.mjs manifest path/to/tool.json [script] --key <key file>
//   node scripts/sign.mjs registry path/to/registry.json --key <key file>   # entries[] or {entries}
//
// The key file is encrypted (scripts/keyfile.mjs): sign.mjs asks for its passphrase at the terminal, signs in this
// process and starts no other. A key or passphrase in the environment or as an argument is refused.
//
// A manifest's script is its `entry` beside it, which must stay in the manifest's folder. A tool whose `entry` is an
// absolute address, a script its author hosts, names the local copy of that script as the third argument.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { KeyError, loadKey, refuseKeyEnv } from "./keyfile.mjs";

/** A file that cannot be signed as it is: the message says why. */
export class SignError extends Error {}

export const stable = (v) =>
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
const signB64 = async (key, bytes) => Buffer.from(await crypto.subtle.sign("Ed25519", key, bytes)).toString("base64");

/** Sign the manifest `file` in place with { pub, key } (a key from loadKey); `scriptArg` for a hosted script. */
export async function signManifest(file, { pub, key }, scriptArg) {
  const doc = JSON.parse(fs.readFileSync(file, "utf8"));
  // The signature covers the code too: entrySha256 is the SHA-256 of the entry script's exact bytes.
  const entry = doc.entry ?? "tool.js";
  let script;
  if (/^[a-z][a-z0-9+.-]*:/i.test(entry)) {
    if (!scriptArg)
      throw new SignError(`entry ${entry} is an address: name the local copy of the script as the third argument`);
    script = scriptArg;
  } else {
    // the app resolves entry as an address against the manifest's: a root-absolute path, a query, a fragment or an
    // encoded character names another file there than here
    if (/^[/\\]|[?#%]/.test(entry)) throw new SignError(`entry ${entry} is not a plain path beside the manifest`);
    script = path.join(path.dirname(file), entry);
    const r = path.relative(path.dirname(path.resolve(file)), path.resolve(script));
    if (!r || r.startsWith("..") || path.isAbsolute(r))
      throw new SignError(`entry ${entry} leaves the manifest's folder`);
  }
  const entrySha256 = createHash("sha256").update(fs.readFileSync(script)).digest("base64");
  const m = { ...doc, entrySha256, pubkey: pub };
  delete m.signature;
  const out = { ...m, signature: await signB64(key, enc(stable(m))) };
  fs.writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
  return out;
}

/** Sign the registry `file` in place with { pub, key }: its format and entries. */
export async function signRegistry(file, { pub, key }) {
  const doc = JSON.parse(fs.readFileSync(file, "utf8"));
  const entries = Array.isArray(doc) ? doc : doc.entries;
  if (!Array.isArray(entries)) throw new SignError("registry file must be an entries[] array or { entries }");
  // the registry format (1) is signed with the entries, so a reader can tell a newer format from a forged file
  const format = 1;
  const out = { format, entries, authority: pub, sig: await signB64(key, enc(stable({ format, entries }))) };
  fs.writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
  return out;
}

const USAGE = "usage: node scripts/sign.mjs <manifest|registry> <file> [script] --key <key file>";

/** The command line: { kind, file, script, keyFile } or { error }. Every option but --key is refused. */
export function parseArgs(argv) {
  const pos = [];
  let keyFile;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--key") {
      keyFile = argv[++i];
      if (!keyFile || keyFile.startsWith("--")) return { error: "--key needs the key file" };
    } else if (a.startsWith("-"))
      return { error: `${a}: sign.mjs takes the key file and nothing else; the passphrase is typed at the terminal` };
    else pos.push(a);
  }
  const [kind, file, script, extra] = pos;
  if (extra !== undefined) return { error: `unexpected argument ${extra}` };
  if (!kind || !file || !keyFile) return { error: USAGE };
  if (kind !== "manifest" && kind !== "registry") return { error: "kind must be 'manifest' or 'registry'" };
  if (kind === "registry" && script !== undefined) return { error: `unexpected argument ${script}` };
  return { kind, file, script, keyFile };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    refuseKeyEnv();
    const a = parseArgs(process.argv.slice(2));
    if (a.error) throw new SignError(a.error);
    const k = await loadKey(a.keyFile, { label: a.kind === "registry" ? "authority key" : "author key" });
    if (a.kind === "manifest") await signManifest(a.file, k, a.script);
    else await signRegistry(a.file, k);
    console.log(`signed ${a.kind} -> ${a.file}  (authority/pubkey base64url: ${k.pub})`);
  } catch (e) {
    if (!(e instanceof SignError || e instanceof KeyError)) throw e;
    console.error(`sign: ${e.message}`);
    process.exit(2);
  }
}
