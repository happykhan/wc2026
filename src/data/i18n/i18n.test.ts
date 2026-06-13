import { describe, it, expect } from 'vitest';
import { LANGUAGES, getTranslations, getDateLocale } from './index';

// tsc already forbids a locale from MISSING a key (each is typed as `typeof en`),
// but it allows stray EXTRA keys — this catches those, plus empty values, so every
// language stays complete and in sync. Adding a language? One entry in LANGUAGES.
describe('i18n locales', () => {
  const enKeys = Object.keys(LANGUAGES[0].translations).sort();

  it('has the expected languages registered', () => {
    expect(LANGUAGES.map((l) => l.code)).toEqual(['en', 'fr', 'es', 'de', 'pt']);
  });

  it('every language defines exactly the same keys (no missing, no stray)', () => {
    for (const lang of LANGUAGES) {
      expect(Object.keys(lang.translations).sort(), `locale ${lang.code}`).toEqual(enKeys);
    }
  });

  it('no translation value is empty', () => {
    for (const lang of LANGUAGES) {
      for (const [k, v] of Object.entries(lang.translations)) {
        expect(v, `${lang.code}.${k}`).toBeTruthy();
      }
    }
  });

  it('resolves region-tagged and unknown languages sensibly', () => {
    expect(getTranslations('es-MX')).toBe(getTranslations('es'));
    expect(getTranslations('pt-BR')).toBe(getTranslations('pt')); // region-tagged → base
    expect(getTranslations('zz')).toBe(getTranslations('en')); // unknown → English
    expect(getDateLocale('fr-CA')).toBe(getDateLocale('fr'));
  });
});
