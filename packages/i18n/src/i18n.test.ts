import { describe, expect, it } from 'vitest';
import { resources, LOCALES, searchKey } from './index';

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe('locales', () => {
  const reference = keys(resources.en).sort();
  it.each(LOCALES)('%s has every key and no empty strings', (locale) => {
    expect(keys(resources[locale]).sort()).toEqual(reference);
    const empty = keys(resources[locale]).filter((k) => {
      const v = k
        .split('.')
        .reduce<unknown>((o, p) => (o as Record<string, unknown>)[p], resources[locale]);
      return typeof v !== 'string' || v.trim() === '';
    });
    expect(empty).toEqual([]);
  });
  it.each(LOCALES)('%s keeps {{placeholders}} identical to English', (locale) => {
    const ph = (s: string) => (s.match(/{{\w+}}/g) ?? []).sort().join();
    expect(ph(resources[locale].circle.meeting)).toBe(ph(resources.en.circle.meeting));
  });
});

describe('searchKey', () => {
  it('matches Armenian script with Latin transliteration', () => {
    expect(searchKey('Երևան')).toBe(searchKey('Yerevan'));
    expect(searchKey('Երևան')).toBe(searchKey('erevan'));
  });
  it('treats common transliteration variants alike', () => {
    expect(searchKey('Gyumri')).toBe(searchKey('Գյումրի'));
    expect(searchKey('khach')).toBe(searchKey('xach'));
  });
  it('ignores case and punctuation', () => {
    expect(searchKey('  Board-Games!! ')).toBe('board games');
  });
});
