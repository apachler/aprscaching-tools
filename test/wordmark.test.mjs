// SPDX-License-Identifier: MIT
// The wordmark is APRScaching. In prose every Markdown file writes it that way; the lowercase name appears only where
// it is an identifier: a repository, a path, a URL, a package, a code span or a code block. Vale checks docs/ with the
// same rule (.vale/styles/APRScaching/Terms.yml); this test covers the rest of the repository as well.
import fs from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";
import { repoRoot } from "./harness.mjs";

const SKIP = new Set([".git", "node_modules", "vendor", "site"]);
const WRONG = /(?<![\w/.@-])(?:aprscaching|Aprscaching|APRSCaching|APRS[ -][Cc]aching|aprs[ -]caching)(?![\w/.-])/g;

function markdownFiles(dir = repoRoot) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return SKIP.has(d.name) ? [] : markdownFiles(p);
    return d.name.endsWith(".md") ? [p] : [];
  });
}

/** The prose of a Markdown file: code blocks, code spans, link targets and bare URLs blanked, line numbers kept. */
function prose(md) {
  return md
    .replace(/^ *(```|~~~)[\s\S]*?^ *\1/gm, (block) => block.replace(/[^\n]/g, " "))
    .replace(/`[^`\n]*`/g, " ")
    .replace(/\]\([^)\s]*\)/g, "] ")
    .replace(/<?https?:\/\/[^\s)>]+>?/g, " ");
}

it("writes the wordmark as APRScaching in prose", () => {
  const found = markdownFiles().flatMap((file) =>
    prose(fs.readFileSync(file, "utf8"))
      .split("\n")
      .flatMap((line, i) => [...line.matchAll(WRONG)].map((m) => `${path.relative(repoRoot, file)}:${i + 1}: ${m[0]}`)),
  );
  expect(found).toEqual([]);
});

it("finds the variants and leaves identifiers alone", () => {
  const hits = (s) => [...prose(s).matchAll(WRONG)].map((m) => m[0]);
  expect(hits("the aprscaching app, Aprscaching, APRS caching, aprs caching, APRS-caching")).toHaveLength(5);
  expect(hits("APRScaching, `aprscaching`, apachler/aprscaching, aprscaching-tools, vendor/aprscaching/")).toEqual([]);
  expect(hits("aprscaching.net, @aprscaching/aprs, [manual](https://apachler.github.io/aprscaching/)")).toEqual([]);
  expect(hits("```bash\ncd aprscaching\n```")).toEqual([]);
});
