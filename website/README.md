# Travels Website

The official Travels documentation and marketing site, built with Next.js, Fumadocs, Fumadocs MDX, and Tailwind CSS. All user-facing content is in English and the production site is fully statically exported.

## Develop

Install the repository and website dependencies from the repository root:

```bash
pnpm install
pnpm --dir website install --frozen-lockfile
```

Start the development server:

```bash
pnpm --dir website dev
```

You can also run `npm run dev` from this directory. CLI host and port arguments are forwarded to Next.js, for example `npm run dev -- --hostname 127.0.0.1 --port 7100`.

Open the local URL printed by Next.js. The homepage is `/`; documentation starts at `/docs`.

## Content

- `app/(home)/page.tsx`: custom product homepage.
- `app/global.css`: brand theme, responsive homepage, and Fumadocs color tokens.
- `components/`: brand, homepage, search, and MDX components.
- `content/docs/`: hand-written English guides and navigation metadata.
- `content/docs/api-reference/`: complete API pages generated from the current package source.
- `lib/source.ts`: Fumadocs source, page tree, and LLM integration.
- `public/`: optimized Travels logo, social image, and static assets.

Edit hand-written guides directly. Do not manually edit generated files inside the API `functions`, `classes`, `interfaces`, `type-aliases`, or `variables` directories; regenerate them instead:

```bash
pnpm --dir website docs:api
```

The `predev` and `prebuild` scripts also regenerate API pages from `src/index.ts`, so root development dependencies must be installed.

## Validate and build

```bash
pnpm --dir website types:check
pnpm --dir website build
```

The static export is written to `out/`. Search, Markdown pages, `llms.txt`, `llms-full.txt`, and documentation Open Graph images are generated statically.

Run the browser checks from the repository root after installing its development dependencies. Each script starts a temporary server and stops it when finished:

```bash
node website/scripts/validate-website.mjs
```

To build and synchronize the repository’s GitHub Pages artifact:

```bash
pnpm run build:doc:site
```

That root command builds this website and replaces `docs-site/` with the static export. To validate the exact project-path deployment locally, build with the production environment and run the static browser checks:

```bash
BASE_PATH=/travels SITE_URL=https://mutativejs.github.io/travels pnpm run build:doc:site
node website/scripts/validate-static.mjs
```

## Deployment configuration

- `BASE_PATH`: optional Next.js base path. GitHub Pages uses `/travels`.
- `NEXT_PUBLIC_BASE_PATH`: populated from `BASE_PATH` by `next.config.mjs` for public asset URLs.
- `SITE_URL`: deployed site URL. Its origin is used for absolute metadata URLs, while `BASE_PATH` supplies the project path. The release workflow sets the project GitHub Pages URL.

## Deploy to GitHub Pages

From the repository root, build and publish the current checkout with:

```bash
pnpm run deploy:doc:site
```

This command requires push access to the repository. It rebuilds the production site and replaces the `gh-pages` branch contents, including stale hidden files, without changing the current source branch. Configure GitHub Pages to deploy from the `gh-pages` branch at `/` (root).

The release-triggered `API Docs` workflow installs both lockfiles, runs the same production build, and publishes the validated release tag to the same branch. Do not dispatch it for an older tag unless you intentionally want to roll back the website.
