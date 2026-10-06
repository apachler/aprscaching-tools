// SPDX-License-Identifier: MIT
// scripts/release.mjs and scripts/doctor.mjs against a stand-in for git and gh: a temporary repository holds the
// files the scripts read, an injected runner answers every command from a described state and records it, and the
// keys are throwaway ones from genkey.mjs. No network, no real keys, nothing outside the temporary folder changes.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { doctor } from "../scripts/doctor.mjs";
import { createContext, datedChangelog, release, unreleasedBody } from "../scripts/release.mjs";
import { fingerprint, inspectKeyFolder, keyFiles, redact, workTreeOf } from "../scripts/release-kit.mjs";
import { repoRoot } from "./harness.mjs";

const genkey = () => execFileSync(process.execPath, [path.join(repoRoot, "scripts/genkey.mjs"), "--raw"]).toString();
const pubOf = (priv) => JSON.parse(Buffer.from(priv, "base64").toString()).pub;

const CHANGELOG = `# Changelog

## [Unreleased]

- A new tool.

## [1.1.0] - 2026-10-06

- Earlier.
`;
const DATED = (v) => CHANGELOG.replace("## [Unreleased]\n", `## [Unreleased]\n\n## [${v}] - 2026-10-07\n`);

const dirs = [];
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

/**
 * A temporary repository and key folder; `opts` changes what the files hold. The key folder sits beside the
 * repository, outside it, unless `keysInside`; `git: true` gives the repository a `.git` folder.
 */
function fixture(opts = {}) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "tools-release-"));
  dirs.push(base);
  const root = path.join(base, "repo");
  fs.mkdirSync(root);
  if (opts.git) fs.mkdirSync(path.join(root, ".git"));
  const author = genkey();
  const authority = genkey();
  const w = (rel, text) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  };
  w("CHANGELOG.md", opts.changelog ?? CHANGELOG);
  w("package.json", JSON.stringify({ name: "aprscaching-tools", version: "1.1.0" }, null, 2) + "\n");
  w("lib.lock", JSON.stringify({ ref: "a".repeat(40) }));
  w("vendor/aprscaching/.lib-ref", "a".repeat(40) + "\n");
  w("node_modules/.modules.yaml", "");
  w("authority.pub", (opts.authorityPub ?? pubOf(authority)) + "\n");
  const entry = { name: "foo", title: "Foo", author: "OE8APR", version: "1.0.0", pubkey: pubOf(author), entry: "tools/foo/tool.json" };
  w("registry.json", JSON.stringify({ format: 1, entries: [entry] }));
  w("tools/foo/tool.json", JSON.stringify({ name: "foo" }));
  for (const t of opts.unlisted ?? []) w(`tools/${t}/tool.json`, JSON.stringify({ name: t }));
  const keys = opts.keysInside ? path.join(root, ".keys") : path.join(base, "keys");
  fs.mkdirSync(keys);
  fs.chmodSync(keys, opts.dirMode ?? 0o700);
  if (!opts.noAuthorKey) fs.writeFileSync(path.join(keys, "oe8apr-tool-author.key"), author, { mode: opts.mode ?? 0o600 });
  fs.writeFileSync(path.join(keys, "registry-authority.key"), authority, { mode: 0o600 });
  return { base, root, keys, author, authority };
}

/**
 * The stand-in for git, gh and node. `s` describes the world: the branch, the tree, what origin/dev and origin/main
 * hold, the tags. Every call is recorded with the environment it got.
 */
function world(s = {}) {
  const st = {
    current: "dev",
    porcelain: "",
    refs: new Set(["refs/remotes/origin/dev", "refs/remotes/origin/main"]),
    devChangelog: CHANGELOG,
    mainChangelog: CHANGELOG.replace(/## \[Unreleased\]\n\n- A new tool.\n\n/, "## [Unreleased]\n\n"),
    tagged: false,
    tags: ["v1.0.0", "v1.1.0"],
    ghAuth: 0,
    verifyStrict: 1,
    url: "https://github.com/apachler/aprscaching-tools.git",
    echo: null,
    devMovedOn: false,
    prOpen: false,
    ...s,
  };
  const calls = [];
  const run = (cmd, args, opts = {}) => {
    const line = `${cmd === process.execPath ? "node" : cmd} ${args.join(" ")}`;
    calls.push({ line, env: opts.env ? { ...opts.env } : undefined });
    const ok = (stdout = "") => ({ status: 0, stdout, stderr: "" });
    const no = (stderr = "") => ({ status: 1, stdout: "", stderr });
    if (line.startsWith("git fetch")) return ok();
    if (line === "git rev-parse --abbrev-ref HEAD") return ok(`${st.current}\n`);
    if (line === "git status --porcelain") return ok(st.porcelain);
    if (line.startsWith("git rev-parse --verify --quiet ")) return st.refs.has(args.at(-1)) ? ok("1234\n") : no();
    if (line === "git show origin/dev:CHANGELOG.md") return ok(st.devChangelog);
    if (line === "git show origin/main:CHANGELOG.md") return ok(st.mainChangelog);
    if (line.startsWith("git ls-remote --tags")) return ok(st.tagged ? `abc\trefs/tags/${args.at(-1).split("/").pop()}\n` : "");
    if (line === "git tag --list v*") return ok(st.tags.join("\n"));
    if (line === "git remote get-url origin") return ok(`${st.url}\n`);
    if (line === "git diff --stat") return ok(" registry.json | 2 +-\n");
    if (line === "git rev-parse origin/main") return ok("feedface\n");
    if (line === "git merge-base --is-ancestor origin/dev origin/main") return st.devMovedOn ? no() : ok();
    if (line.startsWith("gh pr create")) st.prOpen = true;
    if (line.startsWith("gh pr list")) return ok(st.prOpen ? JSON.stringify([{ number: 7, url: "pr/7", headRefOid: "h7" }]) : "[]");
    if (line.startsWith("gh pr checks") && args.includes("--json")) return ok(JSON.stringify([{ name: "verify", bucket: "pass" }]));
    if (line.startsWith("gh pr view")) return ok(JSON.stringify({ headRefOid: "h7" }));
    if (line === "gh auth status") return st.ghAuth === 0 ? ok() : no("not logged in");
    if (line === "node scripts/verify.mjs --strict") return { status: st.verifyStrict, stdout: "", stderr: "" };
    if (line === "node scripts/sign-all.mjs")
      return { status: 0, stdout: `sign-all: done${st.echo ? ` ${opts.env?.[st.echo]}` : ""}\n`, stderr: "" };
    return ok();
  };
  return { st, calls, run };
}

function harness(fx, w, o = {}) {
  const out = [];
  const asked = [];
  const ctx = createContext({
    version: o.version ?? "1.2.0",
    root: fx.root,
    env: { HOME: fx.root, TOOL_KEYS_DIR: fx.keys, PATH: process.env.PATH },
    run: w.run,
    ask: async (q) => {
      asked.push(q);
      return o.answer ?? false;
    },
    log: (l) => out.push(l),
    sleep: async () => {},
    today: "2026-10-07",
    dryRun: o.dryRun,
    yes: o.yes,
    from: o.from,
    source: path.join(fx.root, "no-clone"),
  });
  return { ctx, out, asked, text: () => out.join("\n") };
}

/** The stand-in for git, gh and corepack that doctor.mjs asks: a ready computer. */
function doctorRun(cmd, args) {
  const ok = () => ({ status: 0, stdout: "", stderr: "" });
  const line = `${cmd} ${args.join(" ")}`;
  if (line === "git remote get-url origin") return { ...ok(), stdout: "git@github.com:apachler/aprscaching-tools.git\n" };
  if (line === "corepack pnpm --version") return { ...ok(), stdout: "11.9.0\n" };
  return ok();
}

const MUTATING = /^(git (commit|push|switch|tag -a|add|branch|merge)|gh pr (create|merge)|node scripts\/sign-all)/;

describe("release.mjs --dry-run", () => {
  it("reports every step from a clean dev and changes nothing", async () => {
    const fx = fixture();
    const w = world();
    const h = harness(fx, w, { dryRun: true });
    expect(await release(h.ctx)).toBe(0);
    const t = h.text();
    expect(t).toMatch(/dry run for v1\.2\.0/);
    for (const step of ["prepare", "sign", "changelog", "pr-main", "tag", "sync-dev", "handover"])
      expect(t).toMatch(new RegExp(`todo  ${step}`));
    expect(t).toContain(`author key ${pubOf(fx.author)} (${fingerprint(pubOf(fx.author))})`);
    expect(w.calls.filter((c) => MUTATING.test(c.line))).toEqual([]);
    expect(h.asked).toEqual([]);
    expect(fs.readFileSync(path.join(fx.root, "CHANGELOG.md"), "utf8")).toBe(CHANGELOG);
  });

  it("resumes after the release PR merged into main", async () => {
    const fx = fixture();
    const w = world({ mainChangelog: DATED("1.2.0") });
    const h = harness(fx, w, { dryRun: true });
    expect(await release(h.ctx)).toBe(0);
    const t = h.text();
    for (const step of ["prepare", "sign", "changelog", "pr-main"]) expect(t).toMatch(new RegExp(`done  ${step}`));
    expect(t).toMatch(/todo  tag/);
    expect(t).toMatch(/todo  sync-dev/);
  });

  it("finds a tagged release that dev does not hold yet", async () => {
    const fx = fixture({ changelog: DATED("1.2.0") });
    const w = world({ mainChangelog: DATED("1.2.0"), tagged: true, tags: ["v1.1.0", "v1.2.0"] });
    const h = harness(fx, w, { dryRun: true });
    expect(await release(h.ctx)).toBe(0);
    expect(h.text()).toMatch(/v1\.2\.0 is tagged on origin: dev still needs it \(sync-dev\)/);
    expect(h.text()).toMatch(/done  tag/);
    expect(h.text()).toMatch(/todo  sync-dev/);
  });

  it("finds a tagged release in dev done but for the handover", async () => {
    const fx = fixture({ changelog: DATED("1.2.0") });
    const w = world({ devChangelog: DATED("1.2.0"), mainChangelog: DATED("1.2.0"), tagged: true, tags: ["v1.1.0", "v1.2.0"] });
    const h = harness(fx, w, { dryRun: true });
    expect(await release(h.ctx)).toBe(0);
    expect(h.text()).toMatch(/v1\.2\.0 is tagged on origin: only the handover is left/);
    expect(h.text()).toMatch(/done  sync-dev/);
    expect(h.text()).toMatch(/todo  handover/);
  });

  it("on the release branch, finds prepare and sign done once verify --strict holds", async () => {
    const fx = fixture();
    const w = world({ current: "release/v1.2.0", porcelain: " M registry.json\n", verifyStrict: 0 });
    w.st.refs.add("refs/heads/release/v1.2.0");
    const h = harness(fx, w, { dryRun: true });
    expect(await release(h.ctx)).toBe(0);
    expect(h.text()).toMatch(/done  prepare/);
    expect(h.text()).toMatch(/done  sign/);
    expect(h.text()).toMatch(/todo  changelog/);
  });
});

describe("release.mjs check", () => {
  const check = async (fxOpts, worldOpts, o = {}) => {
    const fx = fixture(fxOpts);
    const w = world(worldOpts);
    const h = harness(fx, w, { dryRun: true, ...o });
    const code = await release(h.ctx);
    expect(w.calls.filter((c) => MUTATING.test(c.line))).toEqual([]);
    return { code, text: h.text() };
  };

  it("fails a dirty tree outside the release branch", async () => {
    const r = await check({}, { porcelain: " M README.md\n" });
    expect(r.code).toBe(1);
    expect(r.text).toMatch(/FAIL {2}the working tree has changes on dev/);
  });

  it("fails when gh is not signed in", async () => {
    const r = await check({}, { ghAuth: 1 });
    expect(r.code).toBe(1);
    expect(r.text).toMatch(/FAIL {2}gh is not signed in/);
  });

  it("refuses a version that is not X.Y.Z, before it asks git anything", async () => {
    const fx = fixture();
    const w = world();
    const h = harness(fx, w, { version: "1.2", dryRun: true });
    expect(await release(h.ctx)).toBe(1);
    expect(h.text()).toMatch(/1\.2 is not a version X\.Y\.Z/);
    expect(w.calls).toEqual([]);
  });

  it("fails a version that is not newer than the newest tag", async () => {
    const r = await check({}, {}, { version: "1.0.5" });
    expect(r.code).toBe(1);
    expect(r.text).toMatch(/1\.0\.5 is not newer than v1\.1\.0/);
  });

  it("fails an empty Unreleased section", async () => {
    const empty = CHANGELOG.replace("- A new tool.\n\n", "");
    const r = await check({}, { devChangelog: empty });
    expect(r.code).toBe(1);
    expect(r.text).toMatch(/Unreleased section is empty/);
  });

  it("fails a key file others can read, without printing its value", async () => {
    const fx = fixture({ mode: 0o644 });
    const w = world();
    const h = harness(fx, w, { dryRun: true });
    expect(await release(h.ctx)).toBe(1);
    expect(h.text()).toMatch(/has mode 644; run chmod 600/);
    expect(h.text()).not.toContain(fx.author);
    expect(h.text()).not.toContain(JSON.parse(Buffer.from(fx.author, "base64").toString()).pkcs8);
  });

  it("fails a missing key file and an authority key authority.pub does not pin", async () => {
    const r = await check({ noAuthorKey: true, authorityPub: pubOf(genkey()) }, {});
    expect(r.code).toBe(1);
    expect(r.text).toMatch(/the author key: .*does not exist/);
    expect(r.text).toMatch(/but authority\.pub pins/);
  });

  it("fails a key folder inside a git working tree", async () => {
    const r = await check({ git: true, keysInside: true }, {});
    expect(r.code).toBe(1);
    expect(r.text).toMatch(/FAIL {2}the key folder .*\.keys lies inside a git working tree/);
  });

  it("warns about a key folder others can open", async () => {
    const fx = fixture({ dirMode: 0o755 });
    const h = harness(fx, world(), { dryRun: true });
    await release(h.ctx);
    expect(h.text()).toMatch(/warn {2}the key folder .* has mode 755; run chmod 700/);
    expect(h.text()).not.toMatch(/FAIL {2}the key folder/);
  });

  it("fails a tool folder the registry does not list", async () => {
    const r = await check({ unlisted: ["newcomer"] }, {});
    expect(r.code).toBe(1);
    expect(r.text).toMatch(/tools without a registry entry: newcomer/);
  });
});

describe("release.mjs steps", () => {
  it("needs --step for --yes", async () => {
    const fx = fixture();
    const h = harness(fx, world(), { yes: true });
    expect(await release(h.ctx)).toBe(1);
    expect(h.text()).toMatch(/--yes answers one step's questions/);
  });

  it("stops at the first no, with nothing changed", async () => {
    const fx = fixture();
    const w = world();
    const h = harness(fx, w);
    expect(await release(h.ctx)).toBe(0);
    expect(h.asked).toEqual(["Create release/v1.2.0 from origin/dev and switch to it?"]);
    expect(h.text()).toMatch(/rerun to continue from here/);
    expect(w.calls.filter((c) => MUTATING.test(c.line))).toEqual([]);
  });

  it("passes the keys to sign-all alone, in its environment, and never prints them", async () => {
    const fx = fixture();
    const w = world({ current: "release/v1.2.0", echo: "AUTHOR_KEY" });
    w.st.refs.add("refs/heads/release/v1.2.0");
    const before = { ...process.env };
    const h = harness(fx, w, { yes: true });
    expect(await release(h.ctx, { only: "sign" })).toBe(0);
    const signAll = w.calls.filter((c) => c.line === "node scripts/sign-all.mjs");
    expect(signAll).toHaveLength(1);
    expect(signAll[0].env.AUTHOR_KEY).toBe(fx.author);
    expect(signAll[0].env.AUTHORITY_KEY).toBe(fx.authority);
    for (const c of w.calls.filter((x) => x.line !== "node scripts/sign-all.mjs"))
      expect(JSON.stringify(c.env ?? {})).not.toMatch(new RegExp(`${fx.author.slice(0, 20)}|${fx.authority.slice(0, 20)}`));
    expect(h.text()).toContain("sign-all: done [redacted]");
    expect(h.text()).not.toContain(fx.author);
    expect(process.env).toEqual(before);
  });

  it("dates the changelog and sets the package version", async () => {
    const fx = fixture();
    const w = world({ current: "release/v1.2.0" });
    const h = harness(fx, w, { yes: true });
    expect(await release(h.ctx, { only: "changelog" })).toBe(0);
    expect(fs.readFileSync(path.join(fx.root, "CHANGELOG.md"), "utf8")).toBe(DATED("1.2.0"));
    expect(JSON.parse(fs.readFileSync(path.join(fx.root, "package.json"), "utf8")).version).toBe("1.2.0");
  });

  it("reports a step that is done and does nothing", async () => {
    const fx = fixture();
    const w = world({ mainChangelog: DATED("1.2.0") });
    const h = harness(fx, w, { yes: true });
    expect(await release(h.ctx, { only: "pr-main" })).toBe(0);
    expect(h.text()).toMatch(/pr-main: done already/);
    expect(w.calls.filter((c) => MUTATING.test(c.line))).toEqual([]);
  });

  it("opens the release PR into main and merges it as a merge commit", async () => {
    const fx = fixture({ changelog: DATED("1.2.0") });
    const w = world({ current: "release/v1.2.0", porcelain: " M CHANGELOG.md\n", verifyStrict: 0 });
    w.st.refs.add("refs/heads/release/v1.2.0");
    const h = harness(fx, w, { yes: true });
    expect(await release(h.ctx, { only: "pr-main" })).toBe(0);
    const lines = w.calls.map((c) => c.line);
    expect(lines).toContain("git commit -s -m chore(release): v1.2.0");
    expect(lines).toContainEqual(expect.stringMatching(/^gh pr create --base main --head release\/v1\.2\.0 /));
    expect(lines).toContainEqual(expect.stringMatching(/^gh pr merge 7 --merge --match-head-commit h7/));
    expect(lines.filter((l) => /--base dev|--squash/.test(l))).toEqual([]);
  });

  it("fast-forwards dev to main when dev has not moved on", async () => {
    const fx = fixture();
    const w = world({ mainChangelog: DATED("1.2.0"), tagged: true });
    const h = harness(fx, w, { yes: true });
    expect(await release(h.ctx, { only: "sync-dev" })).toBe(0);
    const lines = w.calls.map((c) => c.line);
    expect(lines).toContain("git push origin feedface:refs/heads/dev");
    expect(lines.filter((l) => l.startsWith("gh pr"))).toEqual([]);
  });

  it("brings main into dev through a merge-commit PR when dev has moved on", async () => {
    const fx = fixture();
    const w = world({ mainChangelog: DATED("1.2.0"), tagged: true, devMovedOn: true });
    const h = harness(fx, w, { yes: true });
    expect(await release(h.ctx, { only: "sync-dev" })).toBe(0);
    const lines = w.calls.map((c) => c.line);
    expect(lines).toContainEqual(expect.stringMatching(/^gh pr create --base dev --head main /));
    expect(lines).toContainEqual(expect.stringMatching(/^gh pr merge 7 --merge /));
    expect(lines.filter((l) => l.startsWith("git push"))).toEqual([]);
  });

  it("starts a hotfix from a tag, with its entry written on the release branch", async () => {
    const fx = fixture();
    const w = world({ devChangelog: CHANGELOG.replace("- A new tool.\n\n", ""), tags: ["v1.1.0", "v1.2.0"] });
    const h = harness(fx, w, { version: "1.2.1", from: "v1.2.0" });
    expect(await release(h.ctx)).toBe(0);
    expect(h.text()).toMatch(/info {2}release\/v1\.2\.1 starts from v1\.2\.0: write its Unreleased entry there/);
    expect(h.asked).toEqual(["Create release/v1.2.1 from v1.2.0 and switch to it?"]);
  });
});

describe("the key folder", () => {
  const tmp = () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "tools-keys-"));
    dirs.push(d);
    return d;
  };

  it("defaults to $XDG_CONFIG_HOME/aprscaching-tools/keys, else ~/.config/aprscaching-tools/keys", () => {
    const k = keyFiles({ HOME: "/home/op", XDG_CONFIG_HOME: "/srv/config" });
    expect(k.dir).toBe("/srv/config/aprscaching-tools/keys");
    expect(k.author).toBe("/srv/config/aprscaching-tools/keys/oe8apr-tool-author.key");
    expect(k.authority).toBe("/srv/config/aprscaching-tools/keys/registry-authority.key");
    expect(keyFiles({ HOME: "/home/op" }).dir).toBe("/home/op/.config/aprscaching-tools/keys");
    expect(keyFiles({ HOME: "/home/op", XDG_CONFIG_HOME: "relative" }).dir).toBe("/home/op/.config/aprscaching-tools/keys");
  });

  it("takes TOOL_KEYS_DIR and the per-file overrides", () => {
    const k = keyFiles({ HOME: "/home/op", XDG_CONFIG_HOME: "/srv/config", TOOL_KEYS_DIR: "/vault", TOOL_AUTHORITY_KEY_FILE: "/usb/a.key" });
    expect(k.author).toBe("/vault/oe8apr-tool-author.key");
    expect(k.authority).toBe("/usb/a.key");
  });

  it("finds the working tree above a folder, a file or a path not yet made", () => {
    const d = tmp();
    fs.mkdirSync(path.join(d, "repo", "sub"), { recursive: true });
    fs.mkdirSync(path.join(d, "repo", ".git"));
    fs.mkdirSync(path.join(d, "wt"));
    fs.writeFileSync(path.join(d, "wt", ".git"), "gitdir: elsewhere\n");
    const real = fs.realpathSync(d);
    expect(workTreeOf(path.join(d, "repo", "sub"))).toBe(path.join(real, "repo"));
    expect(workTreeOf(path.join(d, "repo", "sub", "not", "yet", "a.key"))).toBe(path.join(real, "repo"));
    expect(workTreeOf(path.join(d, "wt", "keys"))).toBe(path.join(real, "wt"));
    expect(workTreeOf(d)).toBe(null);
  });

  it("fails a per-file override inside a working tree, and passes a mode-700 folder outside one", () => {
    const d = tmp();
    fs.mkdirSync(path.join(d, "repo", ".git"), { recursive: true });
    fs.mkdirSync(path.join(d, "keys"), { mode: 0o700 });
    fs.chmodSync(path.join(d, "keys"), 0o700);
    const outside = keyFiles({ HOME: d, TOOL_KEYS_DIR: path.join(d, "keys") });
    expect(inspectKeyFolder(outside)).toEqual({ fails: [], warns: [] });
    const r = inspectKeyFolder({ ...outside, authority: path.join(d, "repo", "registry-authority.key") });
    expect(r.fails).toHaveLength(1);
    expect(r.fails[0]).toMatch(/repo lies inside a git working tree/);
  });

  it("is found by default under XDG_CONFIG_HOME, and doctor refuses it inside a working tree", () => {
    const fx = fixture();
    const config = path.join(fx.base, "config");
    fs.mkdirSync(path.join(config, "aprscaching-tools"), { recursive: true });
    fs.renameSync(fx.keys, path.join(config, "aprscaching-tools", "keys"));
    fs.writeFileSync(path.join(fx.root, "package.json"), JSON.stringify({ packageManager: "pnpm@11.9.0" }));
    const run = (env) => {
      const out = [];
      const code = doctor({ root: fx.root, run: doctorRun, env, log: (l) => out.push(l), nodeVersion: "24.0.0", install: false });
      return { code, t: out.join("\n") };
    };
    const ok = run({ HOME: path.join(fx.base, "nohome"), XDG_CONFIG_HOME: config });
    expect(ok.code, ok.t).toBe(0);
    expect(ok.t).toContain(`pass  author key: ${pubOf(fx.author)}`);
    expect(ok.t).toMatch(/pass {2}key folder .* is outside every git working tree/);
    fs.mkdirSync(path.join(config, ".git"));
    const inside = run({ HOME: path.join(fx.base, "nohome"), XDG_CONFIG_HOME: config });
    expect(inside.code).toBe(1);
    expect(inside.t).toMatch(/FAIL {2}the key folder .* lies inside a git working tree/);
    expect(inside.t).not.toContain(fx.author);
  });
});

describe("release.mjs helpers", () => {
  it("reads and dates the Unreleased section", () => {
    expect(unreleasedBody(CHANGELOG)).toBe("- A new tool.");
    expect(unreleasedBody("# Changelog\n\n## [Unreleased]\n")).toBe("");
    expect(datedChangelog(CHANGELOG, "1.2.0", "2026-10-07")).toBe(DATED("1.2.0"));
  });

  it("redacts a private value and its decoded parts", () => {
    const k = genkey();
    const { pkcs8 } = JSON.parse(Buffer.from(k, "base64").toString());
    expect(redact(`a ${k} b ${pkcs8} c`, [k])).toBe("a [redacted] b [redacted] c");
  });
});

describe("doctor.mjs", () => {

  it("passes a ready computer and prints only public keys", () => {
    const fx = fixture();
    fs.writeFileSync(path.join(fx.root, "package.json"), JSON.stringify({ packageManager: "pnpm@11.9.0" }));
    const out = [];
    const code = doctor({ root: fx.root, run: doctorRun, env: { TOOL_KEYS_DIR: fx.keys }, log: (l) => out.push(l), nodeVersion: "24.0.0" });
    const t = out.join("\n");
    expect(code, t).toBe(0);
    expect(t).toContain(`pass  author key: ${pubOf(fx.author)} (fingerprint ${fingerprint(pubOf(fx.author))})`);
    expect(t).toContain(`pass  authority key: ${pubOf(fx.authority)}`);
    expect(t).not.toContain(fx.author);
    expect(t).not.toContain(fx.authority);
  });

  it("fails an old Node, a key others can read and an author key the registry does not list", () => {
    const fx = fixture({ mode: 0o640 });
    const other = genkey();
    fs.writeFileSync(path.join(fx.keys, "registry-authority.key"), other, { mode: 0o600 });
    const out = [];
    const code = doctor({ root: fx.root, run: doctorRun, env: { TOOL_KEYS_DIR: fx.keys }, log: (l) => out.push(l), nodeVersion: "20.1.0" });
    const t = out.join("\n");
    expect(code).toBe(1);
    expect(t).toMatch(/FAIL {2}Node 20\.1\.0/);
    expect(t).toMatch(/FAIL {2}author key: .*mode 640/);
    expect(t).toMatch(/FAIL {2}authority key: .*but authority\.pub pins/);
    expect(t).not.toContain(other);
  });

  it("warns about missing keys, and fails them with --release", () => {
    const fx = fixture({ noAuthorKey: true });
    const run = (release) => {
      const out = [];
      const code = doctor({ root: fx.root, run: doctorRun, env: { TOOL_KEYS_DIR: fx.keys }, log: (l) => out.push(l), release, install: false });
      return { code, t: out.join("\n") };
    };
    expect(run(false).t).toMatch(/warn {2}author key: .*does not exist/);
    expect(run(true).code).toBe(1);
  });
});
