// SPDX-License-Identifier: MIT
// scripts/sign.mjs and scripts/verify.mjs end to end, with throwaway keys in a temporary copy of one tool: the
// registry format and every manifest's tool API version are checked, and both are covered by the signatures.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { KeyError, decryptKey } from "../scripts/keyfile.mjs";
import { SignError, signManifest, signRegistry } from "../scripts/sign.mjs";
import { repoRoot } from "./harness.mjs";
import { PASS, makeKey } from "./keys.mjs";

const node = (cwd, args, env = {}) =>
  spawnSync(process.execPath, args, { cwd, env: { ...process.env, ...env }, encoding: "utf8" });
/** A throwaway key, opened: { pub, key } as sign-all and sign.mjs hold it. */
const openKey = async () => decryptKey((await makeKey()).file, PASS);

/** A one-tool repository signed with fresh keys; `edit(dir)` changes it before verification. */
async function signedCopy(edit = () => {}, { resignManifest = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tools-verify-"));
  fs.mkdirSync(path.join(dir, "scripts"));
  for (const f of ["verify.mjs"]) fs.copyFileSync(path.join(repoRoot, "scripts", f), path.join(dir, "scripts", f));
  fs.cpSync(path.join(repoRoot, "tools/unit-convert"), path.join(dir, "tools/unit-convert"), { recursive: true });
  const author = await openKey();
  const authority = await openKey();
  fs.writeFileSync(path.join(dir, "authority.pub"), authority.pub + "\n");
  const m = JSON.parse(fs.readFileSync(path.join(dir, "tools/unit-convert/tool.json"), "utf8"));
  const entry = {
    name: m.name,
    title: m.title,
    author: m.author,
    version: m.version,
    pubkey: author.pub,
    entry: "tools/unit-convert/tool.json",
  };
  fs.writeFileSync(path.join(dir, "registry.json"), JSON.stringify({ entries: [entry] }));
  edit(dir, "before");
  if (resignManifest) await signManifest(path.join(dir, "tools/unit-convert/tool.json"), author);
  await signRegistry(path.join(dir, "registry.json"), authority);
  edit(dir, "after");
  return { dir, verify: () => node(dir, ["scripts/verify.mjs", "--strict"]) };
}

describe("sign.mjs and verify.mjs", () => {
  it("sign registry format 1 and the manifest's api, and verify them", async () => {
    const { dir, verify } = await signedCopy();
    expect(JSON.parse(fs.readFileSync(path.join(dir, "registry.json"), "utf8")).format).toBe(1);
    const r = verify();
    expect(r.stdout).toContain("0 failure(s)");
    expect(r.status).toBe(0);
  });

  it("fail a registry whose format was changed after signing", async () => {
    const { verify } = await signedCopy((dir, when) => {
      if (when !== "after") return;
      const p = path.join(dir, "registry.json");
      fs.writeFileSync(p, JSON.stringify({ ...JSON.parse(fs.readFileSync(p, "utf8")), format: 2 }));
    });
    const r = verify();
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/registry format 2/);
    expect(r.stdout).toMatch(/registry signature does not verify/);
  });

  it("fail a manifest without a well-formed api, signed or not", async () => {
    const { verify } = await signedCopy((dir, when) => {
      if (when !== "before") return;
      const p = path.join(dir, "tools/unit-convert/tool.json");
      fs.writeFileSync(p, JSON.stringify({ ...JSON.parse(fs.readFileSync(p, "utf8")), api: "1" }));
    });
    const r = verify();
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/manifest needs "api": "MAJOR.MINOR"/);
  });

  it("fail a manifest whose api was changed after signing", async () => {
    const { verify } = await signedCopy((dir, when) => {
      if (when !== "after") return;
      const p = path.join(dir, "tools/unit-convert/tool.json");
      fs.writeFileSync(p, JSON.stringify({ ...JSON.parse(fs.readFileSync(p, "utf8")), api: "1.1" }));
    });
    const r = verify();
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/manifest signature does not verify/);
  });
  it("fail a manifest that holds no JSON object, instead of skipping it", async () => {
    const { dir, verify } = await signedCopy((d, when) => {
      if (when === "after") fs.writeFileSync(path.join(d, "tools/unit-convert/tool.json"), "null");
    });
    const r = verify();
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/tool\.json: not a JSON object/);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("fail an entry address with an encoded slash, which could leave the repository", async () => {
    const { dir, verify } = await signedCopy((d, when) => {
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
  it("sign refuses a manifest whose entry leaves its folder", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tools-sign-"));
    fs.mkdirSync(path.join(dir, "t"));
    fs.writeFileSync(path.join(dir, "secret.js"), "x");
    fs.writeFileSync(path.join(dir, "t/tool.json"), JSON.stringify({ name: "t", entry: "../secret.js" }));
    await expect(signManifest(path.join(dir, "t/tool.json"), await openKey())).rejects.toThrow(
      new SignError("entry ../secret.js leaves the manifest's folder"),
    );
    fs.rmSync(dir, { recursive: true, force: true });
  });
  it("fail a manifest whose entry the app resolves elsewhere than the file that was hashed", async () => {
    for (const entry of ["/tool.js", "tool.js?v=2", "tool%2ejs"]) {
      const { dir, verify } = await signedCopy((d, when) => {
        if (when !== "after") return;
        const p = path.join(d, "tools/unit-convert/tool.json");
        fs.writeFileSync(p, JSON.stringify({ ...JSON.parse(fs.readFileSync(p, "utf8")), entry }));
      });
      const r = verify();
      expect(r.status, entry).toBe(1);
      expect(r.stdout, entry).toMatch(/resolves to .*, not to a file beside it/);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
  it("sign refuses an entry that is not a plain path beside the manifest", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tools-sign-"));
    fs.mkdirSync(path.join(dir, "t"));
    fs.writeFileSync(path.join(dir, "t/tool.js"), "x");
    fs.writeFileSync(path.join(dir, "t/tool.json"), JSON.stringify({ name: "t", entry: "/tool.js" }));
    await expect(signManifest(path.join(dir, "t/tool.json"), await openKey())).rejects.toThrow(
      /not a plain path beside the manifest/,
    );
    fs.rmSync(dir, { recursive: true, force: true });
  });
  it("a key file whose public key was swapped does not open, and signs nothing", async () => {
    const doc = JSON.parse((await makeKey()).file);
    const swapped = JSON.stringify({ ...doc, pub: (await makeKey()).pub });
    await expect(decryptKey(swapped, PASS, "k.key")).rejects.toThrow(
      new KeyError("k.key does not open: a wrong passphrase, or the file changed after it was written"),
    );
  });
});
