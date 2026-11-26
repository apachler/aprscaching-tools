#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Fetch the MIT libraries the tools bundle (the APRS parser, the station-type registry, the panel model, the Morse
// and PSK31 decoders, the session-script parser) from the APRScaching repository at the commit lib.lock pins, into
// vendor/aprscaching, which git ignores. Only the paths lib.lock lists are fetched, and every file must carry an
// `SPDX-License-Identifier: MIT` line, so code under another licence never enters a tool.
//
// The repository and its branch are named here, not in lib.lock, and the pinned commit must be on that branch: a
// lib.lock change can then move only along APRScaching's reviewed history. GitHub serves any commit of a fork through
// the parent's URL, so a fetch by hash alone would accept a commit that exists only in a fork.
//
//   node scripts/fetch-libs.mjs                  # the branch's history without blobs, then the pinned paths
//   node scripts/fetch-libs.mjs --source <dir>   # from a local APRScaching clone whose origin/dev holds the commit
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

const REPOSITORY = "https://github.com/apachler/aprscaching.git";
const BRANCH = "dev";

const lock = JSON.parse(fs.readFileSync(path.join(root, "lib.lock"), "utf8"));
if ("repository" in lock) fail(`lib.lock: "repository" is not read; the libraries come from ${REPOSITORY} alone`);
const extra = Object.keys(lock).filter((k) => k !== "ref" && k !== "paths");
if (extra.length) fail(`lib.lock: holds only "ref" and "paths", not ${extra.map((k) => `"${k}"`).join(", ")}`);
if (typeof lock.ref !== "string" || !/^[0-9a-f]{40}$/.test(lock.ref))
  fail("lib.lock: ref must be a full commit hash, so the libraries can't move under a tool");
if (
  !Array.isArray(lock.paths) ||
  !lock.paths.length ||
  !lock.paths.every((p) => /^[\w./-]+$/.test(p) && !p.includes(".."))
)
  fail("lib.lock: paths must list repository-relative paths");

const i = process.argv.indexOf("--source");
const source = i > 0 ? process.argv[i + 1] : process.env.APRSCACHING_SOURCE;

fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });
const run = (cwd, ...args) => execFileSync("git", ["-C", cwd, ...args], { stdio: ["ignore", "pipe", "inherit"] });
/** True when the pinned commit is in the clone and an ancestor of (or equal to) its origin/<BRANCH>. */
const onBranch = (cwd) => {
  try {
    execFileSync("git", ["-C", cwd, "merge-base", "--is-ancestor", lock.ref, `refs/remotes/origin/${BRANCH}`], {
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
};
// The same repository in the forms a clone's origin takes: https with or without .git, or ssh.
const sameRepository = (url) =>
  url.replace(/\.git$/, "").replace(/^git@github\.com:/, "https://github.com/") === REPOSITORY.replace(/\.git$/, "");
const notOnBranch = `${lock.ref} is not a commit on ${BRANCH} of ${REPOSITORY}`;

try {
  if (source) {
    const dir = path.resolve(source);
    const origin = run(dir, "config", "--get", "remote.origin.url").toString().trim();
    if (!sameRepository(origin)) fail(`--source: the clone's origin is ${origin}, not ${REPOSITORY}`);
    if (!onBranch(dir)) fail(`${notOnBranch} (in the clone's origin/${BRANCH}; git -C ${source} fetch origin)`);
    const tar = run(dir, "archive", "--format=tar", lock.ref, "--", ...lock.paths);
    execFileSync("tar", ["-x", "-C", dest], { input: tar });
  } else {
    run(dest, "init", "-q");
    run(dest, "remote", "add", "origin", REPOSITORY);
    run(dest, "sparse-checkout", "set", "--no-cone", ...lock.paths.map((p) => `/${p}`));
    // Every commit of the branch and no blob: the history the ancestry check needs, the files only for the pin.
    run(dest, "fetch", "-q", "--filter=blob:none", "origin", `+refs/heads/${BRANCH}:refs/remotes/origin/${BRANCH}`);
    if (!onBranch(dest)) fail(notOnBranch);
    run(dest, "checkout", "-q", "--detach", lock.ref);
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
console.log(
  `fetch-libs: ${files.length} MIT files from ${source || REPOSITORY} at ${lock.ref.slice(0, 12)} in vendor/aprscaching`,
);
