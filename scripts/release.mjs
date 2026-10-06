#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Release a registry tag, step by step, on the computer that holds the signing keys:
//
//   node scripts/release.mjs <X.Y.Z> [--dry-run] [--step <name> [--yes]] [--source <aprscaching clone>]
//
// The steps, in order:
//   check      the tree is clean, gh is signed in, the version is new semver, CHANGELOG.md's Unreleased section has
//              content, the key files exist with mode 600 and match authority.pub and the project's author key;
//   prepare    release/vX.Y.Z from origin/dev; pnpm install, fetch-libs --source, build --check;
//   sign       sign-all with the two keys, which ends in verify --strict;
//   changelog  Unreleased becomes "## [X.Y.Z] - <date>" under a new empty Unreleased; package.json takes the version;
//   pr-dev     commit with a sign-off, push, a PR into dev, wait for its checks, squash-merge;
//   pr-main    a PR from dev into main, wait for the strict checks, merge as a merge commit;
//   tag        tag origin/main as vX.Y.Z, push the tag, wait for the Release workflow;
//   handover   print the aprscaching command that bundles the tag.
//
// Every step checks its precondition and says what it will do, and asks y/N before anything that changes git or
// GitHub. A rerun finds which steps are done (the branch, a strict verify, the dated section on origin/dev and
// origin/main, the tag) and continues from the first that is not. --dry-run only reports. --step runs one step;
// --yes answers its questions, for a step the operator already confirmed (it needs --step).
//
// The key files come from TOOL_KEYS_DIR (default $XDG_CONFIG_HOME/aprscaching-tools/keys, else
// ~/.config/aprscaching-tools/keys), or TOOL_AUTHOR_KEY_FILE and TOOL_AUTHORITY_KEY_FILE; check refuses a key folder
// inside a git working tree. Their values are read only in the sign step and passed to sign-all in that one child
// process's environment; everything printed passes through a filter that removes them.
import fs from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { pathToFileURL } from "node:url";
import {
  PNPM,
  UPSTREAM,
  authorKeysOf,
  corepackEnv,
  defaultRunner,
  fingerprint,
  inspectKey,
  inspectKeyFolder,
  keyFiles,
  loadKey,
  redact,
  repoRoot,
  repoSlug,
} from "./release-kit.mjs";

export const STEPS = ["check", "prepare", "sign", "changelog", "pr-dev", "pr-main", "tag", "handover"];
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/** A step that cannot go on: the message says why and what to do. */
export class StepError extends Error {}
/** The operator answered no: nothing more is done, and a rerun continues here. */
export class Stopped extends Error {}

const cmp = (a, b) => {
  const x = a.split(".").map(Number);
  const y = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
};

/** The text of `## [Unreleased]` up to the next `## ` heading, trimmed. */
export function unreleasedBody(changelog) {
  const m = /^## \[Unreleased\][^\n]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(changelog ?? "");
  return m ? m[1].trim() : null;
}
const hasSection = (changelog, version) =>
  new RegExp(`^## \\[${version.replace(/\./g, "\\.")}\\]`, "m").test(changelog ?? "");

/** CHANGELOG.md with Unreleased dated as `version` and a new empty Unreleased above it. */
export function datedChangelog(changelog, version, date) {
  if (!/^## \[Unreleased\][^\n]*\n/m.test(changelog)) throw new StepError("CHANGELOG.md has no ## [Unreleased] section");
  return changelog.replace(/^## \[Unreleased\][^\n]*\n/m, `## [Unreleased]\n\n## [${version}] - ${date}\n`);
}

const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

async function terminalAsk(question) {
  if (!process.stdin.isTTY) {
    console.log(`${question} [y/N] no (no terminal to answer: confirm, then rerun with --step <name> --yes)`);
    return false;
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return /^y(es)?$/i.test((await rl.question(`${question} [y/N] `)).trim());
  } finally {
    rl.close();
  }
}

/**
 * The context every step works with. Everything that touches the outside world is injectable, so the tests run
 * without git, gh, a network or keys: `run(cmd, args, opts)` → { status, stdout, stderr }, `ask(question)` → bool.
 */
export function createContext(o) {
  const version = String(o.version ?? "").replace(/^v/, "");
  const secrets = [];
  const ctx = {
    version,
    tag: `v${version}`,
    branch: `release/v${version}`,
    root: o.root ?? repoRoot,
    env: o.env ?? process.env,
    dryRun: !!o.dryRun,
    yes: !!o.yes,
    source: o.source,
    today: o.today ?? localDate(),
    sleep: o.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))),
    secrets,
    out: o.log ?? ((line) => console.log(line)),
    rawAsk: o.ask ?? terminalAsk,
    rawRun: o.run ?? defaultRunner,
    node: o.node ?? process.execPath,
  };
  ctx.log = (line = "") => ctx.out(redact(line, secrets));
  ctx.run = (cmd, args, opts = {}) => {
    const r = ctx.rawRun(cmd, args, { cwd: ctx.root, ...opts });
    return { ...r, stdout: redact(r.stdout, secrets), stderr: redact(r.stderr, secrets) };
  };
  ctx.git = (...args) => ctx.run("git", args);
  ctx.gh = (...args) => ctx.run("gh", [...args, "-R", ctx.slug ?? UPSTREAM]);
  ctx.ask = async (q) => {
    if (ctx.yes) {
      ctx.log(`${q} [y/N] yes (--yes)`);
      return true;
    }
    return ctx.rawAsk(q);
  };
  /** Ask, then run `fn`; a "no" stops the release where it is. */
  ctx.confirm = async (q, fn) => {
    if (!(await ctx.ask(q))) throw new Stopped(`stopped before: ${q}`);
    return fn();
  };
  ctx.must = (r, what) => {
    if (r.status !== 0) throw new StepError(`${what} failed${r.stderr.trim() ? `: ${r.stderr.trim().split("\n").slice(-3).join(" / ")}` : ""}`);
    return r;
  };
  ctx.read = (rel) => {
    try {
      return fs.readFileSync(path.join(ctx.root, rel), "utf8");
    } catch {
      return null;
    }
  };
  return ctx;
}

/** What is true now: the branches, the tree, the remote state of the release. Read-only apart from a fetch. */
export function detect(ctx, { fetch = true } = {}) {
  if (fetch) {
    const f = ctx.git("fetch", "origin", "--prune", "--tags");
    if (f.status !== 0) ctx.log(`warn  git fetch failed; using the refs this clone has (${f.stderr.trim().split("\n")[0]})`);
  }
  const ref = (r) => ctx.git("rev-parse", "--verify", "--quiet", r);
  const show = (r) => {
    const x = ctx.git("show", `${r}:CHANGELOG.md`);
    return x.status === 0 ? x.stdout : null;
  };
  const current = ctx.git("rev-parse", "--abbrev-ref", "HEAD").stdout.trim();
  const porcelain = ctx.git("status", "--porcelain").stdout;
  const lock = JSON.parse(ctx.read("lib.lock") ?? "{}");
  const vendorRef = (ctx.read("vendor/aprscaching/.lib-ref") ?? "").trim();
  const onRelease = current === ctx.branch;
  const s = {
    current,
    onRelease,
    porcelain,
    clean: porcelain.trim() === "",
    localBranch: ref(`refs/heads/${ctx.branch}`).status === 0,
    remoteBranch: ref(`refs/remotes/origin/${ctx.branch}`).status === 0,
    vendorOk: !!lock.ref && vendorRef === lock.ref,
    installed: fs.existsSync(path.join(ctx.root, "node_modules", ".modules.yaml")),
    devChangelog: show("origin/dev"),
    mainChangelog: show("origin/main"),
    workChangelog: ctx.read("CHANGELOG.md"),
    tagged: ctx.git("ls-remote", "--tags", "origin", `refs/tags/${ctx.tag}`).stdout.trim() !== "",
    localTag: ref(`refs/tags/${ctx.tag}`).status === 0,
  };
  s.onDev = hasSection(s.devChangelog, ctx.version);
  s.onMain = hasSection(s.mainChangelog, ctx.version);
  s.dated = onRelease && hasSection(s.workChangelog, ctx.version);
  // a strict verify of the working tree: the signatures of the release branch hold
  s.strictOk = onRelease && !s.onDev && ctx.run(ctx.node, ["scripts/verify.mjs", "--strict"]).status === 0;
  return s;
}

/** The steps a state shows as done. `check` and `handover` always run. */
export function doneSteps(s) {
  const done = new Set();
  const add = (...xs) => xs.forEach((x) => done.add(x));
  if (s.tagged) add("prepare", "sign", "changelog", "pr-dev", "pr-main", "tag");
  else if (s.onMain) add("prepare", "sign", "changelog", "pr-dev", "pr-main");
  else if (s.onDev) add("prepare", "sign", "changelog", "pr-dev");
  else {
    if (s.onRelease && s.vendorOk && s.installed) add("prepare");
    if (done.has("prepare") && s.strictOk) add("sign");
    if (s.dated) add("changelog");
  }
  return done;
}

const toolFolders = (root) => {
  const dir = path.join(root, "tools");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(dir, d.name, "tool.json")))
    .map((d) => d.name)
    .sort();
};

/**
 * The key files' state: { author, authority } each { file, state, pub?, detail? }, with what is wrong (`problems`)
 * and what deserves a look (`warnings`).
 */
function keyReport(ctx) {
  const files = keyFiles(ctx.env);
  const author = { file: files.author, ...inspectKey(files.author) };
  const authority = { file: files.authority, ...inspectKey(files.authority) };
  const where = inspectKeyFolder(files);
  const problems = [...where.fails];
  for (const [name, k] of [["author", author], ["authority", authority]])
    if (k.state !== "ok") problems.push(`the ${name} key: ${k.detail}`);
  const pinned = (ctx.read("authority.pub") ?? "").trim();
  if (authority.pub && authority.pub !== pinned)
    problems.push(`the authority key file holds ${authority.pub}, but authority.pub pins ${pinned}`);
  const expected = authorKeysOf(JSON.parse(ctx.read("registry.json") ?? "{}"));
  if (author.pub && expected.length && !expected.includes(author.pub))
    problems.push(`the author key file holds ${author.pub}; the registry lists OE8APR's tools under ${expected.join(", ")}`);
  return { author, authority, problems, warnings: where.warns };
}

// ---------------------------------------------------------------------------------------------------------------
// The steps. Each takes (ctx, state) and returns nothing; it throws StepError when it cannot go on.

const steps = {};

steps.check = async (ctx, s) => {
  const fails = [];
  const ok = (m) => ctx.log(`ok    ${m}`);
  const fail = (m) => {
    fails.push(m);
    ctx.log(`FAIL  ${m}`);
  };
  const done = doneSteps(s);

  if (!SEMVER.test(ctx.version)) fail(`${ctx.version || "(none)"} is not a version X.Y.Z`);
  else ok(`version ${ctx.version}`);

  const auth = ctx.run("gh", ["auth", "status"]);
  if (auth.status !== 0) fail("gh is not signed in: run gh auth login");
  else ok("gh is signed in");

  const url = ctx.git("remote", "get-url", "origin").stdout.trim();
  ctx.slug = repoSlug(url) ?? UPSTREAM;
  if (ctx.slug !== UPSTREAM) ctx.log(`warn  origin is ${url}; pull requests and the tag go to ${ctx.slug}`);
  else ok(`origin is ${ctx.slug}`);

  if (s.tagged) ctx.log(`info  ${ctx.tag} is tagged on origin: only the handover is left`);
  else if (SEMVER.test(ctx.version)) {
    const tags = ctx
      .git("tag", "--list", "v*")
      .stdout.split("\n")
      .map((t) => t.trim().replace(/^v/, ""))
      .filter((t) => SEMVER.test(t));
    const newest = tags.sort(cmp).at(-1);
    if (s.localTag) fail(`a local tag ${ctx.tag} exists but origin has none; delete it (git tag -d ${ctx.tag}) or push it`);
    else if (newest && cmp(ctx.version, newest) <= 0 && !s.onDev) fail(`${ctx.version} is not newer than v${newest}`);
    else ok(`${ctx.tag} is not taken${newest ? ` (newest v${newest})` : ""}`);
  }

  if (s.tagged) ok("nothing left to change in this tree");
  else if (!s.clean && !s.onRelease) fail(`the working tree has changes on ${s.current}; commit or stash them first`);
  else if (!s.clean) ok(`changes on ${ctx.branch} belong to the release`);
  else ok("the working tree is clean");

  if (!done.has("changelog")) {
    const text = s.onRelease ? s.workChangelog : s.devChangelog;
    const body = unreleasedBody(text);
    if (body === null) fail("CHANGELOG.md has no ## [Unreleased] section");
    else if (!body) fail("CHANGELOG.md's Unreleased section is empty: write what this release changes first");
    else ok(`Unreleased has ${body.split("\n").length} line(s) for ${ctx.version}`);
  }

  if (!done.has("sign")) {
    const k = keyReport(ctx);
    for (const p of k.problems) fail(p);
    for (const w of k.warnings) ctx.log(`warn  ${w}`);
    if (!k.problems.length) {
      ok(`author key ${k.author.pub} (${fingerprint(k.author.pub)})`);
      ok(`authority key ${k.authority.pub} (${fingerprint(k.authority.pub)}), as authority.pub pins`);
    }
    const reg = JSON.parse(ctx.read("registry.json") ?? "{}");
    const listed = new Set((reg.entries ?? []).map((e) => e.entry));
    const unlisted = toolFolders(ctx.root).filter((n) => !listed.has(`tools/${n}/tool.json`));
    if (unlisted.length)
      fail(`tools without a registry entry: ${unlisted.join(", ")}; add their entries (or remove the folders) before signing`);
    else ok("every tool folder has a registry entry");
  }

  if (fails.length) throw new StepError(`check: ${fails.length} problem(s) to fix first`);
};

steps.prepare = async (ctx, s) => {
  if (!s.onRelease) {
    if (!s.clean) throw new StepError(`the working tree has changes on ${s.current}; commit or stash them first`);
    if (s.localBranch) await ctx.confirm(`Switch to ${ctx.branch}?`, () => ctx.must(ctx.git("switch", ctx.branch), "git switch"));
    else if (s.remoteBranch)
      await ctx.confirm(`Check out ${ctx.branch} from origin?`, () =>
        ctx.must(ctx.git("switch", "--track", `origin/${ctx.branch}`), "git switch"),
      );
    else
      await ctx.confirm(`Create ${ctx.branch} from origin/dev and switch to it?`, () =>
        ctx.must(ctx.git("switch", "--no-track", "-c", ctx.branch, "origin/dev"), "git switch -c"),
      );
  }
  ctx.log("install the build tools from the frozen lockfile");
  ctx.must(
    ctx.run(PNPM[0], [...PNPM[1], "install", "--frozen-lockfile", "--ignore-scripts"], { env: corepackEnv(ctx.env), inherit: true }),
    "pnpm install",
  );
  const source =
    ctx.source ?? ctx.env.APRSCACHING_SOURCE ?? path.join(ctx.env.HOME ?? "", "Development", "github", "aprscaching");
  const local = source && fs.existsSync(path.join(source, ".git"));
  ctx.log(local ? `fetch the libraries from ${source}` : "fetch the libraries from GitHub (no local aprscaching clone)");
  const fl = ctx.run(ctx.node, ["scripts/fetch-libs.mjs", ...(local ? ["--source", source] : [])], { inherit: true });
  if (fl.status !== 0)
    throw new StepError(
      local
        ? `fetch-libs failed; the clone may lack the lib.lock commit: git -C ${source} fetch origin, then rerun`
        : "fetch-libs failed",
    );
  ctx.must(ctx.run(ctx.node, ["scripts/build.mjs", "--check"], { inherit: true }), "build --check");
};

steps.sign = async (ctx, s) => {
  if (!s.onRelease) throw new StepError(`sign runs on ${ctx.branch}; run the prepare step first`);
  if (!s.vendorOk) throw new StepError("vendor/ does not hold the lib.lock libraries; run the prepare step first");
  const k = keyReport(ctx);
  if (k.problems.length) throw new StepError(k.problems.join("; "));
  ctx.log(`sign every listed tool with the author key    ${k.author.pub} (${fingerprint(k.author.pub)})`);
  ctx.log(`sign registry.json with the authority key      ${k.authority.pub} (${fingerprint(k.authority.pub)})`);
  ctx.log("then verify --strict (scripts/sign-all.mjs)");
  await ctx.confirm("Sign the release?", () => {
    const env = { ...ctx.env };
    for (const v of ["AUTHOR_KEY", "AUTHORITY_KEY", "TOOL_PRIVATE_KEY"]) delete env[v];
    env.AUTHOR_KEY = loadKey(k.author.file);
    env.AUTHORITY_KEY = loadKey(k.authority.file);
    ctx.secrets.push(env.AUTHOR_KEY, env.AUTHORITY_KEY);
    const r = ctx.run(ctx.node, ["scripts/sign-all.mjs"], { env });
    env.AUTHOR_KEY = env.AUTHORITY_KEY = undefined;
    if (r.stdout.trim()) ctx.log(r.stdout.trimEnd());
    if (r.stderr.trim()) ctx.log(r.stderr.trimEnd());
    if (r.status !== 0) throw new StepError("sign-all failed; nothing is committed. Fix the cause and run the sign step again");
  });
  ctx.log(ctx.git("diff", "--stat").stdout.trimEnd());
};

steps.changelog = async (ctx, s) => {
  if (!s.onRelease) throw new StepError(`changelog runs on ${ctx.branch}; run the prepare step first`);
  const text = s.workChangelog;
  const body = unreleasedBody(text);
  if (!body) throw new StepError("CHANGELOG.md's Unreleased section is empty: write what this release changes first");
  const pkg = ctx.read("package.json");
  const bump = pkg && JSON.parse(pkg).version !== ctx.version;
  ctx.log(`date Unreleased as "## [${ctx.version}] - ${ctx.today}" and open a new empty Unreleased`);
  if (bump) ctx.log(`set package.json's version to ${ctx.version}`);
  await ctx.confirm("Update CHANGELOG.md?", () => {
    fs.writeFileSync(path.join(ctx.root, "CHANGELOG.md"), datedChangelog(text, ctx.version, ctx.today));
    if (bump) fs.writeFileSync(path.join(ctx.root, "package.json"), pkg.replace(/("version":\s*")[^"]*(")/, `$1${ctx.version}$2`));
  });
};

/** Wait until GitHub lists the PR's checks, then watch them in the foreground; fails when one fails. */
async function watchChecks(ctx, number) {
  for (let i = 0; i < 30; i++) {
    const r = ctx.gh("pr", "checks", String(number), "--json", "name,bucket");
    let list = [];
    try {
      list = JSON.parse(r.stdout || "[]");
    } catch {
      list = [];
    }
    if (list.length) break;
    if (i === 0) ctx.log("waiting for the checks to start …");
    await ctx.sleep(10_000);
  }
  ctx.log(`watching the checks of #${number}`);
  const w = ctx.run("gh", ["pr", "checks", String(number), "--watch", "--interval", "15", "-R", ctx.slug ?? UPSTREAM], {
    inherit: true,
  });
  if (w.status !== 0) throw new StepError(`the checks of #${number} did not pass; fix them, push, and rerun`);
}

/** The open PR from `head` into `base`, or null. */
function openPr(ctx, head, base) {
  const r = ctx.must(ctx.gh("pr", "list", "--head", head, "--base", base, "--state", "open", "--json", "number,url,headRefOid"), "gh pr list");
  return JSON.parse(r.stdout || "[]")[0] ?? null;
}

async function createPr(ctx, head, base, title, body) {
  await ctx.confirm(`Open a pull request ${head} → ${base} titled "${title}"?`, () =>
    ctx.must(ctx.gh("pr", "create", "--base", base, "--head", head, "--title", title, "--body", body), "gh pr create"),
  );
  const pr = openPr(ctx, head, base);
  if (!pr) throw new StepError(`the pull request ${head} → ${base} is not listed yet; rerun in a moment`);
  ctx.log(`opened ${pr.url}`);
  return pr;
}

steps["pr-dev"] = async (ctx, s) => {
  if (!s.onRelease) throw new StepError(`pr-dev runs on ${ctx.branch}`);
  if (!s.dated) throw new StepError("CHANGELOG.md has no section for this version; run the changelog step first");
  if (!s.strictOk) throw new StepError("verify --strict fails on this tree; run the sign step first");
  const tracked = s.porcelain.split("\n").filter((l) => l.trim() && !l.startsWith("??"));
  const untracked = s.porcelain.split("\n").filter((l) => l.startsWith("??"));
  if (untracked.length) ctx.log(`warn  untracked files stay out of the commit: ${untracked.map((l) => l.slice(3)).join(", ")}`);
  if (tracked.length) {
    ctx.log(tracked.join("\n"));
    await ctx.confirm(`Commit these ${tracked.length} file(s) with a sign-off?`, () => {
      ctx.must(ctx.git("add", "-u"), "git add");
      ctx.must(ctx.git("commit", "-s", "-m", `chore(release): sign the registry and tools for ${ctx.tag}`), "git commit");
    });
  }
  const head = ctx.git("rev-parse", "HEAD").stdout.trim();
  const remote = ctx.git("rev-parse", "--verify", "--quiet", `refs/remotes/origin/${ctx.branch}`).stdout.trim();
  if (head !== remote)
    await ctx.confirm(`Push ${ctx.branch} to origin?`, () =>
      ctx.must(ctx.git("push", "-u", "origin", `${ctx.branch}:${ctx.branch}`), "git push"),
    );
  const pr =
    openPr(ctx, ctx.branch, "dev") ??
    (await createPr(ctx, ctx.branch, "dev", `chore(release): ${ctx.tag}`, `Signs the registry and tools for ${ctx.tag}.`));
  await watchChecks(ctx, pr.number);
  const sha = ctx.must(ctx.gh("pr", "view", String(pr.number), "--json", "headRefOid"), "gh pr view").stdout;
  await ctx.confirm(`Squash-merge #${pr.number} into dev?`, () =>
    ctx.must(
      ctx.gh("pr", "merge", String(pr.number), "--squash", "--match-head-commit", JSON.parse(sha).headRefOid),
      "gh pr merge",
    ),
  );
  ctx.git("fetch", "origin", "--prune");
  if (await ctx.ask(`Switch to dev, fast-forward it to origin/dev and delete the local ${ctx.branch}?`)) {
    ctx.must(ctx.git("switch", "dev"), "git switch dev");
    ctx.must(ctx.git("merge", "--ff-only", "origin/dev"), "git merge --ff-only");
    ctx.must(ctx.git("branch", "-D", ctx.branch), "git branch -D");
  }
};

steps["pr-main"] = async (ctx, s) => {
  if (!s.onDev) throw new StepError(`origin/dev has no CHANGELOG section for ${ctx.version}; finish the pr-dev step first`);
  const pr =
    openPr(ctx, "dev", "main") ?? (await createPr(ctx, "dev", "main", `chore(release): ${ctx.tag}`, `Release ${ctx.tag}.`));
  await watchChecks(ctx, pr.number);
  const sha = ctx.must(ctx.gh("pr", "view", String(pr.number), "--json", "headRefOid"), "gh pr view").stdout;
  await ctx.confirm(`Merge #${pr.number} into main as a merge commit? This publishes ${ctx.tag}'s signed state`, () =>
    ctx.must(ctx.gh("pr", "merge", String(pr.number), "--merge", "--match-head-commit", JSON.parse(sha).headRefOid), "gh pr merge"),
  );
  ctx.git("fetch", "origin", "--prune");
};

steps.tag = async (ctx, s) => {
  if (!s.onMain) throw new StepError(`origin/main has no CHANGELOG section for ${ctx.version}; finish the pr-main step first`);
  const sha = ctx.must(ctx.git("rev-parse", "origin/main"), "git rev-parse origin/main").stdout.trim();
  await ctx.confirm(`Tag origin/main (${sha.slice(0, 12)}) as ${ctx.tag} and push the tag?`, () => {
    if (!s.localTag) ctx.must(ctx.git("tag", "-a", ctx.tag, sha, "-m", `registry ${ctx.tag}`), "git tag");
    else if (ctx.git("rev-parse", `${ctx.tag}^{commit}`).stdout.trim() !== sha)
      throw new StepError(`the local tag ${ctx.tag} is not on origin/main; delete it (git tag -d ${ctx.tag}) and rerun`);
    ctx.must(ctx.git("push", "origin", `refs/tags/${ctx.tag}`), "git push tag");
  });
  let id = null;
  for (let i = 0; i < 24 && !id; i++) {
    const r = ctx.gh("run", "list", "--workflow", "release.yml", "--limit", "10", "--json", "databaseId,headBranch");
    try {
      id = JSON.parse(r.stdout || "[]").find((x) => x.headBranch === ctx.tag)?.databaseId ?? null;
    } catch {
      id = null;
    }
    if (!id) await ctx.sleep(5_000);
  }
  if (!id) throw new StepError("the Release workflow has not started; check the repository's Actions tab");
  ctx.log(`watching the Release workflow (run ${id})`);
  const w = ctx.run("gh", ["run", "watch", String(id), "--exit-status", "-R", ctx.slug ?? UPSTREAM], { inherit: true });
  if (w.status !== 0) throw new StepError("the Release workflow failed; the tag stays, and a fix is a new tag");
  const rel = ctx.gh("release", "view", ctx.tag, "--json", "url");
  if (rel.status === 0) ctx.log(`released ${JSON.parse(rel.stdout).url}`);
};

steps.handover = async (ctx) => {
  ctx.log(`${ctx.tag} is released. Bundle it into aprscaching, on a branch cut from its dev:`);
  ctx.log("");
  ctx.log(`  /bundle-tools ${ctx.tag}                     (the Claude skill in the aprscaching repository), or by hand:`);
  ctx.log(`  git -C ${ctx.root} worktree add /tmp/aprscaching-tools-${ctx.tag} ${ctx.tag}`);
  ctx.log(`  node tools/toolkey/bundle-registry.mjs ${ctx.tag} --source /tmp/aprscaching-tools-${ctx.tag}`);
  ctx.log("");
  ctx.log(`Without --source the script reads the tag from raw.githubusercontent.com.`);
};

/** What a pending step will do, for --dry-run. */
const PLAN = {
  check: () => ["clean tree, gh auth, version, Unreleased, key files"],
  prepare: (ctx) => [
    `git switch --no-track -c ${ctx.branch} origin/dev (or switch to it)`,
    "pnpm install --frozen-lockfile --ignore-scripts; fetch-libs --source <aprscaching>; build --check",
  ],
  sign: () => ["sign-all with the author and authority key files, then verify --strict"],
  changelog: (ctx) => [`## [Unreleased] → ## [${ctx.version}] - ${ctx.today}; package.json version`],
  "pr-dev": (ctx) => [`commit -s, push ${ctx.branch}, PR into dev, watch checks, squash-merge`],
  "pr-main": () => ["PR dev → main, watch the strict checks, merge as a merge commit"],
  tag: (ctx) => [`git tag -a ${ctx.tag} origin/main, push it, watch the Release workflow`],
  handover: (ctx) => [`print: node tools/toolkey/bundle-registry.mjs ${ctx.tag} --source <tools checkout>`],
};

/** Run the release: every pending step in order, one step (`only`), or a report (dry run). Returns an exit code. */
export async function release(ctx, { only } = {}) {
  try {
    if (only && !STEPS.includes(only)) throw new StepError(`no step ${only}; the steps are ${STEPS.join(", ")}`);
    if (ctx.yes && !only) throw new StepError("--yes answers one step's questions: name it with --step");
    if (!SEMVER.test(ctx.version)) throw new StepError(`${ctx.version || "(none)"} is not a version X.Y.Z`);
    const url = ctx.git("remote", "get-url", "origin").stdout.trim();
    ctx.slug = repoSlug(url) ?? UPSTREAM;

    let s = detect(ctx);
    if (ctx.dryRun) {
      ctx.log(`dry run for ${ctx.tag}: nothing is changed`);
      ctx.log("\n== check");
      let checked = true;
      try {
        await steps.check(ctx, s);
      } catch (e) {
        if (!(e instanceof StepError)) throw e;
        checked = false;
        ctx.log(e.message);
      }
      const done = doneSteps(s);
      ctx.log("\n== steps");
      for (const name of STEPS.slice(1)) {
        const state = done.has(name) ? "done" : "todo";
        ctx.log(`${state.padEnd(5)} ${name.padEnd(9)} ${state === "todo" ? PLAN[name](ctx).join("; ") : ""}`.trimEnd());
      }
      return checked ? 0 : 1;
    }

    if (only) {
      if (only !== "check" && only !== "handover" && doneSteps(s).has(only)) {
        ctx.log(`${only}: done already`);
        return 0;
      }
      ctx.log(`\n== ${only}`);
      await steps[only](ctx, s);
      return 0;
    }

    ctx.log("\n== check");
    await steps.check(ctx, s);
    for (const name of STEPS.slice(1)) {
      s = detect(ctx, { fetch: name !== "prepare" });
      if (doneSteps(s).has(name)) {
        ctx.log(`\n== ${name}: done`);
        continue;
      }
      ctx.log(`\n== ${name}`);
      await steps[name](ctx, s);
    }
    return 0;
  } catch (e) {
    if (e instanceof Stopped) {
      ctx.log(`\n${e.message}. Nothing more was changed; rerun to continue from here.`);
      return 0;
    }
    ctx.log(`\nrelease: ${e instanceof StepError ? e.message : `unexpected error: ${e?.message ?? e}`}`);
    return 1;
  }
}

export function parseArgs(argv) {
  const o = { dryRun: false, yes: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") o.dryRun = true;
    else if (a === "--yes") o.yes = true;
    else if (a === "--step") o.step = argv[++i];
    else if (a === "--source") o.source = argv[++i];
    else if (a.startsWith("--")) o.error = `unknown option ${a}`;
    else if (!o.version) o.version = a;
    else o.error = `unexpected argument ${a}`;
  }
  if (!o.version && !o.error) o.error = "name the version";
  return o;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const o = parseArgs(process.argv.slice(2));
  if (o.error) {
    console.error(`release: ${o.error}\nusage: node scripts/release.mjs <X.Y.Z> [--dry-run] [--step <${STEPS.join("|")}> [--yes]] [--source <dir>]`);
    process.exit(2);
  }
  const ctx = createContext(o);
  process.exit(await release(ctx, { only: o.step }));
}
