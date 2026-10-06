#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Start a new tool with everything the review and the documentation build check:
//
//   node scripts/new-tool.mjs <name> [--title "<Title>"] [--author <CALL>] [--description "<one line>"]
//
// writes tools/<name>/src/index.js (a working /<name> command), tools/<name>/tool.json (version 1.0.0, tool API 1.0,
// the `command` permission alone), tools/<name>/README.md, test/<name>.test.mjs and the catalogue page
// docs/catalogue/<name>.md, and adds the page to the catalogue index's Utilities table and to mkdocs.yml's nav.
// Then it builds tools/<name>/tool.js when vendor/ holds the libraries (scripts/fetch-libs.mjs).
//
// The tool is unsigned and has no registry entry: the author signs it, and the maintainer lists it at review. It
// passes build --check, pnpm test, verify and mkdocs build --strict as it is.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { repoRoot } from "./release-kit.mjs";

const NAME = /^[a-z0-9][a-z0-9-]{1,39}$/;

export const titleOf = (name) =>
  name
    .split("-")
    .filter(Boolean)
    .map((w, i) => (i === 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");

export function files({ name, title, author, description }) {
  const manifest = {
    name,
    title,
    author,
    version: "1.0.0",
    api: "1.0",
    permissions: ["command"],
    surfaces: ["web", "terminal"],
    description,
    entry: "tool.js",
  };
  return {
    [`tools/${name}/tool.json`]: JSON.stringify(manifest, null, 2) + "\n",
    [`tools/${name}/src/index.js`]: `// SPDX-License-Identifier: MIT
/* global register */
// ${title}: /${name} [text] answers with a line of its own. The sandbox runs the built tool.js as the body of a
// function of \`register\`, \`ipc\` and \`tool\`; the sandbox API page of the documentation lists every call.

register({
  commands: {
    // a command returns the lines it answers with
    "${name}": (args) => {
      const text = args.trim();
      return [text ? ${JSON.stringify(`${title}: `)} + text : "Usage: /${name} <text>"];
    },
  },
});
`,
    [`tools/${name}/README.md`]: `# ${title}

${description}

## Use it

- \`/${name} <text>\`: answers with the text.

It shows on: web, terminal. Its commands are the operator's alone.

## Permissions

| Permission | Why |
|---|---|
| \`command\` | Registers \`/${name}\` |

## Source

\`src/index.js\` is the source. \`tool.js\` is built from it, from \`lib/\` and from the MIT libraries of the APRScaching
repository at the commit \`lib.lock\` pins (\`node scripts/build.mjs\`); CI checks that the committed \`tool.js\` matches a
fresh build.

## Signature

Unsigned until its author signs \`tool.json\`; the registry lists it once the maintainer adds its entry.

## Licence

MIT, as the \`SPDX-License-Identifier\` line in each file states.
`,
    [`test/${name}.test.mjs`]: `// SPDX-License-Identifier: MIT
// ${title}: its command, run the way the sandbox runs it.
import { describe, expect, it } from "vitest";
import { loadTool } from "./harness.mjs";

describe("${name}", () => {
  it("answers /${name} with its text, and says how to use it without", async () => {
    const t = loadTool("${name}");
    expect(t.commands()).toEqual(["${name}"]);
    expect(await t.run("${name}", "hello")).toEqual([${JSON.stringify(`${title}: hello`)}]);
    expect(await t.run("${name}", "")).toEqual(["Usage: /${name} <text>"]);
  });

  it("keeps its command for the operator", async () => {
    expect(await loadTool("${name}").run("${name}", "hello", { remote: true })).toBeNull();
  });
});
`,
    [`docs/catalogue/${name}.md`]: `# ${title}

${description}

## What it does

\`/${name} <text>\` answers with the text, in the panel or terminal that ran it.

## Use it

| Command | Answer |
|---|---|
| \`/${name} hello\` | \`${title}: hello\` |

## Permissions

| Permission | Why |
|---|---|
| \`command\` | Registers \`/${name}\` |

## Version and tool API

<!-- tool-facts -->

## Next

- [Tool catalogue](index.md): the other utilities.
- [Write your first tool](../write/first-tool.md): how a tool like this one works.
`,
  };
}

/** The catalogue index with a row for the tool at the end of the Utilities table. */
export function withIndexRow(index, { name, title, description }) {
  const lines = index.split("\n");
  const start = lines.findIndex((l) => l.trim() === "## Utilities");
  if (start < 0) throw new Error("docs/catalogue/index.md has no ## Utilities section");
  let last = -1;
  for (let i = start + 1; i < lines.length && !lines[i].startsWith("## "); i++) if (lines[i].startsWith("|")) last = i;
  if (last < 0) throw new Error("the Utilities section of docs/catalogue/index.md has no table");
  const what = description.replace(/\|/g, "\\|").replace(/\.$/, "");
  const label = title.replace(/[\\[\]|]/g, "\\$&");
  lines.splice(last + 1, 0, `| [${label}](${name}.md) | ${what} | \`command\` |`);
  return lines.join("\n");
}

/** mkdocs.yml with the page at the end of the catalogue's Utilities group. */
export function withNavEntry(mkdocs, { name, title }) {
  const lines = mkdocs.split("\n");
  const start = lines.findIndex((l) => /^\s+- Utilities:\s*$/.test(l));
  if (start < 0) throw new Error("mkdocs.yml has no Utilities group in its nav");
  const indent = lines[start].match(/^\s*/)[0].length;
  let last = start;
  for (let i = start + 1; i < lines.length; i++) {
    const own = lines[i].match(/^\s*/)[0].length;
    if (!lines[i].trim() || own <= indent) break;
    last = i;
  }
  const label = /[:#&*!|>'"%@`{}[\],?]/.test(title) ? JSON.stringify(title) : title;
  lines.splice(last + 1, 0, `${" ".repeat(indent + 4)}- ${label}: catalogue/${name}.md`);
  return lines.join("\n");
}

export function createTool(root, o) {
  if (!NAME.test(o.name))
    throw new Error(`"${o.name}" is not a tool name: lower case, 2 to 40 characters of a-z, 0-9 and -`);
  // a title is one line: no control characters, which is what this pattern looks for
  // eslint-disable-next-line no-control-regex
  if (o.title !== undefined && !/^[^\x00-\x1f\x7f]{1,60}$/.test(o.title))
    throw new Error("the title is one line of 1 to 60 characters");
  const toolsDir = path.join(root, "tools");
  const taken = fs.existsSync(toolsDir)
    ? fs.readdirSync(toolsDir).flatMap((d) => {
        try {
          return [JSON.parse(fs.readFileSync(path.join(toolsDir, d, "tool.json"), "utf8")).name];
        } catch {
          return [];
        }
      })
    : [];
  if (taken.includes(o.name)) throw new Error(`a tool named "${o.name}" exists already; nothing was written`);
  const spec = {
    name: o.name,
    title: o.title ?? titleOf(o.name),
    author: o.author ?? "OE8APR",
    description: o.description ?? `Answers /${o.name} with a line of its own.`,
  };
  const out = files(spec);
  for (const rel of Object.keys(out))
    if (fs.existsSync(path.join(root, rel))) throw new Error(`${rel} exists already; nothing was written`);
  const indexPath = path.join(root, "docs/catalogue/index.md");
  const mkdocsPath = path.join(root, "mkdocs.yml");
  const index = withIndexRow(fs.readFileSync(indexPath, "utf8"), spec);
  const mkdocs = withNavEntry(fs.readFileSync(mkdocsPath, "utf8"), spec);
  for (const [rel, text] of Object.entries(out)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  }
  fs.writeFileSync(indexPath, index);
  fs.writeFileSync(mkdocsPath, mkdocs);
  return { spec, written: [...Object.keys(out), "docs/catalogue/index.md", "mkdocs.yml"] };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const argv = process.argv.slice(2);
  const opt = (k) => {
    const i = argv.indexOf(`--${k}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const name = argv.find((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));
  if (!name) {
    console.error(
      'usage: node scripts/new-tool.mjs <name> [--title "<Title>"] [--author <CALL>] [--description "<line>"]',
    );
    process.exit(2);
  }
  let r;
  try {
    r = createTool(repoRoot, { name, title: opt("title"), author: opt("author"), description: opt("description") });
  } catch (e) {
    console.error(`new-tool: ${e.message}`);
    process.exit(1);
  }
  for (const f of r.written) console.log(`wrote ${f}`);
  if (fs.existsSync(path.join(repoRoot, "vendor/aprscaching/.lib-ref"))) {
    const b = spawnSync(process.execPath, ["scripts/build.mjs", name], { cwd: repoRoot, stdio: "inherit" });
    if (b.status !== 0) process.exit(1);
  } else console.log(`\nvendor/ is empty: run node scripts/fetch-libs.mjs, then node scripts/build.mjs ${name}`);
  console.log(`
Next:
  1. write the tool in tools/${name}/src/index.js, rebuild (node scripts/build.mjs ${name}), extend test/${name}.test.mjs
  2. add every permission it uses to tool.json and to the Permissions tables of its README and catalogue page
  3. move its catalogue row and nav entry to the group that fits (docs/catalogue/index.md, mkdocs.yml)
  4. pnpm test && node scripts/build.mjs --check && node scripts/verify.mjs`);
}
