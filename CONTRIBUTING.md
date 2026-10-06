# Contributing a tool

The steps to propose a tool for the project registry, and what the review checks, are in
[Contribute a tool](https://apachler.github.io/aprscaching-tools/project/contribute/) on the documentation site
(`docs/project/contribute.md`). Build and test your tool first with
[Write your first tool](https://apachler.github.io/aprscaching-tools/write/first-tool/).

## Sign off your commits

Every commit carries a Developer Certificate of Origin sign-off ([developercertificate.org](https://developercertificate.org/)):

```bash
git commit -s
```

It adds `Signed-off-by: Your Name <you@example.org>` and certifies that you wrote the change or have the right to
submit it under the stated licence. Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/),
for example `feat(tools): add cw-trainer`.

## Tests

A change that adds or changes behaviour adds the tests that check it: a new tool its `test/<name>.test.mjs`, a new
command or option its cases. A bug fix ships with the test that would have caught the bug. `pnpm test` and
`pnpm lint` pass before a pull request is merged; CI runs both on every pull request. How to test a tool is in
[Test a tool](https://apachler.github.io/aprscaching-tools/write/test/).

## Community

Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md). Questions go to
[Discussions](https://github.com/apachler/aprscaching-tools/discussions) ([SUPPORT.md](SUPPORT.md)); a security
problem goes through a private advisory, never an issue ([SECURITY.md](SECURITY.md)).
