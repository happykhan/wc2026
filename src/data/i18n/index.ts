import type { Locale } from 'date-fns';
import { enUS, fr as frLocale, es as esLocale, de as deLocale } from 'date-fns/locale';
import { en } from './en';
import { fr } from './fr';
import { es } from './es';
import { de } from './de';

export type TranslationKey = keyof typeof en;

// ---------------------------------------------------------------------------
// Single language registry. To add a language: create the locale file (it must
// implement every TranslationKey or the build fails) and add ONE entry here —
// the picker, the translator, and date formatting all read from this list.
// Team/country names localise automatically via Intl.DisplayNames, and group
// labels via the `group` key, so no extra per-language data is needed for those.
// ---------------------------------------------------------------------------
export interface LanguageDef {
  code: string;
  label: string;
  translations: typeof en;
  dateLocale: Locale;
}

export const LANGUAGES: LanguageDef[] = [
  { code: 'en', label: 'English', translations: en, dateLocale: enUS },
  { code: 'fr', label: 'Français', translations: fr, dateLocale: frLocale },
  { code: 'es', label: 'Español', translations: es, dateLocale: esLocale },
  { code: 'de', label: 'Deutsch', translations: de, dateLocale: deLocale },
];

const byCode = new Map(LANGUAGES.map((l) => [l.code, l]));
const shortCode = (lang: string) => lang.split('-')[0].toLowerCase();
const resolve = (lang: string): LanguageDef => byCode.get(shortCode(lang)) ?? byCode.get('en')!;

export function getTranslations(lang: string): typeof en {
  return resolve(lang).translations;
}

export function getDateLocale(lang: string): Locale {
  return resolve(lang).dateLocale;
}

export { en };
