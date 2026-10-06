# Contributing a tool

This page is for tool authors who want a tool listed in the project registry for aprscaching 1.x. Build and test
the tool first with [Write your first tool](https://apachler.github.io/aprscaching/contribute/first-tool/); the
[Tool reference](https://apachler.github.io/aprscaching/contribute/tool-reference/) documents `tool.json`, the
capabilities and the sandbox.

## Open a pull request

1. Fork this repository and add a directory `tools/<name>/`, where `<name>` is your manifest's `name`:
    - `tool.json`, with `entry` relative to it (`"entry": "tool.js"`);
    - the script;
    - `README.md`: what the tool does, each permission and why it needs it, and a **Licence** section.
2. Put an `SPDX-License-Identifier` line at the top of the script, matching the README.
3. Make an author key once, on a computer you trust, and keep the private value offline:

    ```bash
    node scripts/genkey.mjs
    ```

4. Sign the manifest. The signature also covers your script: `sign.mjs` writes its SHA-256 into `entrySha256`.
   Sign again after every change to `tool.json` or to the script:

    ```bash
    TOOL_PRIVATE_KEY=<your private value> node scripts/sign.mjs manifest tools/<name>/tool.json
    ```

5. Run `node scripts/verify.mjs`. Your tool shows as `signed by <your key>, not listed in the registry`.
6. Open the pull request. State your public key in its description, and how a reviewer can confirm it is yours
   (your callsign's QRZ page, a post on a channel you control). Leave `registry.json` as it is: the maintainer
   adds the entry and signs it.

A tool you host yourself works the same way: put its absolute `https://` address in the pull request instead of
the files. The server must send `Access-Control-Allow-Origin: *`.

## What the review checks

- The manifest validates and its signature verifies with the key you stated.
- **The least permissions needed.** Every permission in `permissions` is used, and the README says why.
- **A declared licence**, the same in the script's SPDX line and the README.
- **No `network` without a reason.** `connect` lists only the origins the tool reaches, and the README names each
  one and what it sends there.
- **No `tx` without a clear purpose.** A tool that transmits says what, when and how often, and never transmits
  without the operator asking.
- The script does what the description says and nothing else: no obfuscated or minified code, no code loaded at
  run time.

A new version is a new pull request with the signed `tool.json` and script. A new author key needs the same proof
as the first.

## Sign off your commits

Every commit carries a Developer Certificate of Origin sign-off ([developercertificate.org](https://developercertificate.org/)):

```bash
git commit -s
```

It adds `Signed-off-by: Your Name <you@example.org>` and certifies that you wrote the change or have the right to
submit it under the stated licence. Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/),
for example `feat(tools): add cw-trainer`.
