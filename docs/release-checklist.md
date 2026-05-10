# Release Checklist

1. Confirm the release PR from release-please includes the expected version and changelog entries.
2. Run local verification:

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
6. Merge the release PR.
7. Create or approve the GitHub release.
8. Confirm the npm publish workflow completed with provenance.
9. Smoke test the published package:

   ```bash
   npm view travels version
   npm pack travels --dry-run
   ```
