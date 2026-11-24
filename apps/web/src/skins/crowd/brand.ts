import type { SkinBrand } from '../../skin-types';
/** Only owner-supplied or directly evidenced brand facts belong here. */
export const brand: SkinBrand = {
  name: 'Crowd',
  facebook: '',
  instagram: '',
  // Opening hours were not supplied, so none are shown or claimed.
  hours: null,
  descriptor: 'SPECIALITY COFFEE',
  showOpenStatus: false,
  gallery: [
    'photo-carrier',
    'photo-bag-orange',
    'photo-carrier-orange',
    'photo-woman-cup',
    'photo-green-bag',
    'photo-green-cup',
    'photo-croissant-cup',
    'photo-cups-hands',
  ].map((name) => ({ src: `/assets/crowd/${name}.webp`, alt: 'galleryCoffee' })),
  assets: {
    emblem: '/assets/crowd/badge.webp',
    logo: '/assets/crowd/logo.webp',
    hero: '/assets/crowd/photo-croissant-cup.webp',
    homeHero: '/assets/crowd/photo-carrier.webp',
    breakfast: '/assets/crowd/photo-two-cups.webp',
    chocolate: '/assets/crowd/p-chocolate-cake.webp',
  },
};
export function productImage(source: string) {
  return source;
}
