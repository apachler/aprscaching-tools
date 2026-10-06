---
name: release
description: Release a signed registry tag vX.Y.Z of aprscaching-tools with scripts/release.mjs, step by step. Use for "/release <version>", "release the registry", "cut v1.2.0", "tag a new tools release". Runs the doctor, drafts the CHANGELOG entry from the PRs merged since the last tag for approval, then runs the release steps one at a time. The user signs; the agent never touches the keys and never merges into main without the user's go-ahead.
---

# Release the registry

`/release <X.Y.Z>` releases tag `vX.Y.Z`: a `release/vX.Y.Z` branch signed and merged into `dev`, the `dev` → `main`
pull request, and the tag on `main` that the Release workflow publishes. `scripts/release.mjs` does the work; this
skill runs it one step at a time and keeps the user in charge of the keys and of `main`.

## Hard rules

- **Never read, `cat`, print, copy or pass the key files or their contents**, nor set `AUTHOR_KEY`, `AUTHORITY_KEY`
  or `TOOL_PRIVATE_KEY`. Do not list or open `~/Development/github/aprscaching-keys/` or `TOOL_KEYS_DIR`. The scripts
  read the keys themselves and print public keys and fingerprints only.
- **Never run the `sign` step yourself.** The user runs it (step 6).
- **Never merge into `main` without the user's go-ahead in this conversation**, asked for right before the `pr-main`
  step, after its checks are listed. Approval of an earlier step does not count.
- Ask before every step that changes GitHub (`pr-dev`, `pr-main`, `tag`). Run every command in the foreground.
- No tool attribution in commits, PR titles or PR descriptions.

`release.mjs` asks y/N before each change; without a terminal it answers no. Once the user has said yes here, pass
`--step <name> --yes` for that one step. `--yes` without `--step` is refused.

## Steps

Work in the repository root. `$V` is the version without the `v`.

1. **Doctor.** Run `node scripts/doctor.mjs --release`. Stop on any `FAIL` and tell the user how to fix it; the
   doctor names the command.
2. **Where the release stands.** Run `node scripts/release.mjs $V --dry-run`. It lists each step as `done` or `todo`;
   a rerun continues where an earlier one stopped. If everything but `handover` is done, go to step 10.
3. **Draft the CHANGELOG entry** (skip it when `changelog` is done):

    ```bash
    last=$(git describe --tags --abbrev=0 origin/main)
    since=$(git log -1 --format=%cI "$last")
    gh pr list -R apachler/aprscaching-tools --state merged --base dev \
      --search "merged:>$since" --json number,title,body,mergedAt --limit 100
    ```

    Leave out `chore(release)` PRs. Read the PR bodies and the diff (`git diff "$last"..origin/dev --stat`) for tool
    versions that changed. Write the entry the way `CHANGELOG.md` writes the earlier ones: present tense, what a
    player or tool author gets, bold lead-ins grouping new tools, tool API, registry format, scripts and CI, a line per
    tool version bump, no PR numbers or history. Keep anything already under `## [Unreleased]` on `origin/dev`.
    **Show the draft and wait for the user's approval or edits.**
4. **Prepare.** With the user's go-ahead to start, run `node scripts/release.mjs $V --step prepare --yes`. It creates
   `release/v$V` from `origin/dev`, installs, fetches the libraries and runs `build --check`.
5. **Write the approved entry** under `## [Unreleased]` in `CHANGELOG.md` on `release/v$V`, then run
   `node scripts/release.mjs $V --step check`. Fix whatever it reports before going on.
6. **Sign: the user runs it.** Ask the user to type, in this session:

    ```text
    ! node scripts/release.mjs $V --step sign --yes
    ```

    Then confirm the result yourself with `node scripts/verify.mjs --strict` (it must end in `0 failure(s)`) and show
    `git diff --stat`. If verify fails, do not continue: show the failing lines and ask the user to run the sign step
    again once the cause is fixed.
7. **Date the CHANGELOG.** `node scripts/release.mjs $V --step changelog --yes` dates the section and sets
   `package.json`'s version. Show the CHANGELOG diff.
8. **PR into dev.** Ask, then run `node scripts/release.mjs $V --step pr-dev --yes` with a 10-minute timeout. It
   commits with a sign-off, pushes, opens the PR, watches the checks and squash-merges. If the watch outlasts the
   timeout or a check fails, show `gh pr checks <n> -R apachler/aprscaching-tools` and rerun the step once it is fixed:
   it continues with the open PR.
9. **PR into main.** The `pr-main` step opens the PR and merges it in one run, so open and watch it first:

    ```bash
    gh pr list -R apachler/aprscaching-tools --head dev --base main --state open
    # none open: ask, then
    gh pr create -R apachler/aprscaching-tools --base main --head dev --title "chore(release): v$V" --body "Release v$V."
    gh pr checks <n> -R apachler/aprscaching-tools --watch --interval 15
    ```

    Report the PR and its strict checks, then **ask the user explicitly whether to merge into `main`**. Only on a clear
    yes in this conversation run `node scripts/release.mjs $V --step pr-main --yes`; it finds the open PR, confirms its
    checks and merges it as a merge commit.
10. **Tag.** Ask, then run `node scripts/release.mjs $V --step tag --yes`. It tags `origin/main`, pushes the tag and
    watches the Release workflow; report the release URL.
11. **Hand over.** Run `node scripts/release.mjs $V --step handover` and give the user its commands: in the
    aprscaching repository, `/bundle-tools v$V` takes the tag into the app.

## When something goes wrong

- A step that stops or fails changes nothing more; rerun it with `--step <name>` once the cause is fixed.
- A tag never moves. A fault found after tagging is a new patch release.
- The manual steps, for when the script cannot run, are in `docs/project/maintain.md` under "Release by hand".
