import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { crowdCategories, crowdItems } from '../packages/shared/src/index';
import { theme as crowdTheme } from '../apps/web/src/skins/crowd/theme';
import { brand as crowdBrand } from '../apps/web/src/skins/crowd/brand';
import { copy as crowdCopy } from '../apps/web/src/skins/crowd/copy';

function luminance(hex: string) {
  const rgb = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((value) => parseInt(value, 16) / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function contrast(a: string, b: string) {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
const pub = (path: string) => resolve(__dirname, '../apps/web/public', path.replace(/^\//, ''));

describe('crowd theme: WCAG AA text contrast', () => {
  const theme = crowdTheme;
  for (const mode of ['light', 'dark'] as const)
    for (const [fg, bg] of [
      ['text', 'bg'],
      ['text', 'surface'],
      ['muted', 'bg'],
      ['muted', 'surface'],
      ['muted', 'cream'],
      ['primary', 'cream'],
      ['primary', 'soft'],
      ['onPrimary', 'primary'],
      ['accent', 'bg'],
      ['accent', 'surface'],
    ] as const)
      it(`${mode}: ${fg} on ${bg}`, () => {
        const colors = theme.colors[mode] as Record<string, string>;
        expect(contrast(colors[fg], colors[bg])).toBeGreaterThanOrEqual(4.5);
      });
});

describe('crowd brand', () => {
  const brand = crowdBrand;
  it('points at images that exist', () => {
    for (const path of [...Object.values(brand.assets), ...brand.gallery.map((g) => g.src)])
      expect(existsSync(pub(path)), path).toBe(true);
  });
});

describe('crowd skin', () => {
  it('claims no opening hours it does not know', () => {
    expect(crowdBrand.hours).toBeNull();
    expect(crowdBrand.showOpenStatus).toBe(false);
  });
  it('has the same copy keys in English and Arabic', () => {
    expect(Object.keys(crowdCopy.ar).sort()).toEqual(Object.keys(crowdCopy.en).sort());
  });
  it('ships a starter menu with unique ids, real categories and existing photos', () => {
    const ids = crowdItems.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    const categories = new Set(crowdCategories.map((c) => c.id));
    for (const item of crowdItems) {
      expect(categories.has(item.categoryId), item.id).toBe(true);
      expect(existsSync(pub(item.image ?? '')), item.id).toBe(true);
      // No invented prices: items stay unconfirmed until the owner sets them.
      expect(item.priceConfirmed).toBe(false);
      expect(item.available).toBe(false);
    }
  });
});
