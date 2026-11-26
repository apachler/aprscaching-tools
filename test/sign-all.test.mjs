// SPDX-License-Identifier: MIT
// scripts/sign-all.mjs with throwaway encrypted keys in a temporary copy of the repository: it runs the build check
// before it opens a key and nothing while one is open, it checks every listed manifest before it signs any, and it
// takes its keys from the key files and the passphrases typed for them, never from the environment or an argument.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { decryptKey } from "../scripts/keyfile.mjs";
import { signAll } from "../scripts/sign-all.mjs";
import { signManifest } from "../scripts/sign.mjs";
import { repoRoot } from "./harness.mjs";
import { PASS, answers, makeKey } from "./keys.mjs";

/** A copy of the repository, and a key folder beside it holding a throwaway author and authority key. */
async function copyRepo({ plainAuthor = false } = {}) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "tools-sign-all-"));
  const dir = path.join(base, "repo");
  fs.mkdirSync(dir);
  for (const f of fs.readdirSync(repoRoot)) {
    if (f === ".git" || f === "node_modules") continue;
    fs.cpSync(path.join(repoRoot, f), path.join(dir, f), { recursive: true });
  }
  fs.symlinkSync(path.join(repoRoot, "node_modules"), path.join(dir, "node_modules"));
  const keys = path.join(base, "keys");
  fs.mkdirSync(keys, { mode: 0o700 });
  const author = await makeKey();
  const authority = await makeKey();
  const authorFile = path.join(keys, "oe8apr-tool-author.key");
  fs.writeFileSync(authorFile, plainAuthor ? author.plain : author.file, { mode: 0o600 });
  fs.writeFileSync(path.join(keys, "registry-authority.key"), authority.file, { mode: 0o600 });
  fs.writeFileSync(path.join(dir, "authority.pub"), authority.pub + "\n");
  // the project's tools become the throwaway author's, so a tool changed on dev since its last signature is signed
  const reg = JSON.parse(fs.readFileSync(path.join(dir, "registry.json"), "utf8"));
  for (const e of reg.entries.filter((x) => x.author === "OE8APR" && !/^[a-z][a-z0-9+.-]*:/i.test(x.entry))) {
    const p = path.join(dir, e.entry);
    fs.writeFileSync(p, JSON.stringify({ ...JSON.parse(fs.readFileSync(p, "utf8")), pubkey: author.pub }, null, 2));
  }
  const env = { ...process.env, TOOL_KEYS_DIR: keys };
  for (const k of Object.keys(env))
    if (/^(AUTHOR_KEY|AUTHORITY_KEY|TOOL_PRIVATE_KEY)$|PASSPHRASE/i.test(k)) delete env[k];
  return { base, dir, keys, author, authority, authorFile, env };
}

/** signAll on a copy, its output collected; `events` records each child process and each passphrase prompt. */
async function runSignAll(c, o = {}) {
  const out = [];
  const events = [];
  const ask = answers(...(o.answers ?? []));
  const code = await signAll({
    root: c.dir,
    env: o.env ?? c.env,
    args: o.args ?? [],
    ask: async (p) => {
      events.push(`ask ${p}`);
      return ask(p);
    },
    run: (a) => {
      events.push(`run ${a.join(" ")}`);
      execFileSync(process.execPath, a, { cwd: c.dir, env: c.env, stdio: "pipe" });
    },
    log: (m) => out.push(m),
    error: (m) => out.push(m),
  });
  return { code, events, text: out.join("\n") };
}

describe("sign-all.mjs", () => {
  it("builds before it opens a key, runs nothing while one is open, and verifies after letting go", async () => {
    const c = await copyRepo();
    const r = await runSignAll(c);
    expect(r.code, r.text).toBe(0);
    expect(r.events).toEqual([
      "run scripts/build.mjs --check",
      `ask passphrase for the author key ${c.author.pub}: `,
      `ask passphrase for the authority key ${c.authority.pub}: `,
      "run scripts/verify.mjs --strict",
    ]);
    const reg = JSON.parse(fs.readFileSync(path.join(c.dir, "registry.json"), "utf8"));
    expect(reg.authority).toBe(c.authority.pub);
    expect(reg.entries.filter((e) => e.author === "OE8APR").every((e) => e.pubkey === c.author.pub)).toBe(true);
    for (const k of [c.author, c.authority]) expect(r.text).not.toContain(k.secret);
    fs.rmSync(c.base, { recursive: true, force: true });
  }, 120_000);

  it("opens no key and signs nothing when a passphrase is wrong", async () => {
    const c = await copyRepo();
    const before = fs.readFileSync(path.join(c.dir, "registry.json"), "utf8");
    const r = await runSignAll(c, { answers: ["not the passphrase"] });
    expect(r.code).toBe(2);
    expect(r.text).toContain(
      `sign-all: ${c.authorFile} does not open: a wrong passphrase, or the file changed after it was written`,
    );
    expect(r.events.filter((e) => e.startsWith("run "))).toEqual(["run scripts/build.mjs --check"]);
    expect(fs.readFileSync(path.join(c.dir, "registry.json"), "utf8")).toBe(before);
    fs.rmSync(c.base, { recursive: true, force: true });
  }, 120_000);

  it("refuses a key file in the plain form before it runs anything, naming the command that encrypts it", async () => {
    const c = await copyRepo({ plainAuthor: true });
    const r = await runSignAll(c);
    expect(r.code).toBe(2);
    expect(r.text).toContain(
      `sign-all: the author key: ${c.authorFile} holds its private key unencrypted; encrypt it, keeping the key: node scripts/genkey.mjs --convert ${c.authorFile}`,
    );
    expect(r.events).toEqual([]);
    expect(r.text).not.toContain(c.author.secret);
    fs.rmSync(c.base, { recursive: true, force: true });
  });

  it("refuses a key or a passphrase given in the environment or as an argument", async () => {
    const c = await copyRepo();
    const cases = [
      [{ ...c.env, AUTHOR_KEY: c.author.plain }, [], /AUTHOR_KEY is set: a key opens only from its key file/],
      [{ ...c.env, TOOL_KEY_PASSPHRASE: PASS }, [], /TOOL_KEY_PASSPHRASE is set: a key opens only from its key file/],
      [c.env, ["--passphrase", PASS], /sign-all takes no arguments \(--passphrase\)/],
    ];
    for (const [env, args, msg] of cases) {
      // the command line, as the maintainer or a script would give it
      const r = spawnSync(process.execPath, ["scripts/sign-all.mjs", ...args], { cwd: c.dir, env, encoding: "utf8" });
      expect(r.status, r.stderr).toBe(2);
      expect(r.stderr).toMatch(msg);
      const inProcess = await runSignAll(c, { env, args });
      expect(inProcess.code).toBe(2);
      expect(inProcess.events).toEqual([]);
    }
    fs.rmSync(c.base, { recursive: true, force: true });
  });

  it("writes nothing when a manifest of another author no longer verifies", async () => {
    const c = await copyRepo();
    const author = await decryptKey(c.author.file, PASS);
    const other = await decryptKey((await makeKey()).file, PASS);
    // the last listed tool is another author's, signed, then changed
    const regPath = path.join(c.dir, "registry.json");
    const reg = JSON.parse(fs.readFileSync(regPath, "utf8"));
    const last = reg.entries.at(-1);
    // the copy's other tools are this test author's, signed as they are now, so that only the last one is at stake
    for (const e of reg.entries.slice(0, -1)) await signManifest(path.join(c.dir, e.entry), author);
    await signManifest(path.join(c.dir, last.entry), other);
    const lastPath = path.join(c.dir, last.entry);
    fs.writeFileSync(
      lastPath,
      JSON.stringify({ ...JSON.parse(fs.readFileSync(lastPath, "utf8")), description: "Changed after signing" }),
    );
    const before = new Map(reg.entries.map((e) => [e.entry, fs.readFileSync(path.join(c.dir, e.entry), "utf8")]));
    const r = await runSignAll(c);
    expect(r.code).toBe(1);
    expect(r.text).toMatch(/signature does not verify.*Nothing was signed/);
    expect(r.events.filter((e) => e.startsWith("ask "))).toEqual([]);
    for (const [entry, text] of before) expect(fs.readFileSync(path.join(c.dir, entry), "utf8")).toBe(text);
    expect(fs.readFileSync(regPath, "utf8")).toBe(JSON.stringify(reg, null, 2) + "\n");
    fs.rmSync(c.base, { recursive: true, force: true });
  }, 120_000);

  it("writes nothing when a registry entry leaves the repository", async () => {
    const c = await copyRepo();
    const outside = path.join(c.base, "outside");
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, "tool.js"), "x");
    const manifest = JSON.stringify({ name: "outside", entry: "tool.js" });
    fs.writeFileSync(path.join(outside, "tool.json"), manifest);
    const regPath = path.join(c.dir, "registry.json");
    const reg = JSON.parse(fs.readFileSync(regPath, "utf8"));
    // first, so it is the entry the checks reach before any other could stop them
    reg.entries.unshift({ ...reg.entries[0], name: "outside", entry: "../outside/tool.json" });
    fs.writeFileSync(regPath, JSON.stringify(reg, null, 2) + "\n");
    const r = await runSignAll(c);
    expect(r.code).toBe(1);
    expect(r.text).toMatch(/leaves the repository; nothing was signed/);
    expect(r.events.filter((e) => e.startsWith("ask "))).toEqual([]);
    expect(fs.readFileSync(path.join(outside, "tool.json"), "utf8")).toBe(manifest);
    fs.rmSync(c.base, { recursive: true, force: true });
  }, 120_000);
});
