// SPDX-License-Identifier: MIT
// The signing key file: an Ed25519 private key encrypted with a passphrase, and the passphrase typed at a terminal.
// Used by genkey.mjs, sign.mjs and sign-all.mjs; a registry publisher copies it beside them.
//
// A key file is JSON:
//
//   { "format": "aprscaching-tools-key/1", "pub": "<raw Ed25519 public key, base64url>",
//     "kdf": { "name": "scrypt", "N": 131072, "r": 8, "p": 1, "salt": "<base64>" },
//     "cipher": { "name": "aes-256-gcm", "iv": "<base64>", "tag": "<base64>" }, "data": "<base64>" }
//
// `data` is the PKCS#8 private key, encrypted with AES-256-GCM under a key scrypt derives from the passphrase. The
// format, `pub` and the scrypt parameters are the authenticated additional data, so none of them can be changed
// without the file failing to open. `pub` stays readable, so the doctor and the release check can match a key file
// against authority.pub and the registry without opening it.
//
// Reading the file alone gives nothing that signs: the passphrase is asked for at the terminal, inside the process
// that signs, at the moment it signs. It is never taken from an argument, an environment variable or a file, so a
// process the maintainer runs for anything else cannot open the key unasked. A key opens into a non-extractable
// WebCrypto key held by that one process.
import { createCipheriv, createDecipheriv, createPrivateKey, createPublicKey, randomBytes, scrypt } from "node:crypto";
import fs from "node:fs";

export const FORMAT = "aprscaching-tools-key/1";
/** scrypt cost: 128 MiB and about a second per try on a laptop, which is what makes guessing a passphrase slow. */
export const SCRYPT = { N: 2 ** 17, r: 8, p: 1 };
/** The scrypt cost a key file may name: a floor that keeps guessing slow, a ceiling that keeps opening bounded. */
const N_MIN = 2 ** 14;
const N_MAX = 2 ** 20;
export const MIN_PASSPHRASE = 12;

/** The command that turns a key file in the plain form into this one, keeping its key. */
export const convertCommand = (file) => `node scripts/genkey.mjs --convert ${file}`;

/** A key that cannot be opened or written: the message says why and what is needed, never any of the key. */
export class KeyError extends Error {}

/**
 * Where a key must never come from. The signers take their keys from key files and a passphrase typed at the
 * terminal; a key or passphrase set in the environment is refused, so no one relies on a value that would sit in
 * /proc/<pid>/environ for every child to read.
 */
export function refuseKeyEnv(env = process.env) {
  const named = Object.keys(env).filter(
    (k) => ["AUTHOR_KEY", "AUTHORITY_KEY", "TOOL_PRIVATE_KEY"].includes(k) || /PASSPHRASE/i.test(k),
  );
  if (named.length)
    throw new KeyError(
      `${named.join(", ")} is set: a key opens only from its key file, with the passphrase typed at the terminal; unset it`,
    );
}

const b64 = (buf) => Buffer.from(buf).toString("base64");
const aad = (pub, kdf) => Buffer.from(`${FORMAT}\0${pub}\0${kdf.N},${kdf.r},${kdf.p}\0${kdf.salt}`);

function derive(passphrase, kdf) {
  const { N, r, p } = kdf;
  return new Promise((resolve, reject) =>
    scrypt(
      Buffer.from(passphrase.normalize("NFC"), "utf8"),
      Buffer.from(kdf.salt, "base64"),
      32,
      { N, r, p, maxmem: 256 * N * r },
      (err, key) => (err ? reject(err) : resolve(key)),
    ),
  );
}

/** The public key of a PKCS#8 Ed25519 private key (DER), base64url; throws when it is not one. */
function pubOfPkcs8(der) {
  const priv = createPrivateKey({ key: der, format: "der", type: "pkcs8" });
  if (priv.asymmetricKeyType !== "ed25519") throw new KeyError("the key is not Ed25519");
  return createPublicKey(priv).export({ format: "jwk" }).x;
}

/** The text of a new key file holding `der` (PKCS#8), encrypted with `passphrase`. */
export async function encryptKey(der, passphrase, { N = SCRYPT.N } = {}) {
  if (typeof passphrase !== "string" || [...passphrase].length < MIN_PASSPHRASE)
    throw new KeyError(`the passphrase needs at least ${MIN_PASSPHRASE} characters`);
  const pub = pubOfPkcs8(der);
  const kdf = { name: "scrypt", N, r: SCRYPT.r, p: SCRYPT.p, salt: b64(randomBytes(16)) };
  const key = await derive(passphrase, kdf);
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  c.setAAD(aad(pub, kdf));
  const data = Buffer.concat([c.update(der), c.final()]);
  key.fill(0);
  const doc = { format: FORMAT, pub, kdf, cipher: { name: "aes-256-gcm", iv: b64(iv), tag: b64(c.getAuthTag()) } };
  return JSON.stringify({ ...doc, data: b64(data) }, null, 2) + "\n";
}

/**
 * What a key file's text holds, without a passphrase: { form: "encrypted", pub, doc }, { form: "plain", pub } for
 * the base64 JSON { pkcs8, pub } that holds the private key in the clear, or { error }. No error names any of the key.
 */
export function readKeyText(text) {
  const t = String(text ?? "").trim();
  let doc;
  try {
    doc = JSON.parse(t);
  } catch {
    doc = undefined;
  }
  if (doc && typeof doc === "object" && doc.format !== undefined) {
    if (doc.format !== FORMAT) return { error: `is a key file of format ${String(doc.format)}, not ${FORMAT}` };
    const k = doc.kdf;
    const ok =
      typeof doc.pub === "string" &&
      /^[A-Za-z0-9_-]{43}$/.test(doc.pub) &&
      k?.name === "scrypt" &&
      Number.isInteger(k.N) &&
      k.N >= N_MIN &&
      k.N <= N_MAX &&
      (k.N & (k.N - 1)) === 0 &&
      k.r === SCRYPT.r &&
      k.p === SCRYPT.p &&
      typeof k.salt === "string" &&
      doc.cipher?.name === "aes-256-gcm" &&
      typeof doc.cipher.iv === "string" &&
      typeof doc.cipher.tag === "string" &&
      typeof doc.data === "string";
    if (!ok) return { error: `is not a complete ${FORMAT} key file` };
    return { form: "encrypted", pub: doc.pub, doc };
  }
  let plain;
  try {
    plain = JSON.parse(Buffer.from(t, "base64").toString("utf8"));
  } catch {
    return { error: "is not a key file from genkey.mjs" };
  }
  if (!plain || typeof plain.pkcs8 !== "string" || typeof plain.pub !== "string")
    return { error: "is not a key file from genkey.mjs" };
  let derived;
  try {
    derived = pubOfPkcs8(Buffer.from(plain.pkcs8, "base64"));
  } catch {
    return { error: "holds a private key that does not load" };
  }
  if (derived !== plain.pub) return { error: "holds a public key that is not its private key's" };
  return { form: "plain", pub: plain.pub, pkcs8: plain.pkcs8 };
}

/**
 * Open an encrypted key file's text with a passphrase: { pub, key } with `key` a non-extractable Ed25519 signing
 * CryptoKey. A wrong passphrase, or a file changed after it was written, fails the same way.
 */
export async function decryptKey(text, passphrase, file = "the key file") {
  const r = readKeyText(text);
  if (r.error) throw new KeyError(`${file} ${r.error}`);
  if (r.form === "plain")
    throw new KeyError(`${file} holds its private key unencrypted; encrypt it first: ${convertCommand(file)}`);
  const { doc } = r;
  const dk = await derive(passphrase, doc.kdf);
  let der;
  try {
    const d = createDecipheriv("aes-256-gcm", dk, Buffer.from(doc.cipher.iv, "base64"));
    d.setAAD(aad(doc.pub, doc.kdf));
    d.setAuthTag(Buffer.from(doc.cipher.tag, "base64"));
    der = Buffer.concat([d.update(Buffer.from(doc.data, "base64")), d.final()]);
  } catch {
    throw new KeyError(`${file} does not open: a wrong passphrase, or the file changed after it was written`);
  } finally {
    dk.fill(0);
  }
  try {
    if (pubOfPkcs8(der) !== doc.pub) throw new KeyError(`${file} holds a public key that is not its private key's`);
    const key = await crypto.subtle.importKey("pkcs8", der, { name: "Ed25519" }, false, ["sign"]);
    return { pub: doc.pub, key };
  } finally {
    der.fill(0);
  }
}

/**
 * Read a passphrase typed at the terminal, without echo. `input` must be a terminal: a pipe, a file or a closed
 * stdin is refused, so nothing but a person at the keyboard can answer. Ctrl-C or Ctrl-D cancels.
 */
export function readPassphrase(prompt, { input = process.stdin, output = process.stderr } = {}) {
  if (!input?.isTTY || typeof input.setRawMode !== "function")
    return Promise.reject(
      new KeyError(
        "the key opens only with its passphrase typed at a terminal, and this process has none: run it in a terminal of your own",
      ),
    );
  output.write(prompt);
  return new Promise((resolve, reject) => {
    let chars = [];
    const finish = (err, rest) => {
      input.removeListener("data", onData);
      input.setRawMode(false);
      input.pause();
      if (rest) input.unshift(Buffer.from(rest, "utf8"));
      output.write("\n");
      if (err) reject(err);
      else resolve(chars.join(""));
      chars = [];
    };
    const onData = (chunk) => {
      const all = [...chunk.toString("utf8")];
      for (let i = 0; i < all.length; i++) {
        const ch = all[i];
        if (ch === "\r" || ch === "\n") return finish(null, all.slice(i + 1).join(""));
        if (ch === "\u0003" || ch === "\u0004") return finish(new KeyError("cancelled at the passphrase prompt"));
        if (ch === "\u007f" || ch === "\b") chars.pop();
        else if (ch >= " ") chars.push(ch);
      }
    };
    input.setRawMode(true);
    input.on("data", onData);
    input.resume();
  });
}

/**
 * Open a key file inside the signing process: ask for its passphrase (`ask`, by default the terminal), then return
 * { pub, key } with `key` a non-extractable signing key. `expectedPub`, when given, must be the file's public key.
 */
export async function loadKey(file, { label = "key", ask = readPassphrase, expectedPub } = {}) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    throw new KeyError(`${file} can't be read`);
  }
  const r = readKeyText(text);
  if (r.error) throw new KeyError(`${file} ${r.error}`);
  if (r.form === "plain")
    throw new KeyError(`${file} holds its private key unencrypted; encrypt it first: ${convertCommand(file)}`);
  if (expectedPub && r.pub !== expectedPub) throw new KeyError(`${file} holds ${r.pub}, not ${expectedPub}`);
  const passphrase = await ask(`passphrase for the ${label} ${r.pub}: `);
  return decryptKey(text, passphrase, file);
}
