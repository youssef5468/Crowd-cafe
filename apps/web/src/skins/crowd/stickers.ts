import type { MenuItem } from '@crowd/shared';

// The three labels Crowd already uses on its posts.
const labels = {
  en: ['For the creatives', 'For the indulgers', 'For the fast-paced'],
  ar: ['للمبدعين', 'للمدلّعين', 'للي ماشيين بسرعة'],
};
/** Small sticker on a menu card: shown on the featured items, rotating through the labels. */
export function stickerFor(item: MenuItem, index: number, ar: boolean): string | null {
  return item.featured ? labels[ar ? 'ar' : 'en'][index % 3] : null;
}
