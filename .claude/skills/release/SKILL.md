---
name: release
description: Release a signed registry tag vX.Y.Z of aprscaching-tools with scripts/release.mjs. Use for "/release", "/release <version>", "release the registry", "cut v1.2.0", "tag a new tools release", "hotfix v1.2.1". Asking for the release is the go-ahead for the whole run, signing and the merge into main included; it stops for the user only when a CHANGELOG line needs writing, a check fails, or something unexpected turns up. The agent never reads the key files.
---

# Release the registry

`/release [X.Y.Z]` releases tag `vX.Y.Z`; without a version, the commits since the newest tag choose it: a `release/vX.Y.Z` branch from `dev`, signed and merged into `main` by pull
request, the tag on `main` that the Release workflow publishes, and `dev` brought up to `main`. `scripts/release.mjs`
does the work; this skill runs it from start to end.

## The go-ahead

The user asking for the release is the go-ahead for every step: prepare, sign, date the CHANGELOG, the PR into
`main` and its merge, the tag, and bringing `dev` up to `main`. Report each step's result as it finishes, in a line or
two. **Stop and ask the user** only when one of these happens:

- the doctor or the `check` step reports a `FAIL`;
- the Unreleased section misses a merged PR, so you write a line for it: show the lines you wrote and wait for an
  approval of them (lines a PR brought were reviewed in that PR and need none);
- a check of the PR into `main` fails, or does not run `verify --strict`;
- a step ends in an error, `verify --strict` fails after signing, or `sync-dev` meets a conflict;
- anything else the user has not seen and would want to: a tool listed or removed, a tool API or registry format
  change, a step that wants to change something this skill does not name.

After an answer, go on from where you stopped.

## Hard rules

- **Never read, `cat`, print, copy or pass the key files or their contents**, nor set `AUTHOR_KEY`, `AUTHORITY_KEY`
  or `TOOL_PRIVATE_KEY`. Do not list or open the key folder (`TOOL_KEYS_DIR`, by default
  `~/.config/aprscaching-tools/keys/`). The `sign` step reads the keys itself and prints public keys and fingerprints
  only; run it, never sign any other way.
- **Merge into `main` only after its checks have passed**, shown in this conversation. Never with `--admin`, and never
  past a failing or missing check.
- Never force-push `dev` or `main`, move or delete a tag, or edit a published release.
- Run every command in the foreground. No tool attribution in commits, PR titles or PR descriptions.

`release.mjs` asks y/N before each change; without a terminal it answers no. Pass `--step <name> --yes` to run one
step; `--yes` without `--step` is refused.

## Steps

Work in the repository root. `$V` is the version without the `v`: the one the user named, else the one the dry run
in step 2 chose. For a hotfix, add `--from v<the tag it fixes>` to
every `release.mjs` command: the release branch starts from that tag instead of `dev`, and the Unreleased lines are
written on the release branch after step 4.

1. **Doctor.** `node scripts/doctor.mjs --release`. A `FAIL` stops the release: tell the user the command the doctor
   names.
2. **Where the release stands.** `node scripts/release.mjs $V --dry-run`, or without `$V` when the user named none:
   its first line is then `version X.Y.Z: <why>`. A release branch in progress keeps its version; otherwise a breaking
   change (`type!:` or a `BREAKING CHANGE:` footer) since the newest tag makes the next major, a `feat` the next
   minor, anything else the next patch. `nothing to release` ends the run. Say which version and why in your first
   report, then use it as `$V` for every later command. It lists each step as `done` or `todo`; go on from the first
   `todo`.
3. **The CHANGELOG entry** (skip it when `changelog` is done). Each PR adds its own line under `## [Unreleased]`.
   Compare that section on `origin/dev` with the PRs merged since the last tag:

    ```bash
    last=$(git describe --tags --abbrev=0 origin/main)
    since=$(git log -1 --format=%cI "$last")
    gh pr list -R apachler/aprscaching-tools --state merged --base dev \
      --search "merged:>$since" --json number,title,body,mergedAt --limit 100
    ```

    Leave out `chore(release)` PRs and those that touch only CI or dependencies. When the section covers every other
    PR, go on: you may reorder its lines (grouped lines first, then a line per tool version) and add a one-line
    summary at the top without asking. For a PR it misses, write its line the way `CHANGELOG.md` writes the earlier
    ones (present tense, what a player or tool author gets, no PR numbers or history), then show those lines and wait
    for the user's approval.
4. **Prepare.** `node scripts/release.mjs $V --step prepare --yes` creates `release/v$V`, installs, fetches the
   libraries and runs `build --check`.
5. **Write the entry** on `release/v$V`, then `node scripts/release.mjs $V --step check`.
6. **Sign**, unless the dry run shows `sign` as `done`: `node scripts/release.mjs $V --step sign --yes`. Then
   `node scripts/verify.mjs --strict` must end in `0 failure(s)`, `0 unsigned`; otherwise stop and show the failing
   lines.
7. **Date the CHANGELOG.** `node scripts/release.mjs $V --step changelog --yes`.
8. **The PR into main.** Commit, push, open it and watch its checks, so they are in front of the user before the
   merge:

    ```bash
    git add -u && git commit -s -m "chore(release): v$V"
    git push -u origin release/v$V
    gh pr create -R apachler/aprscaching-tools --base main --head release/v$V --title "chore(release): v$V" --body "Release v$V."
    gh pr checks <n> -R apachler/aprscaching-tools --watch --interval 15
    ```

9. **Merge into main.** With every check green, list them in a line, then
   `node scripts/release.mjs $V --step pr-main --yes` (10-minute timeout); it confirms the checks again and merges as
   a merge commit.
10. **Tag.** `node scripts/release.mjs $V --step tag --yes` tags `origin/main`, pushes the tag and watches the Release
    workflow. Then check the release: `gh release view v$V --json isImmutable,assets`, and
    `gh attestation verify` on the downloaded archive.
11. **Bring dev up to main.** `node scripts/release.mjs $V --step sync-dev --yes`: a fast-forward, or a PR from `main`
    into `dev` when `dev` has moved on. A conflict stops the release; show the user "Hotfix" in
    `docs/project/maintain.md`.
12. **Hand over.** `node scripts/release.mjs $V --step handover`, and give the user its commands: in the APRScaching
    repository, `/bundle-tools v$V` takes the tag into the app.

End with one short report: the release URL, what it contains, and anything the user should know.

## When something goes wrong

- A step that stops or fails changes nothing more; rerun it with `--step <name>` once the cause is fixed.
- A tag never moves. A fault found after tagging is a new patch release.
- The manual steps, for when the script cannot run, are in `docs/project/maintain.md` under "Release by hand".
