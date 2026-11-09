import { i18nProvider } from 'fumadocs-ui/i18n';
import { translations } from './i18n';
import type { Locale } from './locale';

/** Serializable i18n props for the client-side Fumadocs provider. */
export function getI18nUI(locale: Locale) {
  return i18nProvider(translations, locale);
}
