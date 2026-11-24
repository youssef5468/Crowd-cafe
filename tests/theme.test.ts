import { describe, it, expect } from 'vitest';
import { theme } from '../apps/web/src/theme.config';
function luminance(hex: string) {
  const rgb = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((value) => parseInt(value, 16) / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function contrast(a: string, b: string) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
describe('WCAG AA brand text contrast', () => {
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
    ] as const)
      it(`${mode}: ${fg} on ${bg}`, () =>
        expect(contrast(theme.colors[mode][fg], theme.colors[mode][bg])).toBeGreaterThanOrEqual(
          4.5,
        ));
});
