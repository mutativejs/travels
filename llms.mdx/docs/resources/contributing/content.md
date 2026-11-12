# Contributing (/travels/llms.mdx/docs/resources/contributing/content.md)

Thanks for improving Travels. This project values correctness, clear trade-offs, and small focused changes.

## Development Setup [#development-setup]

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm run build
pnpm run test
```

Useful checks:

```bash
pnpm run test:types
pnpm run test:browser
pnpm run coverage
pnpm run benchmark:ci
```

For website changes, install the website lockfile and run its focused checks:

```bash
pnpm --dir website install --frozen-lockfile
pnpm --dir website check:content
pnpm --dir website types:check
pnpm --dir website build
```

## Pull Request Expectations [#pull-request-expectations]

- Keep changes scoped to one behavior or documentation area.
- Add tests for new public API, history invariants, persistence behavior, or bug fixes.
- Update README/docs when behavior, compatibility, or persistence semantics change.
- Include benchmark updates when performance claims change.
- Avoid changing generated artifacts unless the release process requires them.
- Regenerate the website API reference after changing exported API signatures or documentation comments.

## Compatibility [#compatibility]

See the [Compatibility Policy](/travels/llms.mdx/docs/reference/compatibility/content.md) for supported runtimes and dependency policy.

## Release Process [#release-process]

See the [Release Checklist](/travels/llms.mdx/docs/resources/release-checklist/content.md). Releases are prepared on `main`, tagged manually with the package version, and published by the tag-triggered GitHub Actions workflow.
