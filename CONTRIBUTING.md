# Contributing

Thanks for improving Travels. This project values correctness, clear trade-offs, and small focused changes.

## Development Setup

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

## Pull Request Expectations

- Keep changes scoped to one behavior or documentation area.
- Add tests for new public API, history invariants, persistence behavior, or bug fixes.
- Update README/docs when behavior, compatibility, or persistence semantics change.
- Include benchmark updates when performance claims change.
- Avoid changing generated artifacts unless the release process requires them.

## Compatibility

See [`docs/compatibility.md`](docs/compatibility.md) for supported runtimes and dependency policy.

## Release Process

See [`docs/release-checklist.md`](docs/release-checklist.md). Changelog and release PRs are prepared by release-please.
