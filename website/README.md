# Travels Website

The official Travels documentation and marketing site, built with Next.js, Fumadocs, Fumadocs MDX, and Tailwind CSS. The site is fully static and ships in English and Simplified Chinese.

## Routes

| Content | English | Chinese |
| --- | --- | --- |
| Homepage | `/` | `/zh` |
| Documentation | `/docs` | `/zh/docs` |
| API reference | `/docs/api-reference` | `/zh/docs/api-reference` |
| Full-document LLM index | `/llms.txt` | `/zh/llms.txt` |
| Full-document LLM corpus | `/llms-full.txt` | `/zh/llms-full.txt` |
| Page Markdown | `/llms.mdx/docs/...` | `/zh/llms.mdx/docs/...` |

English keeps the existing unprefixed paths. Chinese uses the `/zh` prefix and sets `<html lang="zh-CN">`. Every localized page advertises both languages through `hreflang`/Open Graph alternates.

The generated TypeDoc API pages are canonical English. A page without a Chinese translation still renders under `/zh/docs` as a fallback with a Chinese notice, `noindex`, and an English canonical URL. Hand-written guides are required to have a Chinese translation; the content check enforces that.

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

Open the local URL printed by Next.js. The English site starts at `/`; the Chinese site starts at `/zh`.

## Content

- `app/(en)/`: English root layout and routes.
- `app/(zh)/`: Chinese root layout and routes under `/zh`.
- `app/global-not-found.tsx`: locale-aware branded 404 for statically exported unknown URLs.
- `app/(en)/(home)/page.tsx`: custom product homepage content lives in `lib/home-content.ts` and `components/home/home-page.tsx`.
- `app/global.css`: brand theme, responsive homepage, documentation polish, and the CJK font stack.
- `components/`: brand, homepage, search, and MDX components. The interactive homepage demos run on the published `travels` and `mutative` packages.
- `content/docs/`: hand-written English guides, generated API pages, and navigation metadata.
- `content/docs/zh/`: Simplified Chinese translations with the same relative paths and their own `meta.json` files.
- `lib/i18n.ts`: Fumadocs i18n config and UI translations, including the official `@fumadocs/language/zh-cn` pack.
- `lib/source.ts`: locale-aware Fumadocs source, page tree, search, and LLM integration.
- `lib/locale.ts`: locale codes and path helpers shared by route and UI code.
- `lib/metadata.ts`: localized titles, descriptions, canonical URLs, and language alternates.
- `public/`: optimized Travels logo, social image, and static assets.

Edit the eight packaged English guides in the repository’s `docs/` directory, then run `pnpm --dir website docs:sync` to update their website bodies and links. Their MDX frontmatter and Chinese translations are edited on the website. Edit other hand-written guides directly. Do not manually edit generated files inside the API `functions`, `classes`, `interfaces`, `type-aliases`, or `variables` directories; regenerate them instead:

```bash
pnpm --dir website docs:api
```

Development, build, type checks, and content checks generate the API pages from the published Travels package installed by the website lockfile. Install root development dependencies before running these commands. Git tracks the hand-written API landing page and translations. Generated pages and their navigation stay local so their source links point to the matching release tag. To change the documented release, update the website’s Travels dependency and lockfile together.

## Translate a page

1. Add the Chinese file at the same relative path under `content/docs/zh/`. For example, `content/docs/guides/transactions.mdx` becomes `content/docs/zh/guides/transactions.mdx`.
2. Translate the `title` and `description` frontmatter fields. Keep the same field names.
3. Translate prose, headings, table headers, callout titles, card titles, and prose attributes. Keep code blocks, identifiers, package names, type names, error codes, and file names unchanged.
4. Rewrite absolute internal links to the Chinese tree: `/docs/...` becomes `/zh/docs/...`, and `/` becomes `/zh`. External links stay unchanged.
5. Use the established glossary: 状态, 补丁, 时间线, 历史记录, 游标, 位置, 基线, 归档, 事务, 分支, 撤销, 重做, 日志, 持久化, 快照, 序列化, 反序列化, 恢复, 迁移, 校验, 元数据. Keep **Store** capitalized in prose.
6. Run the content and type checks:

```bash
pnpm --dir website check:content
pnpm --dir website types:check
```

The content check verifies translation coverage, matching code fences and MDX components, internal links, navigation entries, and that English pages contain no Chinese text. See below for the browser checks.

## Validate and build

```bash
pnpm --dir website types:check
pnpm --dir website build
```

The static export is written to `out/`. Search (one index per locale), Markdown pages, `llms.txt`, `llms-full.txt`, documentation Open Graph images, and the branded 404 are generated statically.

Run the browser checks from the repository root after installing its development dependencies. Each script starts a temporary server and stops it when finished:

```bash
node website/scripts/validate-website.mjs
```

The browser checks cover the English and Chinese homepages, documentation, search, language switching, API fallback notice, Chinese 404 status, localized LLM routes, responsive overflow, and console/request failures.

To build and synchronize the repository’s GitHub Pages artifact:

```bash
pnpm run build:doc:site
```

That command builds the website and replaces `docs-site/` with the static export. To validate the exact project-path deployment locally, build with the production environment and run the static browser checks:

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
