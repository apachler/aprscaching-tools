// SPDX-License-Identifier: MIT
// scripts/new-tool.mjs in a temporary folder holding the catalogue index and mkdocs.yml: the files it writes, the
// catalogue row and nav entry it adds, and a source that works as the sandbox runs it.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createTool, titleOf } from "../scripts/new-tool.mjs";
import { repoRoot } from "./harness.mjs";

const dirs = [];
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

function scratch() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tools-new-tool-"));
  dirs.push(dir);
  fs.mkdirSync(path.join(dir, "docs/catalogue"), { recursive: true });
  fs.copyFileSync(path.join(repoRoot, "docs/catalogue/index.md"), path.join(dir, "docs/catalogue/index.md"));
  fs.copyFileSync(path.join(repoRoot, "mkdocs.yml"), path.join(dir, "mkdocs.yml"));
  return dir;
}

describe("new-tool.mjs", () => {
  it("writes a tool, its test and its catalogue page, listed in the index and the nav", () => {
    const dir = scratch();
    const { written } = createTool(dir, { name: "qso-timer", title: "QSO timer: A & B" });
    expect(written).toContain("tools/qso-timer/src/index.js");
    const m = JSON.parse(fs.readFileSync(path.join(dir, "tools/qso-timer/tool.json"), "utf8"));
    expect(m).toMatchObject({ name: "qso-timer", author: "OE8APR", version: "1.0.0", api: "1.0", permissions: ["command"] });
    const page = fs.readFileSync(path.join(dir, "docs/catalogue/qso-timer.md"), "utf8");
    expect(page.split("\n")[0]).toBe("# QSO timer: A & B");
    expect(page).toContain("| `command` | Registers `/qso-timer` |");
    expect(page).toContain("<!-- tool-facts -->");
    expect(page.trimEnd().split("\n").filter((l) => l.startsWith("## ")).at(-1)).toBe("## Next");
    const index = fs.readFileSync(path.join(dir, "docs/catalogue/index.md"), "utf8");
    const utilities = index.slice(index.indexOf("## Utilities"), index.indexOf("## Next"));
    expect(utilities).toContain("| [QSO timer: A & B](qso-timer.md) | Answers /qso-timer with a line of its own | `command` |");
    const nav = fs.readFileSync(path.join(dir, "mkdocs.yml"), "utf8");
    // right after the group's last page, whichever tool that is
    expect(nav).toMatch(/\n {10}- [^\n]+: catalogue\/[a-z0-9-]+\.md\n {10}- "QSO timer: A & B": catalogue\/qso-timer\.md\n/);
  });

  it("writes a source that answers its command", () => {
    const dir = scratch();
    createTool(dir, { name: "echo-it" });
    let registered;
    const src = fs.readFileSync(path.join(dir, "tools/echo-it/src/index.js"), "utf8");
    new Function("register", "ipc", "tool", src)((t) => (registered = t), undefined, {});
    expect(registered.commands["echo-it"]("hi")).toEqual(["Echo it: hi"]);
    expect(registered.commands["echo-it"]("")).toEqual(["Usage: /echo-it <text>"]);
  });

  it("refuses a bad name and a tool that exists, writing nothing", () => {
    const dir = scratch();
    expect(() => createTool(dir, { name: "Bad_Name" })).toThrow(/not a tool name/);
    createTool(dir, { name: "twice" });
    const index = fs.readFileSync(path.join(dir, "docs/catalogue/index.md"), "utf8");
    expect(() => createTool(dir, { name: "twice" })).toThrow(/exists already/);
    expect(fs.readFileSync(path.join(dir, "docs/catalogue/index.md"), "utf8")).toBe(index);
  });

  it("titles a name", () => {
    expect(titleOf("grid-bearing")).toBe("Grid bearing");
  });
});
