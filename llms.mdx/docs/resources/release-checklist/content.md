# Release Checklist (/docs/resources/release-checklist)

1. Update the release version locally:

   - bump `package.json`
   - update `CHANGELOG.md`, replacing `Unreleased` in the version heading with the release date

2. Run local verification before tagging:

   ```bash
   corepack enable
   pnpm install --frozen-lockfile
   pnpm --dir website install --frozen-lockfile
   pnpm exec playwright install chromium
   pnpm run lint
   pnpm run size:ci
   pnpm run build:doc:site
   pnpm run test:types
   pnpm run test:examples
   pnpm run test
   pnpm run test:browser
   pnpm run test:e2e:types
   pnpm run test:e2e:ci
   pnpm run coverage
   pnpm run test:mutation:smoke
   pnpm run benchmark:ci
   ```

3. Review README performance claims against `benchmarks/README.md`.
4. Review persistence schema changes and migration notes.
5. Confirm `docs/compatibility.md` still matches runtime support.
6. Commit the version and changelog changes to `main`.

### Coordinated v3 binding release [#coordinated-v3-binding-release]

For a major release that changes the factory or restore boundary, publish in dependency order:

1. Finish every Travels gate in this checklist and publish `travels@3` from the exact tested artifact.
2. Install the published core in clean `use-travel` and `zustand-travel` checkouts. Raise their `mutative` peer and development ranges to the range Travels requires (`^2.0.0` for Travels 3), update their lockfiles to the published versions, and rerun each repository's types, tests, production build, and package smoke test.
3. Publish the binding majors only after those published-core runs pass.
4. In a clean consumer, install all three published packages together with `mutative@2`, confirm the install reports no peer dependency conflict, and smoke test a new timeline plus an atomically restored timeline.

Local sibling links are useful candidate evidence, but they do not replace the published-package checks in steps 2 and 4. Do not tag a binding release that requires an unpublished core version.

7. Push `main`, then create and push a matching release tag:

   ```bash
   VERSION=$(node -p "require('./package.json').version")
   git push origin main
   git tag "v$VERSION"
   git push origin "v$VERSION"
   ```

   The tag must match the `package.json` version exactly, with a leading `v`.

   The release job picks the npm dist-tag itself: a version above the published `latest` becomes `latest`, a prerelease becomes `next`, and a maintenance release of an older major becomes `v<major>-latest` (for example `v2-latest`), so it never replaces the current major.

8. Confirm the tag-triggered release flow completed:

   - `Release`
   - `API Docs`, dispatched by `Release` with the release tag

9. Smoke test the published package:

   ```bash
   npm view travels version
   npm pack travels --dry-run
   ```
