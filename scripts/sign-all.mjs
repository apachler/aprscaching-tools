#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Sign a release in one step, on the computer that holds the keys, in a terminal of the maintainer's:
//
//   node scripts/sign-all.mjs
//
//   1. checks that every committed tool.js matches a fresh build of its sources (scripts/build.mjs --check);
//   2. checks every listed manifest, and that the key files are encrypted and hold the keys authority.pub and the
//      registry name;
//   3. opens the author key and the authority key, each with its passphrase typed at the terminal;
//   4. signs each listed tool.json with the author key, which also pins the script's SHA-256 (entrySha256); a
//      manifest signed by another author's key is left as it is; copies each local manifest's pubkey, title, author,
//      version and description into its registry entry; and signs the registry with the authority key;
//   5. lets go of both keys, then runs scripts/verify.mjs --strict.
//
// The key files are found as release-kit.mjs `keyFiles` says. Every child process (build --check, verify) runs
// while no key is open, and signing happens in this process: a key is never in an environment, an argument or a
// file other than its encrypted key file, and nothing else runs from the moment it opens until it is let go.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { KeyError, loadKey, readPassphrase, refuseKeyEnv } from "./keyfile.mjs";
import { inspectKey, keyFiles } from "./release-kit.mjs";
import { SignError, signManifest, signRegistry, stable } from "./sign.mjs";

const b64 = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

/** Why a manifest signed by another key no longer holds as it is (its signature or its script hash), or null. */
async function signedAsIs(m, script) {
  if (typeof m.signature !== "string") return "it carries no signature";
  const rest = { ...m };
  delete rest.signature;
  let ok;
  try {
    const key = await crypto.subtle.importKey("raw", b64(m.pubkey), { name: "Ed25519" }, false, ["verify"]);
    ok = await crypto.subtle.verify("Ed25519", key, b64(m.signature), new TextEncoder().encode(stable(rest)));
  } catch {
    ok = false;
  }
  if (!ok) return "its signature does not verify (the manifest changed after it was signed)";
  if (!fs.existsSync(script)) return "its script is missing";
  const hash = createHash("sha256").update(fs.readFileSync(script)).digest("base64");
  if (m.entrySha256 !== hash) return "its script does not match the signed entrySha256";
  return null;
}

/** A failure that ends the run: nothing more is signed. `code` is the exit code: 2 for the keys, else 1. */
class Stop extends Error {
  constructor(message, code = 1) {
    super(message);
    this.code = code;
  }
}

/**
 * The one way sign-all starts a child process: `child(args)` calls `run(args)` only while no key is open, and throws
 * between `open()` and `close()`, so no other program runs while a key is held in this process.
 */
export function keyGuard(run) {
  let open = false;
  return {
    open: () => {
      open = true;
    },
    close: () => {
      open = false;
    },
    child: (a) => {
      if (open) throw new Error("a child process was about to start while a key is open");
      run(a);
    },
  };
}

/**
 * Sign the repository at `root`. `run(args)` runs a script of the repository with node (default: a child process
 * with this terminal); `ask(prompt)` reads a passphrase (default: the terminal). Returns an exit code.
 */
export async function signAll({
  root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  env = process.env,
  args = [],
  ask = readPassphrase,
  run = (a) => execFileSync(process.execPath, a, { cwd: root, env, stdio: "inherit" }),
  log = (m) => console.log(m),
  error = (m) => console.error(m),
} = {}) {
  const guard = keyGuard(run);
  const child = guard.child;
  const step = (msg) => log(`\n== ${msg}`);
  const keys = {};
  try {
    if (args.length)
      throw new Stop(`sign-all takes no arguments (${args[0]}); the passphrases are typed at the terminal`, 2);
    refuseKeyEnv(env);

    // The key files' public keys, read without opening them, so every check below runs before a key is open.
    const files = keyFiles(env);
    const author = inspectKey(files.author);
    const authority = inspectKey(files.authority);
    for (const [name, k] of [
      ["author", author],
      ["authority", authority],
    ])
      if (k.state !== "ok") throw new Stop(`the ${name} key: ${k.detail}`, 2);
    const pinned = fs.readFileSync(path.join(root, "authority.pub"), "utf8").trim();
    if (authority.pub !== pinned)
      throw new Stop(`the authority key file holds ${authority.pub}, but authority.pub pins ${pinned}`, 2);

    step("the built scripts match their sources");
    child(["scripts/build.mjs", "--check"]);

    const regPath = path.join(root, "registry.json");
    const reg = JSON.parse(fs.readFileSync(regPath, "utf8"));
    const hosted = (e) => /^[a-z][a-z0-9+.-]*:/i.test(e.entry);

    // Check everything before anything is written: a manifest left to another author must still verify as it is,
    // and every local manifest must exist and parse, so a failure never leaves some tool.json files signed and
    // others not.
    step("checking every listed manifest before signing");
    const plan = [];
    for (const e of reg.entries) {
      if (hosted(e)) {
        log(`skip  ${e.name}: hosted by its author at ${e.entry}`);
        continue;
      }
      const file = path.join(root, e.entry);
      const r = path.relative(root, path.resolve(file));
      if (!r || r.startsWith("..") || path.isAbsolute(r) || /%2f|%5c/i.test(e.entry))
        throw new Stop(`${e.name}'s entry ${e.entry} leaves the repository; nothing was signed`);
      let m;
      try {
        m = JSON.parse(fs.readFileSync(file, "utf8"));
      } catch (err) {
        throw new Stop(`${e.entry} can't be read (${err.message}); nothing was signed`);
      }
      const own = !m.pubkey || m.pubkey === author.pub;
      if (own && !fs.existsSync(path.join(path.dirname(file), m.entry ?? "tool.js")))
        throw new Stop(`${e.name}'s script ${m.entry ?? "tool.js"} is missing; nothing was signed`);
      if (!own) {
        const why = await signedAsIs(m, path.join(path.dirname(file), m.entry ?? "tool.js"));
        if (why)
          throw new Stop(
            `${e.name} is signed by ${m.pubkey}, not this author key, and ${why}; ask its author to sign it again. Nothing was signed.`,
          );
        log(`ok    ${e.name}: signed by its own author key ${m.pubkey}, and the signature holds`);
      }
      plan.push({ e, file, own });
    }

    step("opening the keys: type each passphrase");
    guard.open();
    keys.author = await loadKey(files.author, { label: "author key", ask, expectedPub: author.pub });
    keys.authority = await loadKey(files.authority, { label: "authority key", ask, expectedPub: authority.pub });

    step(`signing the tools with the author key ${author.pub}`);
    for (const { e, file, own } of plan) {
      const signed = own ? await signManifest(file, keys.author) : JSON.parse(fs.readFileSync(file, "utf8"));
      if (own) log(`signed ${e.entry}`);
      Object.assign(e, {
        pubkey: signed.pubkey,
        title: signed.title,
        author: signed.author,
        version: signed.version,
        description: signed.description,
      });
    }
    fs.writeFileSync(regPath, JSON.stringify(reg, null, 2) + "\n");

    step(`signing the registry with the authority key ${authority.pub}`);
    await signRegistry(regPath, keys.authority);
    keys.author = keys.authority = undefined;
    guard.close();
    log("the keys are let go");

    step("verifying");
    child(["scripts/verify.mjs", "--strict"]);
    log("\nsign-all: done. Review `git diff`, then commit with a sign-off.");
    return 0;
  } catch (e) {
    // a child that failed (execFileSync's error carries its exit status) has printed its own reason
    if (!(e instanceof Stop || e instanceof KeyError || e instanceof SignError || e?.status !== undefined)) throw e;
    error(`sign-all: ${e.message}`);
    return e instanceof KeyError ? 2 : e instanceof Stop ? e.code : 1;
  } finally {
    keys.author = keys.authority = undefined;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exit(await signAll({ args: process.argv.slice(2) }));
}
