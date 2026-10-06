#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Build every tool that has a src/ directory: bundle tools/<name>/src/index.js, the helpers under lib/ and the MIT
// libraries from vendor/aprscaching (scripts/fetch-libs.mjs) into one self-contained tools/<name>/tool.js, the
// script the sandbox runs and the bytes the author's signature covers (entrySha256).
//
// The output targets the sandbox's Worker: one browser script, no imports, no Node APIs, run as the body of a
// function of `register`, `ipc` and `tool`. It is readable (not minified) and reproducible: the same sources, the
// same library code and the same esbuild version give the same bytes on any machine, which CI checks. The
// banner names no commit, so moving lib.lock to a ref whose libraries are unchanged leaves every tool.js as it is.
//
//   node scripts/build.mjs                # write every tools/<name>/tool.js
//   node scripts/build.mjs <name>…        # only these tools
//   node scripts/build.mjs --check        # build in memory; fail if a committed tool.js differs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const check = args.includes("--check");
const only = args.filter((a) => !a.startsWith("--"));

/** The instance carries a tool's script up to this size, so a bigger build fails here instead. */
const MAX_BYTES = 512 * 1024;

const lock = JSON.parse(fs.readFileSync(path.join(root, "lib.lock"), "utf8"));
const refFile = path.join(root, "vendor", "aprscaching", ".lib-ref");
const have = fs.existsSync(refFile) ? fs.readFileSync(refFile, "utf8").trim() : null;
if (have !== lock.ref) {
  console.error(
    have
      ? `build: vendor/ holds ${have.slice(0, 12)}, lib.lock pins ${lock.ref.slice(0, 12)}; run node scripts/fetch-libs.mjs`
      : "build: no libraries in vendor/; run node scripts/fetch-libs.mjs",
  );
  process.exit(1);
}

const toolsDir = path.join(root, "tools");
const names = fs
  .readdirSync(toolsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && fs.existsSync(path.join(toolsDir, d.name, "src", "index.js")))
  .map((d) => d.name)
  .filter((n) => !only.length || only.includes(n))
  .sort();
for (const n of only) if (!names.includes(n)) {
  console.error(`build: no tool ${n} with a src/index.js`);
  process.exit(1);
}

let failures = 0;
for (const name of names) {
  const manifest = JSON.parse(fs.readFileSync(path.join(toolsDir, name, "tool.json"), "utf8"));
  const entry = manifest.entry ?? "tool.js";
  if (!/^[\w.-]+\.m?js$/.test(entry) || entry.startsWith(".")) {
    console.error(`${name}: entry "${entry}" must be a script file name in the tool's folder, such as tool.js`);
    failures++;
    continue;
  }
  const out = path.join(toolsDir, name, entry);
  let text;
  try {
    const r = await build({
      absWorkingDir: root,
      entryPoints: [`tools/${name}/src/index.js`],
      bundle: true,
      write: false,
      format: "iife",
      platform: "browser",
      target: "es2022",
      charset: "utf8",
      legalComments: "none",
      minify: false,
      sourcemap: false,
      alias: { aprscaching: "./vendor/aprscaching" },
      metafile: true,
      banner: {
        js: [
          "// SPDX-License-Identifier: MIT",
          `// ${manifest.title} ${manifest.version}, built by scripts/build.mjs from tools/${name}/src, lib/ and the`,
          "// aprscaching libraries lib.lock pins. Edit the sources, not this file.",
        ].join("\n"),
      },
      logLevel: "silent",
    });
    text = r.outputFiles[0].text;
    // Only the tool's own source, lib/ and the pinned libraries may enter a bundle: nothing from node_modules or
    // anywhere else on the machine that builds it.
    const allowed = [`tools/${name}/src/`, "lib/", "vendor/aprscaching/"];
    const stray = Object.keys(r.metafile.inputs).filter((f) => !allowed.some((a) => f.startsWith(a)));
    if (stray.length) throw new Error(`imports from outside its sources: ${stray.join(", ")}`);
  } catch (e) {
    failures++;
    console.error(`FAIL  ${name}: ${e.message}`);
    continue;
  }
  if (/\brequire\(|\bimport\(|\bprocess\.|\bimportScripts\(/.test(text)) {
    failures++;
    console.error(`FAIL  ${name}: the bundle loads code or reaches Node APIs at run time`);
    continue;
  }
  const bytes = Buffer.byteLength(text);
  if (bytes > MAX_BYTES) {
    failures++;
    console.error(`FAIL  ${name}: ${bytes} bytes, over the ${MAX_BYTES}-byte limit`);
    continue;
  }
  if (check) {
    const committed = fs.existsSync(out) ? fs.readFileSync(out, "utf8") : null;
    if (committed !== text) {
      failures++;
      console.error(`FAIL  ${name}: tools/${name}/${entry} differs from a fresh build; run node scripts/build.mjs`);
    } else console.log(`ok    ${name}: tools/${name}/${entry} matches its sources (${bytes} bytes)`);
  } else {
    fs.writeFileSync(out, text);
    console.log(`built ${name}: tools/${name}/${entry} (${bytes} bytes)`);
  }
}
if (failures) process.exit(1);
