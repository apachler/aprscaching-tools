---
name: release
description: Release a signed registry tag vX.Y.Z of aprscaching-tools with scripts/release.mjs, step by step. Use for "/release <version>", "release the registry", "cut v1.2.0", "tag a new tools release", "hotfix v1.2.1". Runs the doctor, checks the CHANGELOG's Unreleased entry against the PRs merged since the last tag for approval, then runs the release steps one at a time. The user signs; the agent never touches the keys and never merges into main without the user's go-ahead.
---

# Release the registry

`/release <X.Y.Z>` releases tag `vX.Y.Z`: a `release/vX.Y.Z` branch from `dev`, signed and merged into `main` by pull
request, the tag on `main` that the Release workflow publishes, and `dev` brought up to `main`. `scripts/release.mjs`
does the work; this skill runs it one step at a time and keeps the user in charge of the keys and of `main`.

## Hard rules

- **Never read, `cat`, print, copy or pass the key files or their contents**, nor set `AUTHOR_KEY`, `AUTHORITY_KEY`
  or `TOOL_PRIVATE_KEY`. Do not list or open the key folder (`TOOL_KEYS_DIR`, by default
  `~/.config/aprscaching-tools/keys/`). The scripts read the keys themselves and print public keys and fingerprints
  only.
- **Never run the `sign` step yourself.** The user runs it (step 6).
- **Never merge into `main` without the user's go-ahead in this conversation** for this version: asked for right
  before the merge after the PR's checks are listed, or given up front as the one go-ahead below. Approval of an
  earlier step does not count.
- Ask before every step that changes GitHub (`pr-main`, `tag`, `sync-dev`), unless the one go-ahead covers it. Run
  every command in the foreground.
- No tool attribution in commits, PR titles or PR descriptions.

`release.mjs` asks y/N before each change; without a terminal it answers no. Once the user has said yes here, pass
`--step <name> --yes` for that one step. `--yes` without `--step` is refused.

## One go-ahead

When the user approves the CHANGELOG entry and says to run the release through (such as "release it if everything
is ok"), that one yes covers `pr-main`, `tag` and `sync-dev` for this version, as long as all of these hold:

- after `prepare`, the dry run shows `sign` as `done`: nothing needs signing;
- every check of the PR into `main` passes, including `verify --strict`;
- every step ends without an error, and nothing else turns up that the user has not seen.

The moment one does not hold, stop, report what happened and ask before going on. A release that needs signing
always stops for step 6; the go-ahead then needs asking for again. Report each step's result as it finishes.

## Steps

Work in the repository root. `$V` is the version without the `v`. For a hotfix, add `--from v<the tag it fixes>` to
every `release.mjs` command: the release branch starts from that tag instead of `dev`, and step 3 is written on the
release branch after step 4.

1. **Doctor.** Run `node scripts/doctor.mjs --release`. Stop on any `FAIL` and tell the user how to fix it; the
   doctor names the command.
2. **Where the release stands.** Run `node scripts/release.mjs $V --dry-run`. It lists each step as `done` or `todo`;
   a rerun continues where an earlier one stopped. If everything but `handover` is done, go to step 11.
3. **Check the CHANGELOG entry** (skip it when `changelog` is done). Each PR adds its own line under
   `## [Unreleased]`, so that section on `origin/dev` is the draft. Compare it with the PRs merged since the last tag:

    ```bash
    last=$(git describe --tags --abbrev=0 origin/main)
    since=$(git log -1 --format=%cI "$last")
    gh pr list -R apachler/aprscaching-tools --state merged --base dev \
      --search "merged:>$since" --json number,title,body,mergedAt --limit 100
    ```

    Leave out `chore(release)` PRs and those that touch only CI or dependencies. For a PR the section misses, read its
    body and the diff (`git diff "$last"..origin/dev --stat`) for tool versions that changed, and write its line the
    way `CHANGELOG.md` writes the earlier ones: present tense, what a player or tool author gets, bold lead-ins
    grouping new tools, tool API, registry format, scripts and CI, a line per tool version bump, no PR numbers or
    history. Keep everything already in the section. **Show the entry, marking the lines you added, and wait for the
    user's approval or edits.**
4. **Prepare.** With the user's go-ahead to start, run `node scripts/release.mjs $V --step prepare --yes`. It creates
   `release/v$V` from `origin/dev`, installs, fetches the libraries and runs `build --check`.
5. **Write the lines you added** under `## [Unreleased]` in `CHANGELOG.md` on `release/v$V`, then run
   `node scripts/release.mjs $V --step check`. Fix whatever it reports before going on.
6. **Sign: the user runs it**, unless the dry run shows `sign` as `done`. Ask the user to type, in this session:

    ```text
    ! node scripts/release.mjs $V --step sign --yes
    ```

    Then confirm the result yourself with `node scripts/verify.mjs --strict` (it must end in `0 failure(s)`) and show
    `git diff --stat`. If verify fails, do not continue: show the failing lines and ask the user to run the sign step
    again once the cause is fixed.
7. **Date the CHANGELOG.** `node scripts/release.mjs $V --step changelog --yes` dates the section and sets
   `package.json`'s version. Show the CHANGELOG diff.
8. **Open the PR into main.** The `pr-main` step opens the PR and merges it in one run, so open and watch it first.
   Ask (unless the one go-ahead covers it), then:

    ```bash
    git add -u && git commit -s -m "chore(release): v$V"
    git push -u origin release/v$V
    gh pr create -R apachler/aprscaching-tools --base main --head release/v$V --title "chore(release): v$V" --body "Release v$V."
    gh pr checks <n> -R apachler/aprscaching-tools --watch --interval 15
    ```

9. **Merge into main.** Report the PR and its strict checks, then **ask the user explicitly whether to merge into
   `main`**, unless the one go-ahead covers it and every check passed. Only on a clear yes in this conversation run
   `node scripts/release.mjs $V --step pr-main --yes` with a 10-minute timeout; it finds the open PR, confirms its
   checks and merges it as a merge commit. If a check fails, show `gh pr checks <n> -R apachler/aprscaching-tools`;
   fix it on the release branch, push, and run this step again.
10. **Tag.** Ask (unless the one go-ahead covers it), then run `node scripts/release.mjs $V --step tag --yes`. It
    tags `origin/main`, pushes the tag and watches the Release workflow; report the release URL.
11. **Bring dev up to main.** Ask (unless the one go-ahead covers it), then run
    `node scripts/release.mjs $V --step sync-dev --yes` with a 10-minute timeout. It fast-forwards `dev` to `main`, or,
    when `dev` has moved on, opens a PR from `main` into `dev` and merges it as a merge commit. If that PR conflicts,
    stop and show the user `docs/project/maintain.md` under "Hotfix" for how to resolve it.
12. **Hand over.** Run `node scripts/release.mjs $V --step handover` and give the user its commands: in the
    APRScaching repository, `/bundle-tools v$V` takes the tag into the app.

## When something goes wrong

- A step that stops or fails changes nothing more; rerun it with `--step <name>` once the cause is fixed.
- A tag never moves. A fault found after tagging is a new patch release.
- The manual steps, for when the script cannot run, are in `docs/project/maintain.md` under "Release by hand".
