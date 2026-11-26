// SPDX-License-Identifier: MIT
// scripts/build.mjs --check in a temporary repository: the build banner, not the folder layout, says a tool is built,
// so a built tool whose src/ is deleted fails instead of passing as hand-written, and a hand-written tool is left alone.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { repoRoot } from "./harness.mjs";

let dir;
const w = (rel, text) => {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), text);
};
const build = (...args) => spawnSync(process.execPath, ["scripts/build.mjs", ...args], { cwd: dir, encoding: "utf8" });

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "tools-build-"));
  fs.mkdirSync(path.join(dir, "scripts"));
  fs.copyFileSync(path.join(repoRoot, "scripts/build.mjs"), path.join(dir, "scripts/build.mjs"));
  fs.symlinkSync(path.join(repoRoot, "node_modules"), path.join(dir, "node_modules"));
  const ref = "a".repeat(40);
  w("lib.lock", JSON.stringify({ ref, paths: ["x"] }));
  w("vendor/aprscaching/.lib-ref", `${ref}\n`);
  w("tools/built/tool.json", JSON.stringify({ title: "Built", version: "1.0.0" }));
  w("tools/built/src/index.js", '// SPDX-License-Identifier: MIT\ntool.log("built");\n');
  w("tools/hand/tool.json", JSON.stringify({ title: "Hand", version: "1.0.0" }));
  w("tools/hand/tool.js", '// SPDX-License-Identifier: MIT\ntool.log("hand-written");\n');
  expect(build().status).toBe(0);
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe("build.mjs --check", () => {
  it("passes a built tool that matches its sources and leaves a hand-written tool alone", () => {
    const r = build("--check");
    expect(r.stderr).toBe("");
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/ok {4}built: tools\/built\/tool\.js matches its sources/);
    expect(r.stdout).toMatch(/- {5}hand: hand-written \(no build banner\), not built/);
  });

  it("fails a tool whose script carries the build banner without src/index.js", () => {
    expect(fs.readFileSync(path.join(dir, "tools/built/tool.js"), "utf8")).toMatch(/built by scripts\/build\.mjs/);
    fs.rmSync(path.join(dir, "tools/built/src"), { recursive: true });
    const r = build("--check");
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(
      /FAIL {2}built: tools\/built\/tool\.js carries the build banner but tools\/built\/src\/index\.js is missing/,
    );
  });

  it("fails a built tool whose script differs from a fresh build", () => {
    fs.appendFileSync(path.join(dir, "tools/built/tool.js"), 'tool.log("added");\n');
    const r = build("--check");
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/FAIL {2}built: tools\/built\/tool\.js differs from a fresh build/);
  });
});
