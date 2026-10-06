#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Sign a release in one step, on the offline computer that holds the keys:
//
//   AUTHOR_KEY=<author private value> AUTHORITY_KEY=<authority private value> node scripts/sign-all.mjs
//
//   1. checks that every committed tool.js matches a fresh build of its sources (scripts/build.mjs --check);
//   2. signs each listed tool.json in this repository with AUTHOR_KEY (scripts/sign.mjs manifest), which also pins
//      the script's SHA-256 (entrySha256). A manifest signed by another author's key is left as it is;
//   3. copies each local manifest's pubkey, title, author and version into its registry entry;
//   4. signs the registry with AUTHORITY_KEY (scripts/sign.mjs registry);
//   5. runs scripts/verify.mjs --strict.
//
// Both values come from genkey.mjs. They stay in the environment of this one command and are never written.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const step = (msg) => console.log(`\n== ${msg}`);

function pubOf(envName) {
  const v = process.env[envName];
  if (!v) {
    console.error(`sign-all: set ${envName} to the private value genkey.mjs printed`);
    process.exit(2);
  }
  try {
    const { pkcs8, pub } = JSON.parse(Buffer.from(v, "base64").toString());
    if (typeof pkcs8 !== "string" || typeof pub !== "string") throw new Error();
    return pub;
  } catch {
    console.error(`sign-all: ${envName} is not a private value from genkey.mjs`);
    process.exit(2);
  }
}
const authorPub = pubOf("AUTHOR_KEY");
const authorityPub = pubOf("AUTHORITY_KEY");
const pinned = fs.readFileSync(path.join(root, "authority.pub"), "utf8").trim();
if (authorityPub !== pinned) {
  console.error(`sign-all: AUTHORITY_KEY is for ${authorityPub}, but authority.pub pins ${pinned}`);
  process.exit(2);
}

/** Run a script of this repository; `key` is the private value it signs with, passed to it alone. */
function node(args, key) {
  const env = { ...process.env };
  delete env.AUTHOR_KEY;
  delete env.AUTHORITY_KEY;
  if (key) env.TOOL_PRIVATE_KEY = key;
  execFileSync(process.execPath, args, { cwd: root, env, stdio: "inherit" });
}

step("the built scripts match their sources");
node(["scripts/build.mjs", "--check"]);

const regPath = path.join(root, "registry.json");
const reg = JSON.parse(fs.readFileSync(regPath, "utf8"));
step(`signing the tools with the author key ${authorPub}`);
for (const e of reg.entries) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(e.entry)) {
    console.log(`skip  ${e.name}: hosted by its author at ${e.entry}`);
    continue;
  }
  const file = path.join(root, e.entry);
  const m = JSON.parse(fs.readFileSync(file, "utf8"));
  if (m.pubkey && m.pubkey !== authorPub) {
    console.log(`skip  ${e.name}: signed by its own author key ${m.pubkey}`);
  } else node(["scripts/sign.mjs", "manifest", e.entry], process.env.AUTHOR_KEY);
  const signed = JSON.parse(fs.readFileSync(file, "utf8"));
  Object.assign(e, { pubkey: signed.pubkey, title: signed.title, author: signed.author, version: signed.version });
}
fs.writeFileSync(regPath, JSON.stringify(reg, null, 2) + "\n");

step(`signing the registry with the authority key ${authorityPub}`);
node(["scripts/sign.mjs", "registry", "registry.json"], process.env.AUTHORITY_KEY);

step("verifying");
node(["scripts/verify.mjs", "--strict"]);
console.log("\nsign-all: done. Review `git diff`, then commit with a sign-off.");
