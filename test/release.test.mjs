// SPDX-License-Identifier: MIT
// scripts/release.mjs and scripts/doctor.mjs against a stand-in for git and gh: a temporary repository holds the
// files the scripts read, an injected runner answers every command from a described state and records it, and the
// keys are throwaway encrypted key files. No network, no real keys, nothing outside the temporary folder changes.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { doctor } from "../scripts/doctor.mjs";
import { createContext, datedChangelog, nextVersion, parseArgs, release, unreleasedBody } from "../scripts/release.mjs";
import { fingerprint, inspectKeyFolder, keyFiles, workTreeOf } from "../scripts/release-kit.mjs";
import { makeKey } from "./keys.mjs";

const KEYS = { author: await makeKey(), authority: await makeKey(), other: await makeKey() };

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
  const { author, authority } = KEYS;
  const w = (rel, text) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  };
  w("CHANGELOG.md", opts.changelog ?? CHANGELOG);
  w("package.json", JSON.stringify({ name: "aprscaching-tools", version: "1.1.0" }, null, 2) + "\n");
  w("lib.lock", JSON.stringify({ ref: "a".repeat(40) }));
  w("vendor/aprscaching/.lib-ref", "a".repeat(40) + "\n");
  w("node_modules/.modules.yaml", "");
  w("authority.pub", (opts.authorityPub ?? authority.pub) + "\n");
  const entry = {
    name: "foo",
    title: "Foo",
    author: "OE8APR",
    version: "1.0.0",
    pubkey: author.pub,
    entry: "tools/foo/tool.json",
  };
  w("registry.json", JSON.stringify({ format: 1, entries: [entry] }));
  w("tools/foo/tool.json", JSON.stringify({ name: "foo" }));
  for (const t of opts.unlisted ?? []) w(`tools/${t}/tool.json`, JSON.stringify({ name: t }));
  const keys = opts.keysInside ? path.join(root, ".keys") : path.join(base, "keys");
  fs.mkdirSync(keys);
  fs.chmodSync(keys, opts.dirMode ?? 0o700);
  if (!opts.noAuthorKey)
    fs.writeFileSync(path.join(keys, "oe8apr-tool-author.key"), opts.plainAuthor ? author.plain : author.file, {
      mode: opts.mode ?? 0o600,
    });
  fs.writeFileSync(path.join(keys, "registry-authority.key"), authority.file, { mode: 0o600 });
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
    devMovedOn: false,
    releaseBranches: [],
    devLog: [],
    head: "h7",
    prs: [],
    viewHead: null,
    createPrints: null,
    ...s,
  };
  const calls = [];
  const run = (cmd, args, opts = {}) => {
    const line = `${cmd === process.execPath ? "node" : cmd} ${args.join(" ")}`;
    calls.push({ line, env: opts.env ? { ...opts.env } : undefined, inherit: !!opts.inherit });
    const ok = (stdout = "") => ({ status: 0, stdout, stderr: "" });
    const no = (stderr = "") => ({ status: 1, stdout: "", stderr });
    if (line.startsWith("git fetch")) return ok();
    if (line === "git rev-parse --abbrev-ref HEAD") return ok(`${st.current}\n`);
    if (line === "git status --porcelain") return ok(st.porcelain);
    if (line.startsWith("git rev-parse --verify --quiet ")) return st.refs.has(args.at(-1)) ? ok("1234\n") : no();
    if (line === "git show origin/dev:CHANGELOG.md") return ok(st.devChangelog);
    if (line === "git show origin/main:CHANGELOG.md") return ok(st.mainChangelog);
    if (line.startsWith("git ls-remote --tags"))
      return ok(st.tagged ? `abc\trefs/tags/${args.at(-1).split("/").pop()}\n` : "");
    if (line === "git tag --list v*") return ok(st.tags.join("\n"));
    if (line === "git remote get-url origin") return ok(`${st.url}\n`);
    if (line === "git diff --stat") return ok(" registry.json | 2 +-\n");
    if (line === "git rev-parse origin/main") return ok("feedface\n");
    if (line.startsWith("git for-each-ref")) return ok(st.releaseBranches.join("\n"));
    if (line.startsWith("git log --no-merges"))
      return ok(st.devLog.map(([subject, body = ""]) => `${subject}\x1f${body}\x1e`).join("\n"));
    if (line.startsWith("git rev-parse v") && line.endsWith("^{commit}")) return ok(`${st.localTagAt ?? "0ld"}\n`);
    if (line === "git merge-base --is-ancestor origin/dev origin/main") return st.devMovedOn ? no() : ok();
    if (line === "git rev-parse HEAD") return ok(`${st.head}\n`);
    const arg = (name) => args[args.indexOf(name) + 1];
    if (line.startsWith("gh pr create")) {
      // a number no listed PR has, so the step must take it from what gh pr create prints
      const number = Math.max(6, ...st.prs.map((p) => p.number)) + 1;
      const pr = {
        number,
        url: `https://github.com/apachler/aprscaching-tools/pull/${number}`,
        headRefName: arg("--head"),
        baseRefName: arg("--base"),
        headRefOid: arg("--head") === "main" ? "feedface" : st.head,
        isCrossRepository: false,
      };
      st.prs.push(pr);
      return ok(st.createPrints ?? `${pr.url}\n`);
    }
    if (line.startsWith("gh pr list"))
      return ok(
        JSON.stringify(st.prs.filter((p) => p.headRefName === arg("--head") && p.baseRefName === arg("--base"))),
      );
    if (line.startsWith("gh pr checks") && args.includes("--json"))
      return ok(JSON.stringify([{ name: "verify", bucket: "pass" }]));
    if (line.startsWith("gh pr view")) {
      const pr = st.prs.find((p) => String(p.number) === args[2]);
      return ok(JSON.stringify({ headRefOid: st.viewHead ?? pr?.headRefOid }));
    }
    if (line === "gh auth status") return st.ghAuth === 0 ? ok() : no("not logged in");
    if (line === "node scripts/verify.mjs --strict") return { status: st.verifyStrict, stdout: "", stderr: "" };
    if (line === "node scripts/sign-all.mjs") return { status: st.signAll ?? 0, stdout: "", stderr: "" };
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
    terminal: o.terminal ?? false,
  });
  return { ctx, out, asked, text: () => out.join("\n") };
}

/** The stand-in for git, gh and corepack that doctor.mjs asks: a ready computer. */
function doctorRun(cmd, args) {
  const ok = () => ({ status: 0, stdout: "", stderr: "" });
  const line = `${cmd} ${args.join(" ")}`;
  if (line === "git remote get-url origin")
    return { ...ok(), stdout: "git@github.com:apachler/aprscaching-tools.git\n" };
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
    expect(t).toContain(`author key ${fx.author.pub} (${fingerprint(fx.author.pub)})`);
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
    expect(t).toMatch(/todo {2}tag/);
    expect(t).toMatch(/todo {2}sync-dev/);
  });

  it("finds a tagged release that dev does not hold yet", async () => {
    const fx = fixture({ changelog: DATED("1.2.0") });
    const w = world({ mainChangelog: DATED("1.2.0"), tagged: true, tags: ["v1.1.0", "v1.2.0"] });
    const h = harness(fx, w, { dryRun: true });
    expect(await release(h.ctx)).toBe(0);
    expect(h.text()).toMatch(/v1\.2\.0 is tagged on origin: dev still needs it \(sync-dev\)/);
    expect(h.text()).toMatch(/done {2}tag/);
    expect(h.text()).toMatch(/todo {2}sync-dev/);
  });

  it("finds a tagged release in dev done but for the handover", async () => {
    const fx = fixture({ changelog: DATED("1.2.0") });
    const w = world({
      devChangelog: DATED("1.2.0"),
      mainChangelog: DATED("1.2.0"),
      tagged: true,
      tags: ["v1.1.0", "v1.2.0"],
    });
    const h = harness(fx, w, { dryRun: true });
    expect(await release(h.ctx)).toBe(0);
    expect(h.text()).toMatch(/v1\.2\.0 is tagged on origin: only the handover is left/);
    expect(h.text()).toMatch(/done {2}sync-dev/);
    expect(h.text()).toMatch(/todo {2}handover/);
  });

  it("on the release branch, finds prepare and sign done once verify --strict holds", async () => {
    const fx = fixture();
    const w = world({ current: "release/v1.2.0", porcelain: " M registry.json\n", verifyStrict: 0 });
    w.st.refs.add("refs/heads/release/v1.2.0");
    const h = harness(fx, w, { dryRun: true });
    expect(await release(h.ctx)).toBe(0);
    expect(h.text()).toMatch(/done {2}prepare/);
    expect(h.text()).toMatch(/done {2}sign/);
    expect(h.text()).toMatch(/todo {2}changelog/);
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
    expect(h.text()).not.toContain(fx.author.secret);
  });

  it("fails a key file that holds its private key unencrypted, naming the command that encrypts it", async () => {
    const fx = fixture({ plainAuthor: true });
    const h = harness(fx, world(), { dryRun: true });
    expect(await release(h.ctx)).toBe(1);
    const file = path.join(fx.keys, "oe8apr-tool-author.key");
    expect(h.text()).toContain(
      `FAIL  the author key: ${file} holds its private key unencrypted; encrypt it, keeping the key: node scripts/genkey.mjs --convert ${file}`,
    );
    expect(h.text()).not.toContain(fx.author.secret);
    expect(h.text()).not.toContain(fx.author.plain);
  });

  it("fails a missing key file and an authority key authority.pub does not pin", async () => {
    const r = await check({ noAuthorKey: true, authorityPub: KEYS.other.pub }, {});
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

  it("runs sign-all alone, on the terminal, with no key in any environment, after the build", async () => {
    const fx = fixture();
    const w = world({ current: "release/v1.2.0" });
    w.st.refs.add("refs/heads/release/v1.2.0");
    const before = { ...process.env };
    const h = harness(fx, w, { yes: true, terminal: true });
    expect(await release(h.ctx, { only: "sign" })).toBe(0);
    // what the step runs once the state is read: sign-all, which opens the keys itself, and then nothing but a diff
    const since = w.calls.findIndex((c) => c.line === "node scripts/sign-all.mjs");
    expect(w.calls.slice(since).map((c) => c.line)).toEqual(["node scripts/sign-all.mjs", "git diff --stat"]);
    expect(w.calls[since].inherit).toBe(true);
    // the build ran in the prepare step; the sign step runs no build, pnpm or other repository script of its own
    expect(
      w.calls
        .slice(0, since)
        .filter((c) => /^(node|corepack)/.test(c.line))
        .map((c) => c.line),
    ).toEqual(["node scripts/verify.mjs --strict"]);
    for (const c of w.calls) {
      const env = JSON.stringify(c.env ?? {});
      for (const k of [fx.author, fx.authority])
        for (const v of [k.secret, k.plain, k.file]) expect(env).not.toContain(v);
      expect(Object.keys(c.env ?? {})).not.toEqual(expect.arrayContaining(["AUTHOR_KEY"]));
    }
    expect(h.text()).toMatch(/sign every listed tool with the author key {4}/);
    expect(process.env).toEqual(before);
  });

  it("hands the sign step to the maintainer when no terminal can type the passphrases", async () => {
    const fx = fixture();
    const w = world({ current: "release/v1.2.0" });
    w.st.refs.add("refs/heads/release/v1.2.0");
    const h = harness(fx, w, { yes: true, terminal: false });
    expect(await release(h.ctx, { only: "sign" })).toBe(1);
    expect(h.text()).toContain(
      `sign needs the maintainer: the keys open only with their passphrases, typed at a terminal. In a terminal of your own, in ${fx.root}, run: node scripts/release.mjs 1.2.0 --step sign`,
    );
    expect(w.calls.filter((c) => c.line === "node scripts/sign-all.mjs")).toEqual([]);
  });

  it("refuses to sign with a key file still in the plain form", async () => {
    const fx = fixture({ plainAuthor: true });
    const w = world({ current: "release/v1.2.0" });
    w.st.refs.add("refs/heads/release/v1.2.0");
    const h = harness(fx, w, { yes: true, terminal: true });
    expect(await release(h.ctx, { only: "sign" })).toBe(1);
    expect(h.text()).toMatch(
      /holds its private key unencrypted; encrypt it, keeping the key: node scripts\/genkey\.mjs --convert /,
    );
    expect(w.calls.filter((c) => c.line === "node scripts/sign-all.mjs")).toEqual([]);
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

  /** A fork's open PR from a branch named like the one the step means, which `gh pr list --head` also returns. */
  const forkPr = (head, base) => ({
    number: 99,
    url: "https://github.com/apachler/aprscaching-tools/pull/99",
    headRefName: head,
    baseRefName: base,
    headRefOid: "f0f0f0f",
    isCrossRepository: true,
  });
  const releaseWorld = (s = {}) => {
    const w = world({ current: "release/v1.2.0", verifyStrict: 0, ...s });
    w.st.refs.add("refs/heads/release/v1.2.0");
    return w;
  };
  const ghPr = (w) => w.calls.map((c) => c.line).filter((l) => l.startsWith("gh pr"));

  it("opens and merges its own release PR when a fork's PR of the same branch name is open", async () => {
    const w = releaseWorld({ prs: [forkPr("release/v1.2.0", "main")] });
    const h = harness(fixture({ changelog: DATED("1.2.0") }), w, { yes: true });
    expect(await release(h.ctx, { only: "pr-main" })).toBe(0);
    const lines = ghPr(w);
    expect(lines).toContainEqual(expect.stringMatching(/^gh pr create --base main --head release\/v1\.2\.0 /));
    expect(lines).toContainEqual(expect.stringMatching(/^gh pr merge 100 --merge --match-head-commit h7 /));
    expect(lines.filter((l) => / 99 /.test(l))).toEqual([]);
  });

  it("opens and merges its own main → dev PR when a fork's PR from its main is open", async () => {
    const w = world({ mainChangelog: DATED("1.2.0"), tagged: true, devMovedOn: true, prs: [forkPr("main", "dev")] });
    const h = harness(fixture(), w, { yes: true });
    expect(await release(h.ctx, { only: "sync-dev" })).toBe(0);
    const lines = ghPr(w);
    expect(lines).toContainEqual(expect.stringMatching(/^gh pr create --base dev --head main /));
    expect(lines).toContainEqual(expect.stringMatching(/^gh pr merge 100 --merge --match-head-commit feedface /));
    expect(lines.filter((l) => / 99 /.test(l))).toEqual([]);
  });

  it("stops when gh pr create prints no pull request URL, merging nothing", async () => {
    const w = releaseWorld({ prs: [forkPr("release/v1.2.0", "main")], createPrints: "" });
    const h = harness(fixture({ changelog: DATED("1.2.0") }), w, { yes: true });
    expect(await release(h.ctx, { only: "pr-main" })).toBe(1);
    expect(h.text()).toMatch(/gh pr create printed no pull request URL/);
    expect(ghPr(w).filter((l) => /^gh pr (checks|merge)/.test(l))).toEqual([]);
  });

  it("reuses its own open PR at the commit it pushed, without opening another", async () => {
    const own = { ...forkPr("release/v1.2.0", "main"), number: 8, headRefOid: "h7", isCrossRepository: false };
    const w = releaseWorld({ prs: [own] });
    const h = harness(fixture({ changelog: DATED("1.2.0") }), w, { yes: true });
    expect(await release(h.ctx, { only: "pr-main" })).toBe(0);
    const lines = ghPr(w);
    expect(lines.filter((l) => l.startsWith("gh pr create"))).toEqual([]);
    expect(lines).toContainEqual(expect.stringMatching(/^gh pr merge 8 --merge --match-head-commit h7 /));
  });

  it("stops when the PR's reported head is not the commit it means to merge, naming both", async () => {
    const w = releaseWorld({ viewHead: "e1e1e1e" });
    const h = harness(fixture({ changelog: DATED("1.2.0") }), w, { yes: true });
    expect(await release(h.ctx, { only: "pr-main" })).toBe(1);
    expect(h.text()).toMatch(/#7's head is e1e1e1e, not h7/);
    expect(ghPr(w).filter((l) => l.startsWith("gh pr merge"))).toEqual([]);
  });

  it("stops at its own PR at another commit, neither merging it nor opening a second", async () => {
    const stale = { ...forkPr("main", "dev"), number: 8, headRefOid: "0ld", isCrossRepository: false };
    const w = world({ mainChangelog: DATED("1.2.0"), tagged: true, devMovedOn: true, prs: [stale] });
    const h = harness(fixture(), w, { yes: true });
    expect(await release(h.ctx, { only: "sync-dev" })).toBe(1);
    expect(h.text()).toMatch(/#8 from main into dev is at 0ld, not at feedface/);
    expect(ghPr(w).filter((l) => /^gh pr (create|merge)/.test(l))).toEqual([]);
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
    expect(keyFiles({ HOME: "/home/op", XDG_CONFIG_HOME: "relative" }).dir).toBe(
      "/home/op/.config/aprscaching-tools/keys",
    );
  });

  it("takes TOOL_KEYS_DIR and the per-file overrides", () => {
    const k = keyFiles({
      HOME: "/home/op",
      XDG_CONFIG_HOME: "/srv/config",
      TOOL_KEYS_DIR: "/vault",
      TOOL_AUTHORITY_KEY_FILE: "/usb/a.key",
    });
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
      const code = doctor({
        root: fx.root,
        run: doctorRun,
        env,
        log: (l) => out.push(l),
        nodeVersion: "24.0.0",
        install: false,
      });
      return { code, t: out.join("\n") };
    };
    const ok = run({ HOME: path.join(fx.base, "nohome"), XDG_CONFIG_HOME: config });
    expect(ok.code, ok.t).toBe(0);
    expect(ok.t).toContain(`pass  author key: ${fx.author.pub}`);
    expect(ok.t).toMatch(/pass {2}key folder .* is outside every git working tree/);
    fs.mkdirSync(path.join(config, ".git"));
    const inside = run({ HOME: path.join(fx.base, "nohome"), XDG_CONFIG_HOME: config });
    expect(inside.code).toBe(1);
    expect(inside.t).toMatch(/FAIL {2}the key folder .* lies inside a git working tree/);
    expect(inside.t).not.toContain(fx.author.secret);
  });
});

describe("release.mjs arguments and resuming", () => {
  it("parses the options, and refuses one without its value", () => {
    expect(parseArgs(["1.3.0", "--step", "tag", "--yes"])).toMatchObject({ version: "1.3.0", step: "tag", yes: true });
    expect(parseArgs(["1.3.1", "--from", "v1.3.0"])).toMatchObject({ from: "v1.3.0" });
    expect(parseArgs(["1.3.0", "--step"]).error).toBe("--step needs a value");
    expect(parseArgs(["1.3.0", "--source", "--yes"]).error).toBe("--source needs a value");
    expect(parseArgs([]).error).toBeUndefined(); // the version is optional: the commits suggest it
  });

  it("resumes the tag step when a local tag on main was not pushed yet", async () => {
    const fx = fixture({ changelog: DATED("1.2.0") });
    const w = world({ mainChangelog: DATED("1.2.0"), localTagAt: "feedface" });
    w.st.refs.add("refs/tags/v1.2.0");
    const h = harness(fx, w, { dryRun: true });
    expect(await release(h.ctx)).toBe(0);
    expect(h.text()).toMatch(/ok {4}a local tag v1\.2\.0 is on origin\/main; the tag step pushes it/);
    expect(h.text()).toMatch(/todo {2}tag/);
  });

  it("takes the version the commits since the newest tag ask for", async () => {
    const run = async (devLog, o = {}) => {
      const fx = fixture();
      const w = world({ tags: ["v1.0.0", "v1.3.0"], devLog, ...o });
      const h = harness(fx, w, { version: "", dryRun: true });
      await release(h.ctx);
      return h.text();
    };
    expect(await run([["fix(tools): a fix"], ["docs: a page"]])).toMatch(/^version 1\.3\.1: 2 fix\(es\)/m);
    expect(await run([["fix: x"], ["feat(tools): a tool"]])).toMatch(/^version 1\.4\.0: 1 feature\(s\)/m);
    expect(await run([["feat!: drop api 1.0"]])).toMatch(/^version 2\.0\.0: a breaking change/m);
    expect(await run([["chore(release): v1.3.0"]])).toMatch(/nothing to release/);
    // a release in progress keeps its version, whatever the commits say
    expect(await run([["feat: more"]], { releaseBranches: ["origin/release/v1.3.1"] })).toMatch(
      /^version 1\.3\.1: the release in progress on release\/v1\.3\.1/m,
    );
  });

  it("takes a patch on the tag a hotfix starts from", async () => {
    const fx = fixture();
    const w = world({ tags: ["v1.2.0", "v1.3.0"], devLog: [["feat: on dev"]] });
    const h = harness(fx, w, { version: "", from: "v1.2.0", dryRun: true });
    await release(h.ctx);
    expect(h.text()).toMatch(/^version 1\.2\.1: a hotfix on v1\.2\.0/m);
  });

  it("refuses a local tag elsewhere than main", async () => {
    const fx = fixture({ changelog: DATED("1.2.0") });
    const w = world({ mainChangelog: DATED("1.2.0") });
    w.st.refs.add("refs/tags/v1.2.0");
    const h = harness(fx, w, { dryRun: true });
    expect(await release(h.ctx)).toBe(1);
    expect(h.text()).toMatch(/a local tag v1\.2\.0 exists but origin has none/);
  });
});

describe("release.mjs helpers", () => {
  it("bumps by the strongest change: breaking, feature, else patch", () => {
    const c = (subject, body = "") => ({ subject, body });
    expect(nextVersion("1.3.0", [])).toBeNull();
    expect(nextVersion("1.3.0", [c("chore(release): v1.3.0")])).toBeNull();
    expect(nextVersion("1.3.0", [c("fix: a"), c("ci: b")]).version).toBe("1.3.1");
    expect(nextVersion("1.3.2", [c("fix: a"), c("feat(scripts): b")]).version).toBe("1.4.0");
    expect(nextVersion("1.3.2", [c("feat(api)!: c")]).version).toBe("2.0.0");
    expect(nextVersion("1.3.2", [c("feat: c", "BREAKING CHANGE: the bus renames a topic")]).version).toBe("2.0.0");
    expect(nextVersion("1.3.2", [c("fix: mention BREAKING CHANGE: in prose", "")]).version).toBe("1.3.3");
  });

  it("reads and dates the Unreleased section", () => {
    expect(unreleasedBody(CHANGELOG)).toBe("- A new tool.");
    expect(unreleasedBody("# Changelog\n\n## [Unreleased]\n")).toBe("");
    expect(datedChangelog(CHANGELOG, "1.2.0", "2026-10-07")).toBe(DATED("1.2.0"));
  });
});

describe("doctor.mjs", () => {
  it("passes a ready computer and prints only public keys", () => {
    const fx = fixture();
    fs.writeFileSync(path.join(fx.root, "package.json"), JSON.stringify({ packageManager: "pnpm@11.9.0" }));
    const out = [];
    const code = doctor({
      root: fx.root,
      run: doctorRun,
      env: { TOOL_KEYS_DIR: fx.keys },
      log: (l) => out.push(l),
      nodeVersion: "24.0.0",
    });
    const t = out.join("\n");
    expect(code, t).toBe(0);
    expect(t).toContain(`pass  author key: ${fx.author.pub} (fingerprint ${fingerprint(fx.author.pub)})`);
    expect(t).toContain(`pass  authority key: ${fx.authority.pub}`);
    expect(t).not.toContain(fx.author.secret);
    expect(t).not.toContain(fx.authority.secret);
  });

  it("fails an old Node, a key others can read and an author key the registry does not list", () => {
    const fx = fixture({ mode: 0o640 });
    const other = KEYS.other;
    fs.writeFileSync(path.join(fx.keys, "registry-authority.key"), other.file, { mode: 0o600 });
    const out = [];
    const code = doctor({
      root: fx.root,
      run: doctorRun,
      env: { TOOL_KEYS_DIR: fx.keys },
      log: (l) => out.push(l),
      nodeVersion: "20.1.0",
    });
    const t = out.join("\n");
    expect(code).toBe(1);
    expect(t).toMatch(/FAIL {2}Node 20\.1\.0/);
    expect(t).toMatch(/FAIL {2}author key: .*mode 640/);
    expect(t).toMatch(/FAIL {2}authority key: .*but authority\.pub pins/);
    expect(t).not.toContain(other.secret);
  });

  it("fails a key file in the plain form, with or without --release, naming the command that encrypts it", () => {
    const fx = fixture({ plainAuthor: true });
    const file = path.join(fx.keys, "oe8apr-tool-author.key");
    for (const release of [false, true]) {
      const out = [];
      const code = doctor({
        root: fx.root,
        run: doctorRun,
        env: { TOOL_KEYS_DIR: fx.keys },
        log: (l) => out.push(l),
        release,
        install: false,
      });
      const t = out.join("\n");
      expect(code, t).toBe(1);
      expect(t).toContain(
        `FAIL  author key: ${file} holds its private key unencrypted; encrypt it, keeping the key: node scripts/genkey.mjs --convert ${file}`,
      );
      expect(t).not.toContain(fx.author.secret);
      expect(t).toMatch(/pass {2}authority key: /);
    }
  });

  it("warns about missing keys, and fails them with --release", () => {
    const fx = fixture({ noAuthorKey: true });
    const run = (release) => {
      const out = [];
      const code = doctor({
        root: fx.root,
        run: doctorRun,
        env: { TOOL_KEYS_DIR: fx.keys },
        log: (l) => out.push(l),
        release,
        install: false,
      });
      return { code, t: out.join("\n") };
    };
    expect(run(false).t).toMatch(/warn {2}author key: .*does not exist/);
    expect(run(true).code).toBe(1);
  });
});
