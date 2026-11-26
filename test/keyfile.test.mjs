// SPDX-License-Identifier: MIT
// The key file at rest (scripts/keyfile.mjs, scripts/genkey.mjs, scripts/sign.mjs): a key file holds the private key
// only encrypted, opens only with the passphrase typed at a terminal, never from the environment or an argument, and
// a key file in the plain form converts in place, keeping its key.
import { spawnSync } from "node:child_process";
import { createPrivateKey, createPublicKey, verify } from "node:crypto";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { main as genkey } from "../scripts/genkey.mjs";
import { KeyError, loadKey, readKeyText, readPassphrase } from "../scripts/keyfile.mjs";
import { repoRoot } from "./harness.mjs";
import { PASS, answers, makeKey } from "./keys.mjs";

const dirs = [];
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});
const tmp = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "tools-keyfile-"));
  dirs.push(d);
  return d;
};
const node = (cwd, args, { env = {}, input } = {}) => {
  const base = { ...process.env };
  for (const k of Object.keys(base))
    if (/^(AUTHOR_KEY|AUTHORITY_KEY|TOOL_PRIVATE_KEY)$|PASSPHRASE/i.test(k)) delete base[k];
  return spawnSync(process.execPath, args, { cwd, env: { ...base, ...env }, encoding: "utf8", input });
};
const NO_TERMINAL =
  "the key opens only with its passphrase typed at a terminal, and this process has none: run it in a terminal of your own";

/** Whether `bytes` load as a bare PKCS#8 private key. */
const isPkcs8 = (bytes) => {
  try {
    createPrivateKey({ key: bytes, format: "der", type: "pkcs8" });
    return true;
  } catch {
    return false;
  }
};

/** Sign with an opened key and check the signature against `pub`, the way verify.mjs and the app do. */
async function signsFor({ key }, pub) {
  const msg = Buffer.from("aprscaching-tools");
  const sig = Buffer.from(await crypto.subtle.sign("Ed25519", key, msg));
  const pk = createPublicKey({ key: { kty: "OKP", crv: "Ed25519", x: pub }, format: "jwk" });
  return verify(null, msg, pk, sig);
}

/** A stand-in terminal: `isTTY`, raw mode recorded, and what the person types sent as data. */
function fakeTerminal() {
  const t = new EventEmitter();
  t.isTTY = true;
  t.raw = [];
  t.setRawMode = (on) => t.raw.push(on);
  t.resume = () => {};
  t.pause = () => {};
  t.unshift = (b) => t.pending.push(b);
  t.pending = [];
  t.type = (s) => t.emit("data", Buffer.from(s, "utf8"));
  return t;
}
const sink = () => ({
  text: "",
  write(s) {
    this.text += s;
  },
});

describe("genkey.mjs", () => {
  it("writes a new key only encrypted, mode 600, that opens with its passphrase alone", async () => {
    const file = path.join(tmp(), "a.key");
    const out = [];
    await genkey([file], {
      ask: answers("a passphrase long enough", "a passphrase long enough"),
      log: (l) => out.push(l),
    });
    const text = fs.readFileSync(file, "utf8");
    expect(fs.statSync(file).mode & 0o777).toBe(0o600);
    const r = readKeyText(text);
    expect(r.form).toBe("encrypted");
    expect(out.join("\n")).toContain(r.pub);
    // nothing in the file loads as a private key: not the file, not its base64 decoding, not the encrypted data
    expect(isPkcs8(Buffer.from(text))).toBe(false);
    expect(isPkcs8(Buffer.from(text, "base64"))).toBe(false);
    for (const v of Object.values(JSON.parse(text)).filter((x) => typeof x === "string"))
      expect(isPkcs8(Buffer.from(v, "base64")), v).toBe(false);
    expect(text).not.toMatch(/pkcs8/i);
    // opened with the passphrase, it signs for its public key
    const k = await loadKey(file, { ask: answers("a passphrase long enough") });
    expect(k.pub).toBe(r.pub);
    expect(k.key.extractable).toBe(false);
    expect(await signsFor(k, r.pub)).toBe(true);
    // with a wrong passphrase it does not open
    await expect(loadKey(file, { ask: answers("not the passphrase") })).rejects.toThrow(
      new KeyError(`${file} does not open: a wrong passphrase, or the file changed after it was written`),
    );
  });

  it("does not open without the passphrase typed at a terminal, and says so", async () => {
    const dir = tmp();
    const k = await makeKey();
    fs.writeFileSync(path.join(dir, "a.key"), k.file, { mode: 0o600 });
    fs.writeFileSync(path.join(dir, "registry.json"), JSON.stringify({ entries: [] }));
    // the passphrase on stdin, from a pipe: not a terminal, so refused
    const r = node(dir, [path.join(repoRoot, "scripts/sign.mjs"), "registry", "registry.json", "--key", "a.key"], {
      input: `${PASS}\n`,
    });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain(`sign: ${NO_TERMINAL}`);
    expect(fs.readFileSync(path.join(dir, "registry.json"), "utf8")).toBe(JSON.stringify({ entries: [] }));
    // and in-process, loadKey with the terminal reader on a stdin that is no terminal
    const pipe = Object.assign(new EventEmitter(), { isTTY: false });
    await expect(
      loadKey(path.join(dir, "a.key"), { ask: (p) => readPassphrase(p, { input: pipe, output: sink() }) }),
    ).rejects.toThrow(new KeyError(NO_TERMINAL));
  });

  it("refuses --raw, a file that exists, a short passphrase and two that differ, writing nothing", async () => {
    const dir = tmp();
    await expect(genkey(["--raw"])).rejects.toThrow(/writes a key only into a key file, encrypted/);
    const existing = path.join(dir, "taken.key");
    fs.writeFileSync(existing, "x");
    await expect(genkey([existing], { ask: answers() })).rejects.toThrow(/exists; a new key never replaces a key file/);
    expect(fs.readFileSync(existing, "utf8")).toBe("x");
    const file = path.join(dir, "b.key");
    await expect(genkey([file], { ask: answers("short") })).rejects.toThrow(/at least 12 characters/);
    await expect(genkey([file], { ask: answers("a passphrase long enough", "another one entirely") })).rejects.toThrow(
      /the two passphrases differ/,
    );
    expect(fs.readdirSync(dir)).toEqual(["taken.key"]);
  });

  it("converts a key file in the plain form in place, keeping its key, and refuses to convert it twice", async () => {
    const dir = tmp();
    const k = await makeKey();
    const file = path.join(dir, "old.key");
    fs.writeFileSync(file, k.plain, { mode: 0o600 });
    expect(readKeyText(fs.readFileSync(file, "utf8")).form).toBe("plain");
    const out = [];
    await genkey(["--convert", file], {
      ask: answers("the new passphrase here", "the new passphrase here"),
      log: (l) => out.push(l),
    });
    expect(out).toEqual([`encrypted ${file}; its public key stays ${k.pub}`]);
    const text = fs.readFileSync(file, "utf8");
    expect(fs.statSync(file).mode & 0o777).toBe(0o600);
    expect(readKeyText(text)).toMatchObject({ form: "encrypted", pub: k.pub });
    expect(text).not.toContain(k.secret);
    expect(text).not.toContain(k.plain);
    expect(fs.readdirSync(dir)).toEqual(["old.key"]);
    // the same key: it signs for the public key it had before
    const opened = await loadKey(file, { ask: answers("the new passphrase here") });
    expect(await signsFor(opened, k.pub)).toBe(true);
    await expect(genkey(["--convert", file], { ask: answers() })).rejects.toThrow(/is encrypted already/);
    const pub = [];
    await genkey(["--pub", file], { log: (l) => pub.push(l) });
    expect(pub).toEqual([k.pub]);
  });
});

describe("the passphrase", () => {
  it("is read from a terminal without echo, with backspace, and the rest kept for the next prompt", async () => {
    const t = fakeTerminal();
    const out = sink();
    const first = readPassphrase("first: ", { input: t, output: out });
    t.type("abx\u007fc\rsecond");
    expect(await first).toBe("abc");
    expect(t.raw).toEqual([true, false]);
    expect(out.text).toBe("first: \n");
    expect(t.pending.map(String)).toEqual(["second"]);
    const cancelled = readPassphrase("again: ", { input: t, output: out });
    t.type("xy\u0003");
    await expect(cancelled).rejects.toThrow(/cancelled at the passphrase prompt/);
    expect(t.raw.at(-1)).toBe(false);
  });

  it("is refused from the environment or an argument, by sign.mjs as by sign-all", async () => {
    const dir = tmp();
    const k = await makeKey();
    fs.writeFileSync(path.join(dir, "a.key"), k.file, { mode: 0o600 });
    fs.writeFileSync(path.join(dir, "registry.json"), JSON.stringify({ entries: [] }));
    const sign = path.join(repoRoot, "scripts/sign.mjs");
    const cases = [
      [
        { TOOL_KEY_PASSPHRASE: PASS },
        ["--key", "a.key"],
        /TOOL_KEY_PASSPHRASE is set: a key opens only from its key file/,
      ],
      [
        { TOOL_PRIVATE_KEY: k.plain },
        ["--key", "a.key"],
        /TOOL_PRIVATE_KEY is set: a key opens only from its key file/,
      ],
      [{}, ["--key", "a.key", "--passphrase", PASS], /--passphrase: sign.mjs takes the key file and nothing else/],
      [{}, ["--key", "a.key", PASS], new RegExp(`unexpected argument ${PASS}`)],
    ];
    for (const [env, extra, msg] of cases) {
      const r = node(dir, [sign, "registry", "registry.json", ...extra], { env });
      expect(r.status, `${JSON.stringify(env)} ${extra}`).toBe(2);
      expect(r.stderr).toMatch(msg);
    }
    expect(fs.readFileSync(path.join(dir, "registry.json"), "utf8")).toBe(JSON.stringify({ entries: [] }));
  });

  it("is refused for a key file in the plain form, which names the command that encrypts it", async () => {
    const dir = tmp();
    const k = await makeKey();
    const file = path.join(dir, "old.key");
    fs.writeFileSync(file, k.plain, { mode: 0o600 });
    const asked = answers();
    await expect(loadKey(file, { ask: asked })).rejects.toThrow(
      new KeyError(
        `${file} holds its private key unencrypted; encrypt it first: node scripts/genkey.mjs --convert ${file}`,
      ),
    );
    expect(asked.asked).toEqual([]);
  });
});
