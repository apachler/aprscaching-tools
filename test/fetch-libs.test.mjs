// SPDX-License-Identifier: MIT
// scripts/fetch-libs.mjs against a local stand-in for APRScaching: git's url.<base>.insteadOf sends the repository
// the script names to a temporary repository, so the script runs unchanged and offline. The stand-in serves any
// commit by hash, as GitHub serves a fork's commits through the parent's URL; only a commit on the branch is fetched.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { repoRoot } from "./harness.mjs";

const scriptText = fs.readFileSync(path.join(repoRoot, "scripts/fetch-libs.mjs"), "utf8");
const REPOSITORY = scriptText.match(/^const REPOSITORY = "([^"]+)";$/m)?.[1];
const BRANCH = scriptText.match(/^const BRANCH = "([^"]+)";$/m)?.[1];

let tmp, upstream, onBranch, offBranch;
const git = (cwd, ...args) =>
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "-C", cwd, ...args], { encoding: "utf8" }).trim();
const MIT = "// SPDX-License-Identifier: MIT\n";

beforeAll(() => {
  expect(REPOSITORY).toBe("https://github.com/apachler/aprscaching.git");
  expect(BRANCH).toBeTruthy();
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tools-fetch-libs-"));
  upstream = path.join(tmp, "upstream");
  git(tmp, "init", "-q", "-b", BRANCH, upstream);
  git(upstream, "config", "uploadpack.allowFilter", "true");
  git(upstream, "config", "uploadpack.allowAnySHA1InWant", "true");
  fs.mkdirSync(path.join(upstream, "packages/lib"), { recursive: true });
  fs.writeFileSync(path.join(upstream, "packages/lib/a.ts"), `${MIT}export const a = 1;\n`);
  git(upstream, "add", ".");
  git(upstream, "commit", "-qm", "on the branch");
  onBranch = git(upstream, "rev-parse", "HEAD");
  git(upstream, "checkout", "-qb", "side");
  fs.writeFileSync(path.join(upstream, "packages/lib/a.ts"), `${MIT}export const a = "not reviewed";\n`);
  git(upstream, "commit", "-qam", "off the branch");
  offBranch = git(upstream, "rev-parse", "HEAD");
  git(upstream, "checkout", "-q", BRANCH);
});
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

/** A repository holding fetch-libs.mjs and the given lib.lock; runs the script and reports what it did. */
function fetchLibs(lock, ...args) {
  const dir = fs.mkdtempSync(path.join(tmp, "repo-"));
  fs.mkdirSync(path.join(dir, "scripts"));
  fs.copyFileSync(path.join(repoRoot, "scripts/fetch-libs.mjs"), path.join(dir, "scripts/fetch-libs.mjs"));
  fs.writeFileSync(path.join(dir, "lib.lock"), JSON.stringify(lock));
  const r = spawnSync(process.execPath, ["scripts/fetch-libs.mjs", ...args], {
    cwd: dir,
    encoding: "utf8",
    env: {
      ...process.env,
      APRSCACHING_SOURCE: "",
      GIT_CONFIG_COUNT: "1",
      GIT_CONFIG_KEY_0: `url.file://${upstream}.insteadOf`,
      GIT_CONFIG_VALUE_0: REPOSITORY,
    },
  });
  const file = path.join(dir, "vendor/aprscaching/packages/lib/a.ts");
  return { ...r, lib: fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null };
}

/** A local clone as a maintainer has it: origin is `url`, origin/<BRANCH> as fetched, `extra` fetched besides. */
function clone(url, extra) {
  const dir = fs.mkdtempSync(path.join(tmp, "clone-"));
  git(dir, "init", "-q");
  git(dir, "remote", "add", "origin", url);
  git(dir, "fetch", "-q", upstream, `+refs/heads/${BRANCH}:refs/remotes/origin/${BRANCH}`);
  if (extra) git(dir, "fetch", "-q", upstream, extra);
  return dir;
}

const paths = ["packages/lib"];

describe("fetch-libs.mjs", () => {
  it("fetches the pinned commit on the branch", () => {
    const r = fetchLibs({ ref: onBranch, paths });
    expect(r.stderr).toBe("");
    expect(r.status).toBe(0);
    expect(r.stdout).toContain(`from ${REPOSITORY} at ${onBranch.slice(0, 12)}`);
    expect(r.lib).toContain("export const a = 1;");
  });

  it("refuses a commit the repository serves that is not on the branch", () => {
    const r = fetchLibs({ ref: offBranch, paths });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain(`${offBranch} is not a commit on ${BRANCH} of ${REPOSITORY}`);
    expect(r.lib).toBeNull();
  });

  it("refuses a repository key in lib.lock by name", () => {
    const r = fetchLibs({ repository: REPOSITORY, ref: onBranch, paths });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/lib\.lock: "repository" is not read/);
    expect(r.lib).toBeNull();
  });

  it("--source takes the pinned commit from a clone's origin branch", () => {
    const r = fetchLibs({ ref: onBranch, paths }, "--source", clone("git@github.com:apachler/aprscaching.git"));
    expect(r.stderr).toBe("");
    expect(r.status).toBe(0);
    expect(r.lib).toContain("export const a = 1;");
  });

  it("--source refuses a commit the clone holds that is not on its origin branch", () => {
    const r = fetchLibs({ ref: offBranch, paths }, "--source", clone(REPOSITORY, "side"));
    expect(r.status).toBe(1);
    expect(r.stderr).toContain(`${offBranch} is not a commit on ${BRANCH} of ${REPOSITORY}`);
    expect(r.lib).toBeNull();
  });

  it("--source refuses a clone of another repository", () => {
    const r = fetchLibs({ ref: onBranch, paths }, "--source", clone("https://github.com/someone/aprscaching.git"));
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("the clone's origin is https://github.com/someone/aprscaching.git");
    expect(r.lib).toBeNull();
  });
});
