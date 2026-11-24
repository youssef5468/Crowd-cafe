import { randomInt } from 'node:crypto';
import { PICKUP_CODE_ALPHABET, PICKUP_CODE_LENGTH } from '@galal/shared';

/** Random short code for a dine-in order, drawn from an alphabet with no look-alike characters. */
export function newPickupCode(): string {
  let code = '';
  for (let i = 0; i < PICKUP_CODE_LENGTH; i += 1)
    code += PICKUP_CODE_ALPHABET[randomInt(PICKUP_CODE_ALPHABET.length)];
  return code;
}
