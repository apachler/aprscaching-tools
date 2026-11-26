#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Make an Ed25519 tool-author (or registry-authority) signing key, the key that signs a tool.json manifest or a
// signed tool registry, and keep it in a key file encrypted with a passphrase (scripts/keyfile.mjs):
//
//   node scripts/genkey.mjs <key file>             # a new key; asks for its passphrase twice, at the terminal
//   node scripts/genkey.mjs --convert <key file>   # encrypt a key file that holds its key unencrypted, in place
//   node scripts/genkey.mjs --pub <key file>       # print the public key, for the manifest `pubkey` or authority.pub
//
// The private key exists only inside the key file, encrypted; it is never printed. `--convert` keeps the key, so
// its public key, and every signature and pin made with it, stay as they are. The passphrase is typed at the
// terminal only; a key file is written with mode 600 and never over another file.
import { createPrivateKey } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { KeyError, MIN_PASSPHRASE, encryptKey, readKeyText, readPassphrase } from "./keyfile.mjs";

const USAGE = "usage: node scripts/genkey.mjs [--convert | --pub] <key file>";

async function newPassphrase(ask) {
  const a = await ask(`new passphrase (at least ${MIN_PASSPHRASE} characters): `);
  if ([...a].length < MIN_PASSPHRASE) throw new KeyError(`the passphrase needs at least ${MIN_PASSPHRASE} characters`);
  const b = await ask("the same passphrase again: ");
  if (a !== b) throw new KeyError("the two passphrases differ; nothing was written");
  return a;
}

/** Write `text` to `file` with mode 600, through a new file beside it, so a failure leaves the old file whole. */
function writeKeyFile(file, text, { replace }) {
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);
  const fd = fs.openSync(tmp, "wx", 0o600);
  try {
    fs.writeSync(fd, text);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  try {
    if (replace) fs.renameSync(tmp, file);
    else {
      fs.linkSync(tmp, file); // fails when the file exists: a new key never replaces one
      fs.unlinkSync(tmp);
    }
  } catch (e) {
    fs.rmSync(tmp, { force: true });
    throw e;
  }
}

/** The command line; `ask` reads a passphrase (by default at the terminal), `log` prints a line. */
export async function main(argv, { ask = readPassphrase, log = (m) => console.log(m) } = {}) {
  const mode = argv[0] === "--convert" || argv[0] === "--pub" ? argv[0].slice(2) : "new";
  const rest = mode === "new" ? argv : argv.slice(1);
  if (rest.length !== 1 || rest[0].startsWith("-")) {
    if (argv.includes("--raw"))
      throw new KeyError(`genkey.mjs writes a key only into a key file, encrypted: node scripts/genkey.mjs <key file>`);
    throw new KeyError(USAGE);
  }
  const file = rest[0];

  if (mode === "pub") {
    const r = readKeyText(fs.readFileSync(file, "utf8"));
    if (r.error) throw new KeyError(`${file} ${r.error}`);
    log(r.pub);
    return;
  }

  if (mode === "convert") {
    let text;
    try {
      text = fs.readFileSync(file, "utf8");
    } catch {
      throw new KeyError(`${file} can't be read`);
    }
    const r = readKeyText(text);
    if (r.error) throw new KeyError(`${file} ${r.error}`);
    if (r.form === "encrypted") throw new KeyError(`${file} is encrypted already (public key ${r.pub})`);
    const der = Buffer.from(r.pkcs8, "base64");
    const out = await encryptKey(der, await newPassphrase(ask));
    der.fill(0);
    writeKeyFile(file, out, { replace: true });
    log(`encrypted ${file}; its public key stays ${r.pub}`);
    return;
  }

  if (fs.existsSync(file)) throw new KeyError(`${file} exists; a new key never replaces a key file`);
  const kp = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const der = Buffer.from(await crypto.subtle.exportKey("pkcs8", kp.privateKey));
  createPrivateKey({ key: der, format: "der", type: "pkcs8" }); // a key that does not load is never written
  const out = await encryptKey(der, await newPassphrase(ask));
  der.fill(0);
  writeKeyFile(file, out, { replace: false });
  const pub = Buffer.from(await crypto.subtle.exportKey("raw", kp.publicKey)).toString("base64url");
  log(`wrote ${file}, encrypted. Its public key (Ed25519, base64url), for the manifest \`pubkey\` or`);
  log(`authority.pub:\n${pub}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    await main(process.argv.slice(2));
  } catch (e) {
    console.error(`genkey: ${e instanceof KeyError ? e.message : (e?.message ?? e)}`);
    process.exit(2);
  }
}
