#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Check that this computer can build, test and release the registry, one pass/warn/fail line per check:
//
//   node scripts/doctor.mjs [--release] [--no-install]
//
// Node 22 or newer; pnpm through corepack at the packageManager version; gh signed in; origin pointing at the
// project repository; dev and main on origin; the libraries in vendor/ at the lib.lock commit; the lockfile installing
// (pnpm install --frozen-lockfile --ignore-scripts, which only touches node_modules); and the signing key files:
// present, mode 600, parseable, the authority key the one authority.pub pins and the author key the one the registry
// lists for OE8APR. Only public keys and their fingerprints are printed.
//
// Missing key files are a warning (a contributor has none); --release makes them a failure. Exits 1 on any failure.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  PNPM,
  UPSTREAM,
  authorKeysOf,
  corepackEnv,
  defaultRunner,
  fingerprint,
  inspectKey,
  keyFiles,
  repoRoot,
  repoSlug,
} from "./release-kit.mjs";

export function doctor({ root = repoRoot, run = defaultRunner, env = process.env, log = console.log, release = false, install = true, nodeVersion = process.versions.node } = {}) {
  let failures = 0;
  let warnings = 0;
  const pass = (m) => log(`pass  ${m}`);
  const warn = (m) => {
    warnings++;
    log(`warn  ${m}`);
  };
  const fail = (m) => {
    failures++;
    log(`FAIL  ${m}`);
  };
  const exec = (cmd, args, opts = {}) => run(cmd, args, { cwd: root, ...opts });
  const read = (rel) => {
    try {
      return fs.readFileSync(path.join(root, rel), "utf8");
    } catch {
      return null;
    }
  };

  // Node
  const major = Number(nodeVersion.split(".")[0]);
  if (major >= 22) pass(`Node ${nodeVersion}`);
  else fail(`Node ${nodeVersion}: this repository needs Node 22 or newer`);

  // pnpm through corepack
  const want = /^pnpm@([^+]+)/.exec(JSON.parse(read("package.json") ?? "{}").packageManager ?? "")?.[1];
  const cp = exec("corepack", ["--version"]);
  if (cp.status !== 0) fail("corepack is missing: it ships with Node; install a Node that has it");
  else {
    const p = exec(PNPM[0], [...PNPM[1], "--version"], { env: corepackEnv(env) });
    const have = p.stdout.trim();
    if (p.status !== 0) fail("corepack can't run pnpm: run corepack enable");
    else if (want && have !== want) warn(`pnpm ${have} through corepack; package.json pins ${want}`);
    else pass(`pnpm ${have} through corepack`);
  }

  // gh
  const gh = exec("gh", ["auth", "status"]);
  if (gh.status === 127) fail("gh is not installed: https://cli.github.com");
  else if (gh.status !== 0) fail("gh is not signed in: run gh auth login");
  else pass("gh is signed in");

  // the remote and its branches
  const url = exec("git", ["remote", "get-url", "origin"]).stdout.trim();
  const slug = repoSlug(url);
  if (!url) fail("no origin remote");
  else if (slug === UPSTREAM) pass(`origin is ${UPSTREAM}`);
  else warn(`origin is ${url}, a fork or another repository; releases go to ${UPSTREAM}`);
  for (const b of ["dev", "main"]) {
    const r = exec("git", ["rev-parse", "--verify", "--quiet", `refs/remotes/origin/${b}`]);
    if (r.status === 0) pass(`origin/${b} exists`);
    else fail(`origin/${b} is missing: run git fetch origin`);
  }

  // vendor/
  const lock = JSON.parse(read("lib.lock") ?? "{}");
  const have = (read("vendor/aprscaching/.lib-ref") ?? "").trim();
  if (!have) warn("vendor/ is empty: run node scripts/fetch-libs.mjs (--source <aprscaching clone> works offline)");
  else if (have !== lock.ref)
    warn(`vendor/ holds ${have.slice(0, 12)}, lib.lock pins ${String(lock.ref).slice(0, 12)}: run node scripts/fetch-libs.mjs`);
  else pass(`vendor/ holds the libraries at ${have.slice(0, 12)}`);

  // the lockfile
  if (install) {
    const i = exec(PNPM[0], [...PNPM[1], "install", "--frozen-lockfile", "--ignore-scripts"], { env: corepackEnv(env) });
    if (i.status === 0) pass("pnpm install --frozen-lockfile --ignore-scripts");
    else fail(`the lockfile does not install: ${(i.stderr || i.stdout).trim().split("\n").slice(-2).join(" / ")}`);
  }

  // the key files
  const files = keyFiles(env);
  const pinned = (read("authority.pub") ?? "").trim();
  const expected = authorKeysOf(JSON.parse(read("registry.json") ?? "{}"));
  for (const [label, file, match] of [
    ["author key", files.author, (pub) => !expected.length || expected.includes(pub)],
    ["authority key", files.authority, (pub) => pub === pinned],
  ]) {
    const k = inspectKey(file);
    if (k.state === "missing") (release ? fail : warn)(`${label}: ${k.detail} (needed only to sign a release)`);
    else if (k.state !== "ok" && k.state !== "mode") fail(`${label}: ${k.detail}`);
    else {
      if (k.state === "mode") fail(`${label}: ${k.detail}`);
      const fp = `${k.pub} (fingerprint ${fingerprint(k.pub)})`;
      if (!match(k.pub))
        fail(
          label === "authority key"
            ? `${label}: ${file} holds ${fp}, but authority.pub pins ${pinned}`
            : `${label}: ${file} holds ${fp}; the registry lists OE8APR's tools under ${expected.join(", ")}`,
        );
      else if (k.state === "ok") pass(`${label}: ${fp}`);
    }
  }

  log(`\n${failures} failure(s), ${warnings} warning(s)`);
  return failures ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const argv = process.argv.slice(2);
  process.exit(doctor({ release: argv.includes("--release"), install: !argv.includes("--no-install") }));
}
