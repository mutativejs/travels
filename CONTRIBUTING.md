# Contributing

Thanks for improving Travels. This project values correctness, clear trade-offs, and small focused changes.

## Development Setup

```bash
yarn install
yarn build
yarn test
```

Useful checks:

```bash
yarn test:types
yarn test:browser
yarn coverage
yarn benchmark:ci
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
