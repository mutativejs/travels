import { defineI18n } from 'fumadocs-core/i18n';
import { uiTranslations } from 'fumadocs-ui/i18n';
import { zhCN } from '@fumadocs/language/zh-cn';

/**
 * English stays at `/docs`; Chinese lives under `/zh/docs`.
 *
 * `parser: 'dir'` means English files are unprefixed in `content/docs` and
 * Chinese translations live in `content/docs/zh` with the same relative paths.
 * `hideLocale: 'default-locale'` keeps the URLs of the existing English site
 * stable while giving Chinese a real, indexable prefix.
 */
export const i18n = defineI18n({
  defaultLanguage: 'en',
  languages: ['en', 'zh'],
  parser: 'dir',
  hideLocale: 'default-locale',
});

export const translations = i18n
  .translations()
  .extend(uiTranslations())
  .preset('zh', zhCN())
  .add({
    en: {
      displayName: 'English',
    },
    zh: {
      displayName: '简体中文',
      // Keep the UI in concise mainland Chinese rather than the language
      // pack's occasional Taiwan-leaning wording.
      'No results found(search dialog)': '未找到结果',
      'No Headings(table of contents)': '暂无标题',
      'Open Search(search trigger)(aria-label)': '打开搜索',
      'Search failed(search dialog)': '搜索失败',
      'Search(search trigger)': '搜索',
      'Toggle Theme(theme switcher)(aria-label)': '切换主题',
    },
  });
