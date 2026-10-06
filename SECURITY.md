# Security policy

This repository is the signed tool registry every APRScaching instance bundles. Its signatures decide which code
runs in players' browsers, so a flaw in them, or a malicious tool that passes them, matters to every instance.

## Supported versions

| Version | Supported |
|---|---|
| The newest `v1.x.y` tag | Security fixes, as a new patch tag |
| Older `v1.x.y` tags | No: a tag never moves. Update to the newest |

## Report a vulnerability

**Do not open a public issue for a security problem.** Report it privately:

1. **Preferred:** the repository's **Security** tab → **Report a vulnerability**. This opens a private advisory that
   only you and the maintainer see.
2. **Email:** `security@aprscaching.net`.

Include what you found, the file or tool it is in, a reproduction (a manifest, a registry file, a command), and its
impact. You get an answer within a few days and updates until the fix is out. Coordinated disclosure is
appreciated; you are credited unless you prefer not to be.

## In scope

- **Signature checks.** Anything that lets `scripts/verify.mjs` or the release checks accept a registry or a manifest
  that the authority key or the author key did not sign, or a script that does not match its signed `entrySha256`.
- **The signing flow.** A way for `scripts/sign-all.mjs`, `release.mjs` or `doctor.mjs` to leak a private key: into
  a log, a commit, a CI run or a file inside a working tree.
- **A tool in the registry** that is malicious or vulnerable: it does more than its permissions and README say,
  transmits without the operator asking, or exfiltrates data. For a tool that only misbehaves, without a security
  impact, use the **Report a tool** issue form.
- **The build.** A way for `scripts/build.mjs` or `fetch-libs.mjs` to put bytes into a `tool.js` that are not built
  from its reviewed sources and the pinned libraries.

## Out of scope here

- **The sandbox and the app's verifier.** A tool that escapes the sandbox, or an app that accepts a bad signature,
  is a flaw in APRScaching itself: report it under
  [apachler/aprscaching](https://github.com/apachler/aprscaching/security/advisories/new).
- **A tool from another registry.** Report it to that registry's publisher.
- Findings that need a private key the maintainer already holds.

## When a key leaks

If you believe a private key of this registry has leaked, the author key that signs the project's tools or the
authority key that signs `registry.json`, report it privately at once. The response, and what instances and
players see, is in
[Keys, rotation and release practice](https://apachler.github.io/aprscaching-tools/publish/keys-and-releases/#when-a-key-changes-or-leaks):
a new key, a re-signed registry in a new patch tag, and the new fingerprint published. The keys never enter this
repository, CI or a log; the maintainer signs offline.

Thank you for helping keep the registry trustworthy.
