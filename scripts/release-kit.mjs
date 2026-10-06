// SPDX-License-Identifier: MIT
// Shared by scripts/release.mjs and scripts/doctor.mjs: running git, gh and node, finding and checking the signing
// key files, and keeping their values out of every line printed.
//
// A key file holds the private value `genkey.mjs --raw` printed: base64 of JSON { pkcs8, pub }. Only `pub`, the
// public key, and its fingerprint are ever printed. `loadKey()` is the one function that returns a private value,
// for the environment of the sign-all child process alone.
import { spawnSync } from "node:child_process";
import { createHash, createPrivateKey, createPublicKey } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** The project repository; `gh` is pointed at it explicitly, so a fork's remotes never decide where a PR goes. */
export const UPSTREAM = "apachler/aprscaching-tools";

/**
 * Run a command. `inherit` streams its output to this terminal (for a CI watch); otherwise output is captured and
 * returned. Never throws: a command that cannot start returns status 127 with the reason in stderr.
 */
export function defaultRunner(cmd, args, { cwd = repoRoot, env, inherit = false, input } = {}) {
  const r = spawnSync(cmd, args, {
    cwd,
    env: env ?? process.env,
    encoding: "utf8",
    input,
    stdio: inherit ? ["inherit", "inherit", "inherit"] : ["pipe", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.error) return { status: 127, stdout: "", stderr: `${cmd}: ${r.error.code ?? r.error.message}` };
  return { status: r.status ?? 1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

/**
 * The key files: in TOOL_KEYS_DIR, by default $XDG_CONFIG_HOME/aprscaching-tools/keys (~/.config/aprscaching-tools/keys
 * when XDG_CONFIG_HOME is unset or not absolute), each overridable on its own. The folder lies outside every
 * repository, so no `git add` can pick a key up.
 */
export function keyFiles(env = process.env) {
  const home = env.HOME || os.homedir();
  const config = env.XDG_CONFIG_HOME && path.isAbsolute(env.XDG_CONFIG_HOME) ? env.XDG_CONFIG_HOME : path.join(home, ".config");
  const dir = env.TOOL_KEYS_DIR || path.join(config, "aprscaching-tools", "keys");
  return {
    dir,
    author: env.TOOL_AUTHOR_KEY_FILE || path.join(dir, "oe8apr-tool-author.key"),
    authority: env.TOOL_AUTHORITY_KEY_FILE || path.join(dir, "registry-authority.key"),
  };
}

/**
 * The git working tree a path lies in, or null: the nearest folder at or above it (from its nearest existing
 * ancestor, symlinks resolved) that holds a `.git` folder or file. A path that does not exist yet still counts, since
 * a key written there would land in the tree.
 */
export function workTreeOf(p) {
  let cur = path.resolve(p);
  while (!fs.existsSync(cur) && path.dirname(cur) !== cur) cur = path.dirname(cur);
  try {
    cur = fs.realpathSync(cur);
  } catch {
    /* unreadable: walk the path as given */
  }
  for (;;) {
    if (fs.existsSync(path.join(cur, ".git"))) return cur;
    const up = path.dirname(cur);
    if (up === cur) return null;
    cur = up;
  }
}

/**
 * Where the key files live, without reading them: { fails, warns }, each a list of lines. A key folder inside a git
 * working tree fails; a folder others can open (not mode 700) warns.
 */
export function inspectKeyFolder(files) {
  const fails = [];
  const warns = [];
  const trees = new Set();
  // the folders that hold the two files: TOOL_KEYS_DIR, or wherever a per-file override points
  const folders = [...new Set([files.author, files.authority].map((f) => path.dirname(path.resolve(f))))];
  for (const d of folders) {
    const tree = workTreeOf(d);
    if (tree && !trees.has(tree)) {
      trees.add(tree);
      fails.push(`the key folder ${d} lies inside a git working tree (${tree}); move the keys to a folder outside every repository`);
    }
  }
  for (const d of folders) {
    let st;
    try {
      st = fs.statSync(d);
    } catch {
      continue;
    }
    const mode = st.mode & 0o777;
    if (st.isDirectory() && mode !== 0o700) warns.push(`the key folder ${d} has mode ${mode.toString(8)}; run chmod 700 ${d}`);
  }
  return { fails, warns };
}

/** The fingerprint the app and the documentation show: the first 64 bits of SHA-256 over the raw Ed25519 key. */
export function fingerprint(pub) {
  const raw = Buffer.from(pub, "base64url");
  const hex = createHash("sha256").update(raw).digest("hex").slice(0, 16);
  return hex.match(/.{4}/g).join(" ");
}

/** Parse a private value without ever putting any of it into an error message. Returns { pub } or { error }. */
function parsePrivate(value) {
  let doc;
  try {
    doc = JSON.parse(Buffer.from(value, "base64").toString("utf8"));
  } catch {
    return { error: "is not a private value from genkey.mjs (not base64 JSON)" };
  }
  if (!doc || typeof doc.pkcs8 !== "string" || typeof doc.pub !== "string")
    return { error: "is not a private value from genkey.mjs (no pkcs8 and pub)" };
  let derived;
  try {
    const priv = createPrivateKey({ key: Buffer.from(doc.pkcs8, "base64"), format: "der", type: "pkcs8" });
    if (priv.asymmetricKeyType !== "ed25519") return { error: "holds a key that is not Ed25519" };
    derived = createPublicKey(priv).export({ format: "jwk" }).x;
  } catch {
    return { error: "holds a private key that does not load" };
  }
  if (derived !== doc.pub) return { error: "holds a public key that is not its private key's" };
  return { pub: doc.pub };
}

/**
 * Check a key file without returning its value: { state, pub?, detail? } where state is "missing", "mode" (readable
 * by others), "unreadable", "invalid" or "ok". `pub` is the public key, set when the file parses.
 */
export function inspectKey(file) {
  let st;
  try {
    st = fs.statSync(file);
  } catch {
    return { state: "missing", detail: `${file} does not exist` };
  }
  if (!st.isFile()) return { state: "invalid", detail: `${file} is not a file` };
  const mode = st.mode & 0o777;
  let value;
  try {
    value = fs.readFileSync(file, "utf8").trim();
  } catch {
    return { state: "unreadable", detail: `${file} can't be read` };
  }
  const p = parsePrivate(value);
  if (p.error) return { state: "invalid", detail: `${file} ${p.error}` };
  if (mode & 0o077)
    return { state: "mode", pub: p.pub, detail: `${file} has mode ${mode.toString(8)}; run chmod 600 ${file}` };
  return { state: "ok", pub: p.pub };
}

/** The private value of a key file that `inspectKey` passed, for one child process's environment. */
export function loadKey(file) {
  return fs.readFileSync(file, "utf8").trim();
}

/** Replace every occurrence of a secret (and its decoded parts) in text that is about to be printed. */
export function redact(text, secrets) {
  let out = String(text ?? "");
  for (const s of secrets) {
    if (!s) continue;
    const parts = [s];
    try {
      const doc = JSON.parse(Buffer.from(s, "base64").toString("utf8"));
      if (typeof doc?.pkcs8 === "string") parts.push(doc.pkcs8, Buffer.from(s, "base64").toString("utf8"));
    } catch {
      /* not a private value: the string itself is redacted */
    }
    for (const p of parts) if (p.length >= 8) out = out.split(p).join("[redacted]");
  }
  return out;
}

/** owner/repo from a GitHub remote URL (https or ssh), or null. */
export function repoSlug(url) {
  const m = /github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/.exec(String(url ?? "").trim());
  return m ? `${m[1]}/${m[2]}` : null;
}

/** The author keys the registry lists for an author (by default the project's own, OE8APR). */
export function authorKeysOf(registry, author = "OE8APR") {
  return [...new Set((registry?.entries ?? []).filter((e) => e.author === author).map((e) => e.pubkey))];
}

/** The pnpm command: through corepack, which reads the version from package.json's packageManager. */
export const PNPM = ["corepack", ["pnpm"]];
export const corepackEnv = (env = process.env) => ({ ...env, COREPACK_ENABLE_DOWNLOAD_PROMPT: "0" });
