# Release Checklist

1. Update the release version locally:

   - bump `package.json`
   - update `CHANGELOG.md`

2. Run local verification before tagging:

   ```bash
   yarn install
   yarn build
   yarn test
   yarn test:types
   yarn test:browser
   yarn coverage
   yarn benchmark:ci
   ```

3. Review README performance claims against `benchmarks/README.md`.
4. Review persistence schema changes and migration notes.
5. Confirm `docs/compatibility.md` still matches runtime support.
6. Commit the version and changelog changes to `main`.
7. Push `main`, then create and push a matching release tag:

   ```bash
   VERSION=$(node -p "require('./package.json').version")
   git push origin main
   git tag "v$VERSION"
   git push origin "v$VERSION"
   ```

   The tag must match the `package.json` version exactly, with a leading `v`.

8. Confirm the tag-triggered release flow completed:

   - `Release`
   - `API Docs`, dispatched by `Release` with the release tag

9. Smoke test the published package:

   ```bash
   npm view travels version
   npm pack travels --dry-run
   ```
