---
name: new-tool
description: Create a new tool for the aprscaching-tools registry with scripts/new-tool.mjs, implement and test it, write its catalogue page, and open a pull request into dev. Use for "/new-tool <name>", "add a tool", "write a tool that …", "scaffold a tool". Never signs with the project keys and never merges.
---

# Create a tool

`/new-tool <name> [what it should do]` takes a tool from nothing to an open pull request into `dev`. The scaffold
from `scripts/new-tool.mjs` builds and passes every check as it is; the work is making it do its job with the fewest
permissions.

## Rules

- Branch `feat/<slug>` from `origin/dev`, named after the change, never after a tool or an assistant. Commits and the
  PR title are Conventional Commits (`feat(tools): add <name>`), signed off with `git commit -s`, with no tool
  attribution.
- **Never read, print or pass a signing key**, the project's or the author's. Signing is the author's own step.
- Leave `registry.json` alone: the maintainer adds the entry at review. On `dev` the missing entry is a warning.
- Never merge the PR.
- Follow `CLAUDE.md`: present tense, what the code is and why, no history.

## Steps

1. **Check the computer.** `node scripts/doctor.mjs`. Fix every `FAIL`; warnings about keys do not matter here.
2. **Branch.**

    ```bash
    git fetch origin && git switch -c feat/<slug> origin/dev
    corepack pnpm install --frozen-lockfile --ignore-scripts
    node scripts/fetch-libs.mjs        # or --source <a local APRScaching clone>
    ```

3. **Scaffold.**

    ```bash
    node scripts/new-tool.mjs <name> --title "<Title>" --description "<one line>" [--author <CALL>]
    ```

    It writes `tools/<name>/` (`src/index.js`, `tool.json`, `README.md`), `test/<name>.test.mjs` and
    `docs/catalogue/<name>.md`, adds a row to the catalogue index's Utilities table and the page to `mkdocs.yml`, and
    builds `tool.js`.
4. **Implement** in `tools/<name>/src/index.js`. Read `docs/write/sandbox-api.md`, `docs/write/manifest.md` and
   `docs/write/limits.md` first, and a tool in `tools/` that does something close. Import shared code from `lib/` or
   the pinned libraries (`docs/write/build.md`), nothing else. Rebuild with `node scripts/build.mjs <name>`; never
   edit `tool.js` by hand.
5. **Permissions.** Ask for only what the tool uses. Every permission in `tool.json` gets a row, saying why, in the
   **Permissions** tables of `tools/<name>/README.md` and `docs/catalogue/<name>.md`, and in the catalogue index row.
   A tool with `tx` or `beacon` needs a **What it transmits** section in both; one with `network` lists its `connect`
   origins and what it sends to each.
6. **Tests.** Extend `test/<name>.test.mjs` with the harness (`docs/write/test.md`): every command, event and decoder,
   a remote peer where `remote` is set, and fewer grants than the manifest asks for.
7. **Docs.** Fill in the catalogue page: what it does, how to use it, the permissions, ending in `## Next`. Move its
   index row and nav entry to the group that fits. Add a row to the README's tools table. Add the tool's line under
   `## [Unreleased]` in `CHANGELOG.md`, the way the released sections name new tools.
8. **Check**, all of them:

    ```bash
    corepack pnpm test
    node scripts/build.mjs --check
    node scripts/verify.mjs
    python3 -m venv /tmp/tools-docs-venv && /tmp/tools-docs-venv/bin/pip install -q -r docs/requirements.txt
    node scripts/fetch-mermaid.mjs && /tmp/tools-docs-venv/bin/mkdocs build --strict -d /tmp/tools-site
    ```

9. **Sign (optional, the author's step).** A contributor signs with their own author key; ask the user to run it
   themselves, then rerun `verify`:

    ```text
    ! TOOL_PRIVATE_KEY="$(cat <their key file>)" node scripts/sign.mjs manifest tools/<name>/tool.json
    ```

    The project's own tools are signed by the maintainer at the next release, so this step is skipped for them.
10. **Pull request.** Show the diff summary, then commit, push and open the PR into `dev`:

    ```bash
    git add tools/<name> test/<name>.test.mjs docs/catalogue mkdocs.yml README.md CHANGELOG.md
    git commit -s -m "feat(tools): add <name>"
    git push -u origin feat/<slug>
    gh pr create -R apachler/aprscaching-tools --base dev --title "feat(tools): add <name>" --body "<what it does, its permissions and why; the author key and how to confirm it, when signed>"
    ```

    Report the PR URL and its checks (`gh pr checks <n> -R apachler/aprscaching-tools --watch`). Do not merge.
