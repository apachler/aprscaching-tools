// SPDX-License-Identifier: MIT
// What the review checks, for every tool in the repository: a manifest the APRScaching app accepts, a registry entry
// that agrees with it, a README that explains each permission and declares the licence, and an MIT script.
//
// The maintainer adds a tool's registry entry when it is reviewed, so on dev a tool folder without one is a warning.
// STRICT=1, which CI sets on main, on pull requests into it and on release tags, makes it a failure: main holds only
// listed, signed tools.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readManifest, repoRoot, toolNames } from "./harness.mjs";

const CAPABILITIES = [
  "command",
  "monitor",
  "event",
  "decoder",
  "panel",
  "map",
  "ipc",
  "beacon",
  "network",
  "tx",
  "geo",
];
const SURFACES = ["web", "terminal", "bbs", "node", "map"];
const registry = JSON.parse(fs.readFileSync(path.join(repoRoot, "registry.json"), "utf8"));
const read = (...p) => fs.readFileSync(path.join(repoRoot, ...p), "utf8");
const strict = process.env.STRICT === "1";
const local = (e) => !/^[a-z][a-z0-9+.-]*:/i.test(e.entry);

/**
 * On dev, an unlisted tool is reported and the test passes: as an annotation under GitHub Actions, else on stderr.
 * Written to the file descriptor itself, since the test runner holds back console output of passing tests.
 */
function unlisted(name) {
  const msg = `tools/${name} has no registry entry yet; the maintainer adds it when the tool is reviewed`;
  if (process.env.GITHUB_ACTIONS) fs.writeSync(1, `::warning file=tools/${name}/tool.json::${msg}\n`);
  else fs.writeSync(2, `warn  ${msg}\n`);
}

describe.each(toolNames())("%s", (name) => {
  const m = readManifest(name);
  const built = fs.existsSync(path.join(repoRoot, "tools", name, "src", "index.js"));

  it("has a manifest the app accepts", () => {
    if (built) expect(m.name).toBe(name); // a tool built here lives in a directory of its name
    expect(m.name).toMatch(/^[a-z0-9][a-z0-9-]{1,39}$/);
    for (const k of ["title", "author", "version", "description"])
      expect(typeof m[k] === "string" && m[k].trim()).toBeTruthy();
    expect(m.entry).toBe("tool.js");
    expect(m.api).toBe("1.0"); // the tool API version it needs; part of the signed manifest
    expect(m.permissions.every((p) => CAPABILITIES.includes(p))).toBe(true);
    expect(new Set(m.permissions).size).toBe(m.permissions.length);
    expect(m.surfaces.every((s) => SURFACES.includes(s))).toBe(true);
    if (m.permissions.includes("network")) expect(m.connect?.length).toBeGreaterThan(0);
  });

  it("is listed in the registry with the manifest's name, title, author, version and description", () => {
    const e = registry.entries.find((x) => x.entry === `tools/${name}/tool.json`);
    if (!e && !strict) return unlisted(name);
    expect(e, `tools/${name} has no registry entry (STRICT=1)`).toBeDefined();
    expect(e.name).toBe(m.name);
    expect({ title: e.title, author: e.author, version: e.version, description: e.description }).toEqual({
      title: m.title,
      author: m.author,
      version: m.version,
      description: m.description,
    });
    if (m.pubkey) expect(e.pubkey).toBe(m.pubkey);
  });

  it("explains every permission and declares the MIT licence", () => {
    const readme = read("tools", name, "README.md");
    for (const p of m.permissions) expect(readme).toContain(`| \`${p}\` |`);
    expect(readme).toMatch(/## Licence\s+MIT/);
    expect(read("tools", name, "tool.js").split("\n")[0]).toBe("// SPDX-License-Identifier: MIT");
    if (built) expect(read("tools", name, "src", "index.js").split("\n")[0]).toBe("// SPDX-License-Identifier: MIT");
  });

  if (built)
    it("is built from its sources and the libraries lib.lock pins", () => {
      expect(read("tools", name, "tool.js")).toContain("aprscaching libraries lib.lock pins");
    });
});

it("names registry format 1", () => {
  expect(registry.format).toBe(1);
});

it("lists each tool once, and only tools the repository holds", () => {
  const names = registry.entries.map((e) => e.name);
  expect(new Set(names).size).toBe(names.length);
  const listed = registry.entries
    .filter(local)
    .map((e) => e.entry)
    .sort();
  const folders = toolNames().map((n) => `tools/${n}/tool.json`);
  expect(listed.filter((e) => !folders.includes(e))).toEqual([]);
  if (strict) expect(listed).toEqual(folders);
});
