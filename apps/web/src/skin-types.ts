/** What every skin (src/skins/<name>/brand.ts) must provide. */
export type SkinBrand = {
  name: string;
  facebook: string;
  instagram: string;
  /** null when the real opening hours are not known yet: the site then shows no open/closed status. */
  hours: { open: string; close: string; timeZone: string } | null;
  descriptor: string;
  showOpenStatus: boolean;
  /** Images on the Gallery page (full paths). alt is an i18n key. */
  gallery: { src: string; alt: string }[];
  assets: {
    emblem: string;
    logo: string;
    hero: string;
    homeHero: string;
    breakfast: string;
    chocolate: string;
  };
};
