#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Fetch the MIT libraries the tools bundle (the APRS parser, the station-type registry, the panel model, the Morse
// and PSK31 decoders, the session-script parser) from the APRScaching repository at the commit lib.lock pins, into
// vendor/aprscaching, which git ignores. Only the paths lib.lock lists are fetched, and every file must carry an
// `SPDX-License-Identifier: MIT` line, so code under another licence never enters a tool.
//
//   node scripts/fetch-libs.mjs                  # from the repository lib.lock names: a shallow, sparse fetch
//   node scripts/fetch-libs.mjs --source <dir>   # from a local clone that holds the pinned commit
//
// Without --source it reads the clone APRSCACHING_SOURCE names, when that is set.
//
// Exits 1 on any failure and leaves no partial vendor/ behind.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dest = path.join(root, "vendor", "aprscaching");

function fail(msg) {
  fs.rmSync(dest, { recursive: true, force: true });
  console.error(`fetch-libs: ${msg}`);
  process.exit(1);
}

const lock = JSON.parse(fs.readFileSync(path.join(root, "lib.lock"), "utf8"));
if (typeof lock.repository !== "string" || !/^https:\/\//.test(lock.repository))
  fail("lib.lock: repository must be an https URL");
if (typeof lock.ref !== "string" || !/^[0-9a-f]{40}$/.test(lock.ref))
  fail("lib.lock: ref must be a full commit hash, so the libraries can't move under a tool");
if (!Array.isArray(lock.paths) || !lock.paths.length || !lock.paths.every((p) => /^[\w./-]+$/.test(p) && !p.includes("..")))
  fail("lib.lock: paths must list repository-relative paths");

const i = process.argv.indexOf("--source");
const source = i > 0 ? process.argv[i + 1] : process.env.APRSCACHING_SOURCE;

fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });
const run = (cwd, ...args) => execFileSync("git", ["-C", cwd, ...args], { stdio: ["ignore", "pipe", "inherit"] });

try {
  if (source) {
    const tar = run(path.resolve(source), "archive", "--format=tar", lock.ref, "--", ...lock.paths);
    execFileSync("tar", ["-x", "-C", dest], { input: tar });
  } else {
    run(dest, "init", "-q");
    run(dest, "remote", "add", "origin", lock.repository);
    run(dest, "sparse-checkout", "set", "--no-cone", ...lock.paths.map((p) => `/${p}`));
    run(dest, "fetch", "-q", "--depth", "1", "--filter=blob:none", "origin", lock.ref);
    run(dest, "checkout", "-q", "--detach", "FETCH_HEAD");
    const head = run(dest, "rev-parse", "HEAD").toString().trim();
    if (head !== lock.ref) fail(`fetched ${head}, not the pinned ${lock.ref}`);
    fs.rmSync(path.join(dest, ".git"), { recursive: true, force: true });
  }
} catch (e) {
  fail(`could not fetch ${lock.ref} (${e.message.split("\n")[0]})`);
}

// Every listed path arrived, and every file in it is MIT.
const files = [];
// lstat, so a symbolic link is seen as one and refused: it could point outside the pinned paths.
const walk = (p) => {
  const st = fs.lstatSync(p);
  if (st.isSymbolicLink()) fail(`${path.relative(dest, p)} is a symbolic link`);
  if (st.isDirectory()) for (const d of fs.readdirSync(p).sort()) walk(path.join(p, d));
  else if (st.isFile()) files.push(p);
  else fail(`${path.relative(dest, p)} is not a regular file`);
};
for (const p of lock.paths) {
  const abs = path.join(dest, p);
  if (!fs.existsSync(abs)) fail(`${p} is not in ${lock.ref}`);
  walk(abs);
}
for (const f of files) {
  const head = fs.readFileSync(f, "utf8").split("\n").slice(0, 5).join("\n");
  if (!/SPDX-License-Identifier: MIT\b/.test(head)) fail(`${path.relative(dest, f)} does not declare the MIT licence`);
}
fs.writeFileSync(path.join(dest, ".lib-ref"), `${lock.ref}\n`);
console.log(`fetch-libs: ${files.length} MIT files from ${source ?? lock.repository} at ${lock.ref.slice(0, 12)} in vendor/aprscaching`);
