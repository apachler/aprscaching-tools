// SPDX-License-Identifier: MIT
// What the review checks, for every tool in the repository: a manifest the aprscaching app accepts, a registry entry
// that agrees with it, a README that explains each permission and declares the licence, and an MIT script.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readManifest, repoRoot, toolNames } from "./harness.mjs";

const CAPABILITIES = ["command", "monitor", "event", "decoder", "panel", "map", "ipc", "beacon", "network", "tx", "geo"];
const SURFACES = ["web", "terminal", "bbs", "node", "map"];
const registry = JSON.parse(fs.readFileSync(path.join(repoRoot, "registry.json"), "utf8"));
const read = (...p) => fs.readFileSync(path.join(repoRoot, ...p), "utf8");

describe.each(toolNames())("%s", (name) => {
  const m = readManifest(name);
  const built = fs.existsSync(path.join(repoRoot, "tools", name, "src", "index.js"));

  it("has a manifest the app accepts", () => {
    if (built) expect(m.name).toBe(name); // a tool built here lives in a directory of its name
    expect(m.name).toMatch(/^[a-z0-9][a-z0-9-]{1,39}$/);
    for (const k of ["title", "author", "version", "description"]) expect(typeof m[k] === "string" && m[k].trim()).toBeTruthy();
    expect(m.entry).toBe("tool.js");
    expect(m.permissions.every((p) => CAPABILITIES.includes(p))).toBe(true);
    expect(new Set(m.permissions).size).toBe(m.permissions.length);
    expect(m.surfaces.every((s) => SURFACES.includes(s))).toBe(true);
    if (m.permissions.includes("network")) expect(m.connect?.length).toBeGreaterThan(0);
  });

  it("is listed in the registry with the manifest's name, title, author and version", () => {
    const e = registry.entries.find((x) => x.entry === `tools/${name}/tool.json`);
    expect(e).toBeDefined();
    expect(e.name).toBe(m.name);
    expect({ title: e.title, author: e.author, version: e.version }).toEqual({
      title: m.title,
      author: m.author,
      version: m.version,
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

it("lists each tool once", () => {
  const names = registry.entries.map((e) => e.name);
  expect(new Set(names).size).toBe(names.length);
  expect(registry.entries.map((e) => e.entry).sort()).toEqual(toolNames().map((n) => `tools/${n}/tool.json`));
});
