// SPDX-License-Identifier: MIT
// scripts/sign.mjs and scripts/verify.mjs end to end, with throwaway keys in a temporary copy of one tool: the
// registry format and every manifest's tool API version are checked, and both are covered by the signatures.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { repoRoot } from "./harness.mjs";

const node = (cwd, args, env = {}) =>
  spawnSync(process.execPath, args, { cwd, env: { ...process.env, ...env }, encoding: "utf8" });
const genkey = () => execFileSync(process.execPath, [path.join(repoRoot, "scripts/genkey.mjs"), "--raw"]).toString();
const pubOf = (priv) => JSON.parse(Buffer.from(priv, "base64").toString()).pub;

/** A one-tool repository signed with fresh keys; `edit(dir)` changes it before verification. */
function signedCopy(edit = () => {}, { resignManifest = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tools-verify-"));
  fs.mkdirSync(path.join(dir, "scripts"));
  for (const f of ["sign.mjs", "verify.mjs"])
    fs.copyFileSync(path.join(repoRoot, "scripts", f), path.join(dir, "scripts", f));
  fs.cpSync(path.join(repoRoot, "tools/unit-convert"), path.join(dir, "tools/unit-convert"), { recursive: true });
  const author = genkey();
  const authority = genkey();
  fs.writeFileSync(path.join(dir, "authority.pub"), pubOf(authority) + "\n");
  const m = JSON.parse(fs.readFileSync(path.join(dir, "tools/unit-convert/tool.json"), "utf8"));
  const entry = {
    name: m.name,
    title: m.title,
    author: m.author,
    version: m.version,
    pubkey: pubOf(author),
    entry: "tools/unit-convert/tool.json",
  };
  fs.writeFileSync(path.join(dir, "registry.json"), JSON.stringify({ entries: [entry] }));
  const sign = (kind, file, key) => {
    const r = node(dir, ["scripts/sign.mjs", kind, file], { TOOL_PRIVATE_KEY: key });
    expect(r.status, r.stderr).toBe(0);
  };
  edit(dir, "before");
  if (resignManifest) sign("manifest", "tools/unit-convert/tool.json", author);
  sign("registry", "registry.json", authority);
  edit(dir, "after");
  return { dir, verify: () => node(dir, ["scripts/verify.mjs", "--strict"]) };
}

describe("sign.mjs and verify.mjs", () => {
  it("sign registry format 1 and the manifest's api, and verify them", () => {
    const { dir, verify } = signedCopy();
    expect(JSON.parse(fs.readFileSync(path.join(dir, "registry.json"), "utf8")).format).toBe(1);
    const r = verify();
    expect(r.stdout).toContain("0 failure(s)");
    expect(r.status).toBe(0);
  });

  it("fail a registry whose format was changed after signing", () => {
    const { verify } = signedCopy((dir, when) => {
      if (when !== "after") return;
      const p = path.join(dir, "registry.json");
      fs.writeFileSync(p, JSON.stringify({ ...JSON.parse(fs.readFileSync(p, "utf8")), format: 2 }));
    });
    const r = verify();
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/registry format 2/);
    expect(r.stdout).toMatch(/registry signature does not verify/);
  });

  it("fail a manifest without a well-formed api, signed or not", () => {
    const { verify } = signedCopy((dir, when) => {
      if (when !== "before") return;
      const p = path.join(dir, "tools/unit-convert/tool.json");
      fs.writeFileSync(p, JSON.stringify({ ...JSON.parse(fs.readFileSync(p, "utf8")), api: "1" }));
    });
    const r = verify();
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/manifest needs "api": "MAJOR.MINOR"/);
  });

  it("fail a manifest whose api was changed after signing", () => {
    const { verify } = signedCopy((dir, when) => {
      if (when !== "after") return;
      const p = path.join(dir, "tools/unit-convert/tool.json");
      fs.writeFileSync(p, JSON.stringify({ ...JSON.parse(fs.readFileSync(p, "utf8")), api: "1.1" }));
    });
    const r = verify();
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/manifest signature does not verify/);
  });
  it("fail a manifest that holds no JSON object, instead of skipping it", () => {
    const { dir, verify } = signedCopy((d, when) => {
      if (when === "after") fs.writeFileSync(path.join(d, "tools/unit-convert/tool.json"), "null");
    });
    const r = verify();
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/tool\.json: not a JSON object/);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("fail an entry address with an encoded slash, which could leave the repository", () => {
    const { dir, verify } = signedCopy((d, when) => {
      if (when !== "before") return;
      const regPath = path.join(d, "registry.json");
      const reg = JSON.parse(fs.readFileSync(regPath, "utf8"));
      reg.entries[0].entry = "tools/..%2F..%2Fsecret%2Ftool.json";
      fs.writeFileSync(regPath, JSON.stringify(reg));
    });
    const r = verify();
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/holds an encoded slash/);
    fs.rmSync(dir, { recursive: true, force: true });
  });
  it("sign refuses a manifest whose entry leaves its folder", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tools-sign-"));
    fs.mkdirSync(path.join(dir, "t"));
    fs.writeFileSync(path.join(dir, "secret.js"), "x");
    fs.writeFileSync(path.join(dir, "t/tool.json"), JSON.stringify({ name: "t", entry: "../secret.js" }));
    const r = node(dir, [path.join(repoRoot, "scripts/sign.mjs"), "manifest", "t/tool.json"], {
      TOOL_PRIVATE_KEY: genkey(),
    });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/leaves the manifest's folder/);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
