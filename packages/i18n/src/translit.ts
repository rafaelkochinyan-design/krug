// Normalises Armenian script, Latin transliteration ("Xi cheq grancvel") and casing to one search key,
// so "Երևան", "Yerevan" and "erevan" all match. Lossy on purpose: it is a search key, not a spelling.
const ARMENIAN: Record<string, string> = {
  ա: 'a',
  բ: 'b',
  գ: 'g',
  դ: 'd',
  ե: 'e',
  զ: 'z',
  է: 'e',
  ը: 'e',
  թ: 't',
  ժ: 'zh',
  ի: 'i',
  լ: 'l',
  խ: 'x',
  ծ: 'ts',
  կ: 'k',
  հ: 'h',
  ձ: 'dz',
  ղ: 'gh',
  ճ: 'ch',
  մ: 'm',
  յ: 'y',
  ն: 'n',
  շ: 'sh',
  ո: 'o',
  չ: 'ch',
  պ: 'p',
  ջ: 'j',
  ռ: 'r',
  ս: 's',
  վ: 'v',
  տ: 't',
  ր: 'r',
  ց: 'ts',
  ւ: 'v',
  փ: 'p',
  ք: 'k',
  օ: 'o',
  ֆ: 'f',
  և: 'ev',
};

const LATIN_VARIANTS: [RegExp, string][] = [
  [/kh/g, 'x'],
  [/tz|c(?!h)/g, 'ts'],
  [/q/g, 'k'],
  [/w/g, 'v'],
  [/^ye|(?<=\s)ye/g, 'e'],
  [/ou|u/g, 'o'],
  [/[@]/g, 'e'],
];

export function searchKey(input: string): string {
  let s = input.normalize('NFC').toLowerCase();
  s = s.replace(/ու/g, 'u');
  s = Array.from(s, (ch) => ARMENIAN[ch] ?? ch).join('');
  for (const [re, to] of LATIN_VARIANTS) s = s.replace(re, to);
  return s
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
