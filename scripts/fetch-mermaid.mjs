#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Fetch Mermaid's browser build for the documentation site into docs/assets/vendor/, which git ignores. The site
// draws its diagrams with this copy, so a reader's browser fetches nothing from a CDN. The version is the one the
// aprscaching web app locks, and the tarball must match the npm registry's SHA-512 integrity pinned here.
//
//   node scripts/fetch-mermaid.mjs
//
// Exits 1 on any failure and leaves no partial file behind.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const VERSION = "12.0.0";
const INTEGRITY = "sha512-/wQXC9iBxoGV8p3erbvaXs9h77VyLDBH6GdayVjj3hEcSQhFU4N1WUhUppotCEqlIxI2pRMwjwBSwTB1MfZBgQ==";
const WANT = {
  "package/dist/mermaid.min.js": "mermaid.min.js",
  "package/LICENSE": "mermaid.LICENSE.txt",
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "docs", "assets", "vendor");

function fail(msg) {
  console.error(`fetch-mermaid: ${msg}`);
  process.exit(1);
}

const url = `https://registry.npmjs.org/mermaid/-/mermaid-${VERSION}.tgz`;
const res = await fetch(url);
if (!res.ok) fail(`${url} answered ${res.status}`);
const tgz = Buffer.from(await res.arrayBuffer());
const got = "sha512-" + crypto.createHash("sha512").update(tgz).digest("base64");
if (got !== INTEGRITY) fail(`mermaid-${VERSION}.tgz does not match its pinned integrity`);

// A tar archive: 512-byte headers, each followed by its file padded to 512 bytes.
const tar = zlib.gunzipSync(tgz);
const found = {};
for (let at = 0; at + 512 <= tar.length; ) {
  const head = tar.subarray(at, at + 512);
  if (head.every((b) => b === 0)) break;
  const field = (from, len) => head.subarray(from, from + len).toString("utf8").replace(/\0.*$/s, "");
  const prefix = field(345, 155);
  const name = (prefix ? prefix + "/" : "") + field(0, 100);
  const size = parseInt(field(124, 12).trim() || "0", 8);
  const type = field(156, 1);
  if ((type === "0" || type === "") && WANT[name]) found[name] = tar.subarray(at + 512, at + 512 + size);
  at += 512 + Math.ceil(size / 512) * 512;
}
for (const name of Object.keys(WANT)) if (!found[name]) fail(`mermaid-${VERSION}.tgz has no ${name}`);

fs.mkdirSync(outDir, { recursive: true });
for (const [name, file] of Object.entries(WANT)) {
  const tmp = path.join(outDir, `.${file}.tmp`);
  fs.writeFileSync(tmp, found[name]);
  fs.renameSync(tmp, path.join(outDir, file));
}
console.log(`fetch-mermaid: Mermaid ${VERSION} in docs/assets/vendor/`);
