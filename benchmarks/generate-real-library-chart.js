const fs = require('fs');
const path = require('path');

const chartMetrics = [
  {
    key: 'updateMs',
    title: (config) => `Record ${config.iterations} updates`,
    unit: 'ms total',
  },
  {
    key: 'undoMs',
    title: (config) => `Undo ${config.navigationSteps} steps`,
    unit: 'ms total',
  },
  {
    key: 'redoMs',
    title: (config) => `Redo ${config.navigationSteps} steps`,
    unit: 'ms total',
  },
  {
    key: 'retainedHeapMB',
    title: 'Retained heap after updates',
    unit: 'MB delta',
  },
  {
    key: 'serializedSizeKB',
    title: 'Persisted current state + history',
    unit: 'KB JSON',
  },
];

const groupColors = {
  travels: '#2563eb',
  integration: '#7c3aed',
  'model-tree': '#0f766e',
  snapshot: '#6b7280',
};

function escapeXml(value) {
  return String(value)
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&apos;');
}

function formatNumber(value) {
  if (Math.abs(value) >= 1000) return Math.round(value).toLocaleString('en-US');
  if (Math.abs(value) >= 100) return value.toFixed(1);
  if (Math.abs(value) >= 10) return value.toFixed(2);
  return value.toFixed(3);
}

function renderPanel(report, metricDefinition, dimensions) {
  const { x, y, width } = dimensions;
  const implementations = report.implementations;
  const values = implementations.flatMap((implementation) => {
    const metric = implementation.metrics[metricDefinition.key];
    return [Math.max(0, metric.median), Math.max(0, metric.p95)];
  });
  const maximum = Math.max(...values, 0.001);
  const labelWidth = width > 800 ? 180 : 155;
  const valueWidth = 118;
  const plotX = x + labelWidth;
  const plotWidth = width - labelWidth - valueWidth - 18;
  const rowStart = y + 62;
  const rowGap = 27;
  const barHeight = 12;
  const axisY = rowStart + implementations.length * rowGap - 5;
  const title =
    typeof metricDefinition.title === 'function'
      ? metricDefinition.title(report.config)
      : metricDefinition.title;
  const elements = [
    `<line class="section-line" x1="${x}" y1="${y}" x2="${
      x + width
    }" y2="${y}" />`,
    `<text class="panel-title" x="${x}" y="${y + 25}">${escapeXml(
      title
    )}</text>`,
    `<text class="panel-note" x="${x}" y="${y + 44}">median / p95 · ${escapeXml(
      metricDefinition.unit
    )} · lower is better</text>`,
    `<line class="grid" x1="${plotX}" y1="${rowStart - 8}" x2="${plotX}" y2="${axisY}" />`,
    `<line class="grid" x1="${plotX + plotWidth / 2}" y1="${
      rowStart - 8
    }" x2="${plotX + plotWidth / 2}" y2="${axisY}" />`,
    `<line class="grid" x1="${plotX + plotWidth}" y1="${
      rowStart - 8
    }" x2="${plotX + plotWidth}" y2="${axisY}" />`,
  ];

  implementations.forEach((implementation, index) => {
    const metric = implementation.metrics[metricDefinition.key];
    const median = Math.max(0, metric.median);
    const p95 = Math.max(0, metric.p95);
    const rowY = rowStart + index * rowGap;
    const medianWidth = (median / maximum) * plotWidth;
    const p95X = plotX + (p95 / maximum) * plotWidth;
    const color = groupColors[implementation.group] ?? groupColors.snapshot;
    const opacity = implementation.id === 'travels-immutable' ? 0.62 : 0.92;
    elements.push(
      `<text class="row-label" x="${x}" y="${rowY + 10}">${escapeXml(
        implementation.label
      )}</text>`,
      `<rect x="${plotX}" y="${rowY}" width="${Math.max(
        medianWidth,
        1
      )}" height="${barHeight}" rx="2" fill="${color}" opacity="${opacity}" />`,
      `<line class="p95" x1="${p95X}" y1="${rowY - 3}" x2="${p95X}" y2="${
        rowY + barHeight + 3
      }" />`,
      `<text class="value" x="${plotX + plotWidth + 12}" y="${
        rowY + 10
      }">${escapeXml(formatNumber(metric.median))} / ${escapeXml(
        formatNumber(metric.p95)
      )}</text>`
    );
  });

  elements.push(
    `<line class="axis" x1="${plotX}" y1="${axisY}" x2="${
      plotX + plotWidth
    }" y2="${axisY}" />`,
    `<text class="axis-label" x="${plotX}" y="${axisY + 18}">0</text>`,
    `<text class="axis-label end" x="${plotX + plotWidth}" y="${
      axisY + 18
    }">${escapeXml(formatNumber(maximum))}</text>`
  );
  return `<g>${elements.join('\n')}</g>`;
}

function createBenchmarkSvg(report) {
  const width = 1200;
  const height = 1120;
  const margin = 42;
  const columnGap = 42;
  const columnWidth = (width - margin * 2 - columnGap) / 2;
  const panelHeight = 272;
  const panelTop = 148;
  const rowGap = 30;
  const panels = [
    renderPanel(report, chartMetrics[0], {
      x: margin,
      y: panelTop,
      width: columnWidth,
      height: panelHeight,
    }),
    renderPanel(report, chartMetrics[1], {
      x: margin + columnWidth + columnGap,
      y: panelTop,
      width: columnWidth,
      height: panelHeight,
    }),
    renderPanel(report, chartMetrics[2], {
      x: margin,
      y: panelTop + panelHeight + rowGap,
      width: columnWidth,
      height: panelHeight,
    }),
    renderPanel(report, chartMetrics[3], {
      x: margin + columnWidth + columnGap,
      y: panelTop + panelHeight + rowGap,
      width: columnWidth,
      height: panelHeight,
    }),
    renderPanel(report, chartMetrics[4], {
      x: margin,
      y: panelTop + (panelHeight + rowGap) * 2,
      width: width - margin * 2,
      height: panelHeight,
    }),
  ];

  const { config, environment } = report;
  const generatedDate = new Date(report.generatedAt).toISOString().slice(0, 10);
  const subtitle =
    `${config.actualInitialSizeKB}KB state · ${config.iterations} updates · ` +
    `${config.navigationSteps} undo/redo · ${config.rounds} rounds · ${environment.node}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description">
  <title id="title">Real-library undo and redo benchmark</title>
  <desc id="description">Median and p95 update, undo, redo, retained heap, and serialized history measurements for Travels, Travels-backed Coaction history, MobX-State-Tree, mobx-keystone, Redux-undo, and Zundo. Lower values are better.</desc>
  <style>
    text { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; fill: #111827; }
    .title { font-size: 27px; font-weight: 500; }
    .subtitle { font-size: 14px; fill: #4b5563; }
    .legend { font-size: 13px; fill: #374151; }
    .panel-title { font-size: 17px; font-weight: 500; }
    .panel-note, .axis-label { font-size: 12px; fill: #6b7280; }
    .row-label, .value { font-size: 12px; }
    .value { font-variant-numeric: tabular-nums; fill: #374151; }
    .axis-label.end { text-anchor: end; }
    .section-line, .axis { stroke: #9ca3af; stroke-width: 1; }
    .grid { stroke: #e5e7eb; stroke-width: 1; }
    .p95 { stroke: #111827; stroke-width: 1.5; }
  </style>
  <rect width="${width}" height="${height}" fill="#ffffff" />
  <text class="title" x="${margin}" y="48">Real-library undo/redo benchmark</text>
  <text class="subtitle" x="${margin}" y="76">${escapeXml(subtitle)}</text>
  <g transform="translate(${margin} 103)">
    <rect x="0" y="-10" width="18" height="10" rx="2" fill="${groupColors.travels}" />
    <text class="legend" x="26" y="0">Travels</text>
    <rect x="112" y="-10" width="18" height="10" rx="2" fill="${groupColors.integration}" />
    <text class="legend" x="138" y="0">Travels integration</text>
    <rect x="288" y="-10" width="18" height="10" rx="2" fill="${groupColors['model-tree']}" />
    <text class="legend" x="314" y="0">model-tree patch managers</text>
    <rect x="556" y="-10" width="18" height="10" rx="2" fill="${groupColors.snapshot}" />
    <text class="legend" x="582" y="0">snapshot histories</text>
    <line class="p95" x1="758" y1="-13" x2="758" y2="3" />
    <text class="legend" x="769" y="0">p95 marker</text>
  </g>
  ${panels.join('\n')}
  <text class="subtitle" x="${margin}" y="1090">Generated ${escapeXml(
    generatedDate
  )} on ${escapeXml(environment.cpu)}. Store/model creation is excluded; heap deltas are GC-sensitive.</text>
</svg>
`;
}

function writeBenchmarkChart(report, outputPath) {
  fs.writeFileSync(outputPath, createBenchmarkSvg(report));
}

if (require.main === module) {
  const inputPath = path.resolve(
    process.argv[2] ??
      path.join(__dirname, 'results/real-library-benchmark.json')
  );
  const outputPath = path.resolve(
    process.argv[3] ?? inputPath.replace(/\.json$/u, '.svg')
  );
  const report = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  writeBenchmarkChart(report, outputPath);
  console.log(`Wrote ${outputPath}`);
}

module.exports = {
  createBenchmarkSvg,
  writeBenchmarkChart,
};
