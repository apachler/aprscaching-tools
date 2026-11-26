# Keys, rotation and release practice

This page covers keeping a registry trustworthy over time: where the keys live, how instances pin the authority key,
what to do when a key changes or leaks, and how to release. It is for registry publishers.

## The two kinds of key

| Key | Signs | Held by |
|---|---|---|
| An **author key** | A tool's `tool.json`, and through `entrySha256` its script | Each tool's author |
| The **authority key** | `registry.json`: the format and the entries | The registry's publisher |

Both are Ed25519 keys made by `scripts/genkey.mjs`. A publisher who also writes tools holds both, and keeps them
apart: a leaked author key exposes that author's tools, a leaked authority key the whole list.

## Keep the private keys offline

- Keep each key in a key file of its own on the computer that signs, readable by you alone (`chmod 600`).
  `genkey.mjs` writes it encrypted with a passphrase, so a program that reads the file gets nothing that signs.
- Type the passphrase only at the prompt of `sign.mjs` or `sign-all.mjs`, in a terminal. Neither takes a key or a
  passphrase from an argument or the environment, where every program they start could read it.
- Encrypt a key file that holds its key as a bare base64 value in place, keeping the key:
  `node scripts/genkey.mjs --convert <file>`.
- Never put a private key or its passphrase in the repository, in CI or in a log. CI only verifies; it never signs.

## How instances pin the authority key

The app never trusts the key a file names. Whoever adds a registry, a sysop for the instance or a player for
themselves, compares the fingerprint the app shows with the one you publish, and pins the key only when every digit
matches. From then on every load is checked against the pinned key.

So publish the key and its fingerprint where people look before they add the registry: the README, your website, a
post on a channel you control. The project registry does this on its [home page](../index.md#the-authority-key).

## When a key changes or leaks

| Event | What happens |
|---|---|
| An author changes their key | The author signs the manifest with the new key; the publisher updates the entry's `pubkey` and signs the registry again. Installs from the listed address show as registry-listed again. A tool a player installed under the old key stops starting, with the reason, until the player installs it again. A copy elsewhere shows **Author key CHANGED** to players who accepted the old key. |
| An author's key leaks | The publisher removes the entry, or lists the new key, and signs again. There is no revocation list: a browser that accepted the leaked key still shows **Signed · matches the key you trusted before** for a manifest it signs from an address no registry lists. |
| A tool must go | Remove its entry and sign again. The registry stops offering it; players who installed it keep it, signed by its author's key, until they remove it. |
| The authority key changes | Sign the registry with the new key and publish the new fingerprint. Every instance and player that pinned the old key sees **key changed** until they compare and confirm the new one. |
| The authority key leaks | As above, and tell everyone who pinned it: until they confirm a new key, the leaked key still signs what they see. |
| A key is lost, with no copy | As for a changed key: a new author key signs every tool again, or a new authority key signs the registry and everyone who pinned the old one confirms the new. An encrypted offline copy avoids this ([Back up the keys](../project/maintain.md#back-up-the-keys)). |

An authority key change costs every instance and player a confirmation, so change it only when it leaks.

In this repository, CI checks a release against the authority key `main` already holds, not the `authority.pub` the
release brings, and with the `verify.mjs` `main` already holds, not the one the release brings. A pull request that
swaps the key and signs again with its own fails `verify`, whatever it changes in the verifier. A real change of the
authority key fails that check too. The `main` ruleset has no bypass actor, so the maintainer adds one for that
merge and removes it after ([Merge a release that fails verify by design](../project/maintain.md#merge-a-release-that-fails-verify-by-design)).
The release after it is checked against the new key.

## Release practice

- **Tag every release** and give people the `github:owner/repo@<tag>` address. A tag never moves: a fix is a new
  tag.
- **Sign on a release branch, not on the working branch.** Let changes land unsigned on the working branch, then
  sign everything in one step for the release, so the signed state is the reviewed state.
- **Verify strictly before you tag.** `node scripts/verify.mjs --strict` fails on any missing or stale signature.
- **Keep a changelog** with a section per tag, naming the tools added, changed and removed, and any change to the
  tool API or the registry format.
- **Raise a tool's `version`** whenever its manifest or script changes, so the **Registry** list shows the change.
- **Never re-sign a tool under another author's key.** A tool signed by its author stays as its author signed it.

The project registry follows this practice; [Maintain the registry](../project/maintain.md) has its release flow.

## Next

- [Maintain the registry](../project/maintain.md): the project registry's release flow.
- [How registries work](index.md): what pinning protects.
