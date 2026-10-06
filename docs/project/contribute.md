# Contribute a tool

This page shows you how to propose a tool for the project registry, which every APRScaching instance bundles. It is
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

2. Check that your computer has what the build and the tests need:

    ```bash
    node scripts/doctor.mjs
    ```

    It prints a `pass`, `warn` or `FAIL` line for Node, pnpm through corepack, `gh`, the remote and its branches, the
    libraries in `vendor/` and the lockfile. The key-file lines are for the maintainer; a warning there is fine.

3. Start the tool:

    ```bash
    node scripts/new-tool.mjs cw-trainer --title "CW trainer" --description "Sends practice groups at your speed."
    ```

    `new-tool.mjs` writes everything the review and the documentation build check, as a working `/cw-trainer`
    command that asks only for `command`:

    - `tools/<name>/tool.json`, with `"entry": "tool.js"`, `"api": "1.0"`, version `1.0.0` and the MIT licence
      ([The manifest](../write/manifest.md));
    - `tools/<name>/src/index.js`, the source, and the built `tool.js`
      ([Build with the shared libraries](../write/build.md));
    - `tools/<name>/README.md`, with a **Permissions** table and a **Licence** section;
    - `test/<name>.test.mjs`, a test of the command;
    - `docs/catalogue/<name>.md`, the catalogue page, with a row in the catalogue index's Utilities table and an entry
      in `mkdocs.yml`.

    The new tool builds and passes `pnpm test`, `verify.mjs` and `mkdocs build --strict` as it is. Make it do its
    job: edit `src/index.js` and rebuild with `node scripts/build.mjs <name>`; add each permission it uses to
    `tool.json` and to both **Permissions** tables, with why it needs it; give a tool with `tx` or `beacon` a
    **What it transmits** section; extend the test; move the catalogue row and the nav entry to the group that fits.
    `--author <callsign>` sets the author, which is OE8APR by default. In Claude Code, `/new-tool <name>` takes you
    through these steps to the pull request (`.claude/skills/new-tool/SKILL.md`).

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
    is: the maintainer adds the entry. Until then `pnpm test` prints a warning that your tool has no registry entry,
    and passes.

6. Add a line under `## [Unreleased]` in `CHANGELOG.md` that says what your change gives a player or a tool author,
   such as `- **New tool.** CW trainer: …` or `- Grid & bearing 1.0.1: bearing in mils.`. The release dates that
   section as it is.

7. Commit with a sign-off and a Conventional Commit message, push, and open a pull request into `dev`:

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
reaches instances when an APRScaching release bundles that tag, or when a sysop adds the tag by address.

A new version is a new pull request with the signed `tool.json` and script. A new author key needs the same proof as
the first.

## Check that it worked

The pull request's checks are green, with a warning that your tool has no registry entry yet, and its description
names your key and how to confirm it.

## Next

- [Maintain the registry](maintain.md): what happens to your tool after the merge.
- [Tool catalogue](../catalogue/index.md): the tools already listed.
