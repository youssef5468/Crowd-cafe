import { describe, it, expect } from 'vitest';
import {
  phoneSchema,
  isOpen,
  seedBranch,
  seedItems,
  orderSchema,
  defaultSettings,
} from '@galal/shared';
describe('Galal content and hours', () => {
  it('keeps unverified prices and ordering unavailable without inheriting another brand', () => {
    expect(seedItems).toHaveLength(5);
    expect(
      seedItems.every((i) => i.name_en && i.name_ar && !i.priceConfirmed && !i.available),
    ).toBe(true);
    expect(defaultSettings.facebook).toBe('https://www.facebook.com/Galalcoffee1/');
    expect(defaultSettings.previewMode).toBe(true);
    expect(seedBranch.phone).toBe('');
  });
  it('normalizes Egyptian phones and rejects invalid numbers', () => {
    expect(phoneSchema.parse('010 00000000')).toBe('+201000000000');
    expect(phoneSchema.parse('00201000000000')).toBe('+201000000000');
    expect(phoneSchema.safeParse('1234').success).toBe(false);
  });
  it('uses daily 10 AM to 3 AM hours across midnight and Cairo DST', () => {
    expect(isOpen(seedBranch, false, new Date('2026-11-05T23:30:00Z'))).toBe(true);
    expect(isOpen(seedBranch, false, new Date('2026-11-06T01:00:00Z'))).toBe(false);
    expect(isOpen(seedBranch, false, new Date('2026-11-06T07:59:00Z'))).toBe(false);
    expect(isOpen(seedBranch, false, new Date('2026-11-06T08:00:00Z'))).toBe(true);
    expect(isOpen(seedBranch, false, new Date('2026-07-06T00:00:00Z'))).toBe(false);
    expect(isOpen(seedBranch, false, new Date('2026-07-06T07:00:00Z'))).toBe(true);
  });
  it('rejects delivery without an address or zone', () => {
    expect(
      orderSchema.safeParse({
        name: 'QA Customer',
        phone: '01000000000',
        fulfillment: 'delivery',
        branchId: 'qa-branch',
        items: [{ itemId: 'qa-drink', variantId: 'qa-option', quantity: 1 }],
      }).success,
    ).toBe(false);
  });
});
