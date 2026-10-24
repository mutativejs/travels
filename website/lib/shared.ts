import { createGetUrl } from 'fumadocs-core/source';
import { basePath } from './assets';

export const appName = 'Travels';
export const docsRoute = '/docs';
export const docsImageRoute = `${basePath}/og/docs`;
export const docsContentRoute = `${basePath}/llms.mdx/docs`;

export const gitConfig = {
  user: 'mutativejs',
  repo: 'travels',
  branch: 'main',
};

export const repositoryUrl = `https://github.com/${gitConfig.user}/${gitConfig.repo}`;

const getContentUrl = createGetUrl(docsContentRoute);

export function getPageMarkdownUrl(page: { slugs: string[]; locale?: string }) {
  const segments = [...page.slugs, 'content.md'];
  return { segments, url: getContentUrl(segments, page.locale) };
}

const getImageUrl = createGetUrl(docsImageRoute);

export function getPageImageUrl(page: { slugs: string[]; locale?: string }) {
  const segments = [...page.slugs, 'image.png'];
  return { segments, url: getImageUrl(segments, page.locale) };
}
