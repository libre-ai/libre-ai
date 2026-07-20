# Contributing

The `libre-ai/libre-ai` GitHub repository is the canonical merge authority.

During the Big Bang reconstruction:

1. select an accepted work package and owner ;
2. modify only its declared paths and contracts ;
3. keep branches short and rebase before review ;
4. run `bun run check` and the affected Rust/contract/Playwright gates ;
5. include evidence and remaining risk in the pull request ;
6. obtain human approval for contracts, auth, data, releases and deployment.

Historical sibling repositories are read-only evidence. Do not submit new architecture there.

## Device qualification contributions

Owners of modest Apple Silicon Macs can optionally contribute public-fixture Notebook performance evidence without sharing the device or any personal data. Physical and VM procedures, expected artifacts and acceptance criteria are documented in [`tools/qualification/notebook-core-v2/CONTRIBUTING-DEVICE-QUALIFICATION.md`](tools/qualification/notebook-core-v2/CONTRIBUTING-DEVICE-QUALIFICATION.md). The absence of 8 Gio or 16–24 Gio contributions cannot block the current Gate B, and those classes remain unsupported until independently qualified. VM results are diagnostic-only and can never promote a supported hardware class.

## Licence and Developer Certificate of Origin

A contribution is submitted under the licence already declared for every file it
changes. Read `LICENSING.md` and do not add imported code, data, model output or
brand material without explicit provenance and SPDX metadata.

Every commit must certify the [Developer Certificate of Origin 1.1](https://developercertificate.org/)
with a sign-off created by:

```console
git commit --signoff
```

The resulting trailer must have the form:

```text
Signed-off-by: Contributor Name <address@example.org>
```

The sign-off certifies the right to submit the contribution; it is not a
copyright assignment and does not authorize proprietary relicensing. Libre AI
does not require a CLA.

CI enforces the trailer twice: every commit in a pull-request range must carry
an author-matching sign-off, and every push to `main` re-verifies the commits
it introduces. A **forge-generated integration commit** — a merge commit, or a
squashed pull request — is committed by GitHub and authored by the forge
account (a `@users.noreply.github.com` address), so it cannot carry an
author-matching contributor trailer. For these the push gate accepts any valid
maintainer `Signed-off-by:` line carried in the commit message: for a squash
this is the sign-off inherited from the squashed contributor commit (produced by
`git commit -s`), and for a merge commit it is the merging maintainer's own
line. **Ordinary commits** (authored by a contributor address rather than the
forge) still require an exact author-matching sign-off. Merge commits accepted
before this gate existed remain unchanged history and are never re-examined.

Practical consequence: `gh pr merge --squash` works with no extra ceremony —
the squashed commit inherits the pull request's `git commit -s` sign-off, which
the gate accepts because the squash is authored by the forge account.

The sign-off name, email address, commit and contribution become public and are
retained in distributed Git history. Use an address suitable for publication
and do not include unnecessary personal data in commits, issues or evidence.
