import { describe, expect, it } from 'vitest';
import {
  PICKUP_CODE_ALPHABET,
  PICKUP_CODE_LENGTH,
  isCodeExpired,
  parsePickupCode,
  personTotals,
  statuses,
  tableOrderSchema,
} from '../packages/shared/src/index';
import { newPickupCode } from '../apps/api/src/pickup-code';

describe('pickup codes', () => {
  it('generates short codes from the unambiguous alphabet', () => {
    for (let i = 0; i < 500; i += 1) {
      const code = newPickupCode();
      expect(code).toHaveLength(PICKUP_CODE_LENGTH);
      expect([...code].every((char) => PICKUP_CODE_ALPHABET.includes(char))).toBe(true);
    }
    expect(PICKUP_CODE_ALPHABET).not.toMatch(/[01OIL]/);
  });
  it('rarely repeats', () => {
    const codes = new Set(Array.from({ length: 2000 }, () => newPickupCode()));
    expect(codes.size).toBeGreaterThan(1990);
  });
  it('reads a raw code, a spaced code and a scanned cashier link', () => {
    expect(parsePickupCode('K7M2Q9')).toBe('K7M2Q9');
    expect(parsePickupCode('  k7m 2q9 ')).toBe('K7M2Q9');
    expect(parsePickupCode('k7m-2q9')).toBe('K7M2Q9');
    expect(parsePickupCode('https://galal.example/cashier?code=K7M2Q9')).toBe('K7M2Q9');
    expect(parsePickupCode('https://galal.example/cashier?code=k7m2q9&x=1')).toBe('K7M2Q9');
  });
  it('rejects anything that is not a code', () => {
    for (const bad of [
      '',
      'ABC',
      'K7M2Q9X',
      'K7M2Q0',
      'K7M2QI',
      'https://galal.example/menu',
      '<script>',
    ])
      expect(parsePickupCode(bad)).toBeNull();
  });
  it('knows when a code expired', () => {
    const now = Date.parse('2026-11-12T12:00:00Z');
    expect(isCodeExpired('2026-11-12T12:20:00Z', now)).toBe(false);
    expect(isCodeExpired('2026-11-12T11:59:59Z', now)).toBe(true);
    expect(isCodeExpired('2026-11-12T12:00:00Z', now)).toBe(true);
    expect(isCodeExpired(null, now)).toBe(true);
  });
});

describe('group totals', () => {
  it('sums each person in order of first appearance', () => {
    expect(
      personTotals([
        { person: 'Mona', quantity: 2, unitPrice: 45 },
        { person: 'Omar', quantity: 1, unitPrice: 70 },
        { person: 'Mona', quantity: 1, unitPrice: 20 },
      ]),
    ).toEqual([
      { person: 'Mona', total: 110 },
      { person: 'Omar', total: 70 },
    ]);
  });
  it('keeps unnamed lines together and ignores padding', () => {
    expect(
      personTotals([
        { quantity: 1, unitPrice: 50 },
        { person: '  ', quantity: 2, unitPrice: 10 },
      ]),
    ).toEqual([{ person: '', total: 70 }]);
  });
});

describe('table order validation', () => {
  const line = { itemId: 'hot-coffee', variantId: 'v1', quantity: 2 };
  it('accepts a table order and defaults the optional fields', () => {
    const parsed = tableOrderSchema.parse({ tableNumber: ' 5 ', items: [line] });
    expect(parsed.tableNumber).toBe('5');
    expect(parsed.items[0].person).toBe('');
    expect(parsed.items[0].addonIds).toEqual([]);
    expect(parsed.notes).toBe('');
  });
  it('keeps the person on each line', () => {
    const parsed = tableOrderSchema.parse({
      tableNumber: 'A-12',
      items: [{ ...line, person: ' Mona ' }],
    });
    expect(parsed.items[0].person).toBe('Mona');
  });
  it('rejects bad table numbers, empty orders and absurd sizes', () => {
    expect(tableOrderSchema.safeParse({ tableNumber: '', items: [line] }).success).toBe(false);
    expect(tableOrderSchema.safeParse({ tableNumber: 'a b', items: [line] }).success).toBe(false);
    expect(tableOrderSchema.safeParse({ tableNumber: '12345678901', items: [line] }).success).toBe(
      false,
    );
    expect(tableOrderSchema.safeParse({ tableNumber: '5', items: [] }).success).toBe(false);
    expect(
      tableOrderSchema.safeParse({ tableNumber: '5', items: [{ ...line, quantity: 0 }] }).success,
    ).toBe(false);
    expect(
      tableOrderSchema.safeParse({ tableNumber: '5', items: Array(51).fill(line) }).success,
    ).toBe(false);
  });
});

describe('order statuses', () => {
  it('starts unpaid dine-in orders before the existing flow', () => {
    expect(statuses[0]).toBe('awaiting_payment');
    expect(statuses).toContain('confirmed');
  });
});
