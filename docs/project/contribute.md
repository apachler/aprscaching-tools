# Contribute a tool

This page shows you how to propose a tool for the project registry, which every aprscaching instance bundles. It is
for tool authors with a working, tested tool. At the end your pull request is open and holds everything the review
checks.

## Before you start

- A tool that works and is tested ([Write your first tool](../write/first-tool.md), [Test a tool](../write/test.md)).
- Your own author key ([Sign a tool](../write/sign.md)), and a way for a reviewer to confirm it is yours: your
  callsign's QRZ page, or a post on a channel you control.
- A GitHub account and a fork of [apachler/aprscaching-tools](https://github.com/apachler/aprscaching-tools).

## Steps

1. Cut a branch from `dev` in your fork, named after the change's Conventional Commit type, such as
   `feat/cw-trainer`:

    ```bash
    git fetch upstream && git switch -c feat/cw-trainer upstream/dev
    ```

2. Add the folder `tools/<name>/`, where `<name>` is your manifest's `name`:
    - `tool.json`, with `"entry": "tool.js"` and `"api": "1.0"` ([The manifest](../write/manifest.md));
    - `tool.js`, the script, with an `SPDX-License-Identifier` line at the top;
    - `src/index.js` and the built `tool.js`, when you use this repository's build
      ([Build with the shared libraries](../write/build.md));
    - `README.md`: what the tool does, a **Permissions** table with a row for each permission and why it needs it,
      a **What it transmits** section for a tool with `tx` or `beacon`, and a **Licence** section that matches the
      script's SPDX line.
3. Add your tests under `test/`, and a catalogue page `docs/catalogue/<name>.md` built like the
   [others](../catalogue/index.md), with a row in the catalogue index and an entry in `mkdocs.yml`.
4. Sign the manifest with your author key. The signature covers the script through `entrySha256`; sign again after
   every change:

    ```bash
    TOOL_PRIVATE_KEY="$(cat ~/my-tool-author.key)" node scripts/sign.mjs manifest tools/<name>/tool.json
    ```

5. Run the checks:

    ```bash
    pnpm test
    node scripts/build.mjs --check
    node scripts/verify.mjs
    ```

    `verify.mjs` shows your tool as `signed by <your key>, not listed in the registry`. Leave `registry.json` as it
    is: the maintainer adds the entry. Until then the repository test `is listed in the registry` fails for your
    tool.

6. Commit with a sign-off and a Conventional Commit message, push, and open a pull request into `dev`:

    ```bash
    git commit -s -m "feat(tools): add cw-trainer"
    git push -u origin feat/cw-trainer
    ```

    State your public key in the pull request's description, and how a reviewer can confirm it is yours.

A tool you host yourself works the same way, with one difference: put its absolute `https://` address in the pull
request instead of the files. The server must send `Access-Control-Allow-Origin: *`.

## Sign off your commits

Every commit carries a Developer Certificate of Origin sign-off ([developercertificate.org](https://developercertificate.org/)).
`git commit -s` adds `Signed-off-by: Your Name <you@example.org>`, which certifies that you wrote the change or have
the right to submit it under the stated licence. The DCO check fails a pull request with a commit that lacks it;
`git rebase --signoff <base>` adds it to commits you made without.

Commit messages and the pull request's title are [Conventional Commits](https://www.conventionalcommits.org/), such
as `feat(tools): add cw-trainer`, and carry no tool attribution lines.

## What the review checks

- **The manifest validates** and its signature verifies with the key you stated, confirmed through the channel you
  named.
- **The least permissions needed.** Every permission in `permissions` is used, and the README says why.
- **A declared licence**, the same in the script's SPDX line and the README.
- **No `network` without a reason.** `connect` lists only the origins the tool reaches, and the README names each
  one and what the tool sends there.
- **No `tx` or `beacon` without a clear purpose.** A tool that transmits says what, when and how often, and never
  transmits without the operator asking.
- **Readable code that does what it says.** No obfuscated or minified code and no code loaded at run time. A built
  `tool.js` must match a fresh build of its sources; CI checks it.
- **Nothing pretends to be the app.** Panels and command output say they come from the tool.
- **The tests pass**, and cover the tool's commands and events.

The pull request is squash-merged into `dev`. Your tool is signed into the registry with the next release, and
reaches instances when an aprscaching release bundles that tag, or when a sysop adds the tag by address.

A new version is a new pull request with the signed `tool.json` and script. A new author key needs the same proof as
the first.

## Check that it worked

The pull request's checks are green apart from `is listed in the registry`, and its description names your key and
how to confirm it.

## Next

- [Maintain the registry](maintain.md): what happens to your tool after the merge.
- [Tool catalogue](../catalogue/index.md): the tools already listed.
