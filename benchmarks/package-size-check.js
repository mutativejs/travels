const { spawnSync } = require('node:child_process');
const { readFileSync, readdirSync } = require('node:fs');
const { posix, resolve } = require('node:path');
const { gzipSync } = require('node:zlib');

const KiB = 1024;
const repoRoot = resolve(__dirname, '..');
const artifacts = ['dist/index.cjs', 'dist/index.esm.js', 'dist/index.umd.js'];
const limits = {
  bundleRaw: 32 * KiB,
  bundleGzip: 9 * KiB,
  bundleMap: 150 * KiB,
  packagePacked: 200 * KiB,
  packageUnpacked: 800 * KiB,
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

console.log('Bundle size report');
for (const artifact of artifacts) {
  const source = readFileSync(resolve(repoRoot, artifact));
  const sourceMap = readFileSync(resolve(repoRoot, `${artifact}.map`));
  const parsedSourceMap = JSON.parse(sourceMap.toString('utf8'));
  const gzipSize = gzipSync(source, { level: 9 }).byteLength;

  console.log(
    `- ${artifact}: raw ${formatBytes(source.byteLength)}, gzip ${formatBytes(
      gzipSize
    )}, map ${formatBytes(sourceMap.byteLength)}`
  );
  checkLimit(`${artifact} raw size`, source.byteLength, limits.bundleRaw);
  checkLimit(`${artifact} gzip size`, gzipSize, limits.bundleGzip);
  checkLimit(`${artifact}.map size`, sourceMap.byteLength, limits.bundleMap);
  if (
    !Array.isArray(parsedSourceMap.sources) ||
    !parsedSourceMap.sources.some((sourcePath) =>
      sourcePath.endsWith('/src/travels.ts')
    )
  ) {
    failures.push(`${artifact}.map does not resolve to TypeScript sources`);
  }
}

const finalBundleMaps = new Set(artifacts.map((artifact) => `${artifact}.map`));
const finalJavaScript = new Set(artifacts);
const distFiles = readdirSync(resolve(repoRoot, 'dist'));
const unexpectedMaps = distFiles
  .filter((name) => name.endsWith('.map') && !name.endsWith('.d.ts.map'))
  .map((name) => `dist/${name}`)
  .filter((name) => !finalBundleMaps.has(name));
const unexpectedJavaScript = distFiles
  .filter((name) => name.endsWith('.js') || name.endsWith('.cjs'))
  .map((name) => `dist/${name}`)
  .filter((name) => !finalJavaScript.has(name));

if (unexpectedMaps.length > 0) {
  failures.push(`unexpected JavaScript source maps: ${unexpectedMaps.join(', ')}`);
}
if (unexpectedJavaScript.length > 0) {
  failures.push(`unexpected JavaScript artifacts: ${unexpectedJavaScript.join(', ')}`);
}

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
for (const artifact of artifacts) {
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
