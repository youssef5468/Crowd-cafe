import type { Branch } from './index.js';

export function hasBranchLocation(branch: Pick<Branch, 'lat' | 'lng'>): boolean {
  return branch.lat !== null && branch.lng !== null;
}

export function cairoDate(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
export function isOpen(branch: Branch, ramadan = false, now = new Date()): boolean {
  const clock = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Cairo',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(now);
  const open = ramadan && branch.ramadanOpen ? branch.ramadanOpen : branch.open;
  const close = ramadan && branch.ramadanClose ? branch.ramadanClose : branch.close;
  return (
    open === close ||
    (open < close ? clock >= open && clock < close : clock >= open || clock < close)
  );
}
