const { spawnSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { posix, resolve } = require('node:path');
const { gzipSync } = require('node:zlib');

const KiB = 1024;
const repoRoot = resolve(__dirname, '..');
const artifacts = ['dist/index.cjs', 'dist/index.esm.js', 'dist/index.umd.js'];
const developmentArtifacts = ['dist/index.dev.cjs', 'dist/index.dev.esm.js'];
// Budgets sit just above the current artifacts so any unplanned growth fails
// the build. The step from the 2.1.0 line (40.5 KiB raw / 11.5 KiB gzip) is the
// hardening work: controlled-journal validation and detachment, persistence
// compatibility checks, structured warnings and error codes, the patchable
// factory, and detached history snapshots. Development-only invariants are
// eliminated from the production bundles rather than counted here. Travels 3
// adds explicit public capabilities, atomic restore factories, cheap committed
// revision tokens, and the complete controlled-journal lifecycle. The final
// ownership hardening adds shared record preflight, controlled-apply reentrancy
// guards, atomic pending archives, closed factory option sets, and archive
// capabilities that exist only in manual mode. The final public-boundary pass
// rejects invalid options containers consistently across factories,
// persistence, serialization, and compatibility diagnostics. Production raw
// and gzip retain their existing limits; source maps and the package envelope
// include the additional guard source and guidance.
const limits = {
  bundleRaw: 53.5 * KiB,
  bundleGzip: 14.5 * KiB,
  bundleMap: 257 * KiB,
  developmentBundleRaw: 59.25 * KiB,
  developmentBundleGzip: 15.75 * KiB,
  developmentBundleMap: 263 * KiB,
  packagePacked: 500 * KiB,
  packageUnpacked: 1960 * KiB,
};

const failures = [];
const formatBytes = (bytes) => `${(bytes / KiB).toFixed(1)} KiB`;
const checkLimit = (label, actual, limit) => {
  if (actual > limit) {
    failures.push(
      `${label} is ${formatBytes(actual)} (limit ${formatBytes(limit)})`
    );
  }
};

const reportArtifact = (artifact, rawLimit, gzipLimit, mapLimit) => {
  const source = readFileSync(resolve(repoRoot, artifact));
  const sourceMap = readFileSync(resolve(repoRoot, `${artifact}.map`));
  const parsedSourceMap = JSON.parse(sourceMap.toString('utf8'));
  const gzipSize = gzipSync(source, { level: 9 }).byteLength;

  console.log(
    `- ${artifact}: raw ${formatBytes(source.byteLength)}, gzip ${formatBytes(
      gzipSize
    )}, map ${formatBytes(sourceMap.byteLength)}`
  );
  checkLimit(`${artifact} raw size`, source.byteLength, rawLimit);
  checkLimit(`${artifact} gzip size`, gzipSize, gzipLimit);
  checkLimit(`${artifact}.map size`, sourceMap.byteLength, mapLimit);
  if (
    !Array.isArray(parsedSourceMap.sources) ||
    !parsedSourceMap.sources.some((sourcePath) =>
      sourcePath.endsWith('/src/travels.ts')
    )
  ) {
    failures.push(`${artifact}.map does not resolve to TypeScript sources`);
  }
};

console.log('Bundle size report');
for (const artifact of artifacts) {
  reportArtifact(artifact, limits.bundleRaw, limits.bundleGzip, limits.bundleMap);
}
for (const artifact of developmentArtifacts) {
  reportArtifact(
    artifact,
    limits.developmentBundleRaw,
    limits.developmentBundleGzip,
    limits.developmentBundleMap
  );
}

const allArtifacts = [...artifacts, ...developmentArtifacts];
const finalBundleMaps = new Set(
  allArtifacts.map((artifact) => `${artifact}.map`)
);
const finalJavaScript = new Set(allArtifacts);
const packResult = spawnSync(
  'npm',
  ['pack', '--dry-run', '--json', '--ignore-scripts'],
  { cwd: repoRoot, encoding: 'utf8' }
);
if (packResult.error) {
  throw packResult.error;
}
if (packResult.status !== 0) {
  throw new Error(packResult.stderr || 'npm pack --dry-run failed');
}

const [pack] = JSON.parse(packResult.stdout);
const packedFiles = new Set(pack.files.map(({ path }) => path));

// Derive this from what npm would publish rather than from a listing of the
// dist root. A directory listing misses nested output, which is how six
// unbundled dist/internal modules were published alongside the real entry
// points once the sources grew a subdirectory.
const publishedPaths = pack.files.map(({ path }) => path);
const internalDeclarations = publishedPaths.filter(
  (path) =>
    path.startsWith('dist/internal/') &&
    (path.endsWith('.d.ts') || path.endsWith('.d.ts.map'))
);
if (internalDeclarations.length > 0) {
  failures.push(
    `internal declarations were published: ${internalDeclarations.join(', ')}`
  );
}
const travelsDeclaration = readFileSync(
  resolve(repoRoot, 'dist/travels.d.ts'),
  'utf8'
);
for (const leakedName of [
  'TravelsCore',
  'RECORD_TRAVEL_JOURNAL_PATCHES',
  './internal/',
]) {
  if (travelsDeclaration.includes(leakedName)) {
    failures.push(`dist/travels.d.ts exposes internal name ${leakedName}`);
  }
}
const unexpectedMaps = publishedPaths.filter(
  (path) =>
    path.startsWith('dist/') &&
    path.endsWith('.map') &&
    !path.endsWith('.d.ts.map') &&
    !finalBundleMaps.has(path)
);
const unexpectedJavaScript = publishedPaths.filter(
  (path) =>
    path.startsWith('dist/') &&
    (path.endsWith('.js') || path.endsWith('.cjs')) &&
    !finalJavaScript.has(path)
);
if (unexpectedMaps.length > 0) {
  failures.push(`unexpected JavaScript source maps: ${unexpectedMaps.join(', ')}`);
}
if (unexpectedJavaScript.length > 0) {
  failures.push(`unexpected JavaScript artifacts: ${unexpectedJavaScript.join(', ')}`);
}
for (const artifact of allArtifacts) {
  if (!packedFiles.has(artifact) || !packedFiles.has(`${artifact}.map`)) {
    failures.push(`npm package is missing ${artifact} or its source map`);
  }
}
for (const { path } of pack.files) {
  if (!path.endsWith('.js') && !path.endsWith('.cjs')) {
    continue;
  }
  const source = readFileSync(resolve(repoRoot, path), 'utf8');
  for (const match of source.matchAll(/sourceMappingURL=([^\s*]+)/g)) {
    const mapPath = posix.normalize(
      posix.join(posix.dirname(path), match[1])
    );
    if (!match[1].startsWith('data:') && !packedFiles.has(mapPath)) {
      failures.push(`${path} references missing source map ${mapPath}`);
    }
  }
}

console.log(
  `Package size: packed ${formatBytes(pack.size)}, unpacked ${formatBytes(
    pack.unpackedSize
  )}, files ${pack.entryCount}`
);
checkLimit('packed package size', pack.size, limits.packagePacked);
checkLimit('unpacked package size', pack.unpackedSize, limits.packageUnpacked);

if (failures.length > 0) {
  console.error('\nPackage size budgets failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log('All package size budgets passed.');
}
