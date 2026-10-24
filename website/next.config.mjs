import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

const websiteRoot = dirname(fileURLToPath(import.meta.url));
const basePath = process.env.BASE_PATH ?? '';

/** @type {import('next').NextConfig} */
const config = {
  output: 'export',
  reactStrictMode: true,
  trailingSlash: true,
  basePath: basePath || undefined,
  // Dependency updates are reviewed explicitly; keep builds non-interactive.
  experimental: {
    agentUpgrade: false,
  },
  turbopack: {
    root: websiteRoot,
  },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default withMDX(config);
