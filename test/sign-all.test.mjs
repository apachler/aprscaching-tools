// SPDX-License-Identifier: MIT
// scripts/sign-all.mjs with throwaway keys in a temporary copy of the repository: it checks every listed manifest
// before it signs any, so a manifest of another author that no longer verifies stops it with nothing written.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { repoRoot } from "./harness.mjs";

const genkey = () => execFileSync(process.execPath, [path.join(repoRoot, "scripts/genkey.mjs"), "--raw"]).toString();
const pubOf = (priv) => JSON.parse(Buffer.from(priv, "base64").toString()).pub;

function copyRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tools-sign-all-"));
  for (const f of fs.readdirSync(repoRoot)) {
    if (f === ".git" || f === "node_modules") continue;
    fs.cpSync(path.join(repoRoot, f), path.join(dir, f), { recursive: true });
  }
  fs.symlinkSync(path.join(repoRoot, "node_modules"), path.join(dir, "node_modules"));
  return dir;
}

describe("sign-all.mjs", () => {
  it("writes nothing when a manifest of another author no longer verifies", () => {
    const dir = copyRepo();
    const author = genkey();
    const authority = genkey();
    const other = genkey();
    fs.writeFileSync(path.join(dir, "authority.pub"), pubOf(authority) + "\n");
    // the last listed tool is another author's, signed, then changed
    const regPath = path.join(dir, "registry.json");
    const reg = JSON.parse(fs.readFileSync(regPath, "utf8"));
    const last = reg.entries.at(-1);
    const run = (args, env) =>
      spawnSync(process.execPath, args, { cwd: dir, env: { ...process.env, ...env }, encoding: "utf8" });
    // the copy's other tools are this test author's, signed as they are now, so that only the last one is at stake
    for (const e of reg.entries.slice(0, -1))
      expect(run(["scripts/sign.mjs", "manifest", e.entry], { TOOL_PRIVATE_KEY: author }).status).toBe(0);
    expect(run(["scripts/sign.mjs", "manifest", last.entry], { TOOL_PRIVATE_KEY: other }).status).toBe(0);
    const lastPath = path.join(dir, last.entry);
    fs.writeFileSync(lastPath, JSON.stringify({ ...JSON.parse(fs.readFileSync(lastPath, "utf8")), description: "Changed after signing" }));
    const before = new Map(reg.entries.map((e) => [e.entry, fs.readFileSync(path.join(dir, e.entry), "utf8")]));
    const r = run(["scripts/sign-all.mjs"], { AUTHOR_KEY: author, AUTHORITY_KEY: authority });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/signature does not verify.*Nothing was signed/);
    for (const [entry, text] of before) expect(fs.readFileSync(path.join(dir, entry), "utf8")).toBe(text);
    expect(fs.readFileSync(regPath, "utf8")).toBe(JSON.stringify(reg, null, 2) + "\n");
    fs.rmSync(dir, { recursive: true, force: true });
  }, 60_000);
});
