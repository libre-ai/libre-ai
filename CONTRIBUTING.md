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

Owners of modest Apple Silicon Macs can contribute public-fixture Notebook performance evidence without sharing the device or any personal data. Physical and VM procedures, expected artifacts and acceptance criteria are documented in [`tools/qualification/notebook-core-v2/CONTRIBUTING-DEVICE-QUALIFICATION.md`](tools/qualification/notebook-core-v2/CONTRIBUTING-DEVICE-QUALIFICATION.md). VM results are diagnostic-only and can never promote a supported hardware class.
