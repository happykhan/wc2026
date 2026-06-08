import { en } from './en';
import { fr } from './fr';
import { es } from './es';
import { de } from './de';

export type TranslationKey = keyof typeof en;

const translations: Record<string, typeof en> = { en, fr, es, de };

export function getTranslations(lang: string): typeof en {
  const short = lang.split('-')[0].toLowerCase();
  return translations[short] ?? en;
}

export { en };
