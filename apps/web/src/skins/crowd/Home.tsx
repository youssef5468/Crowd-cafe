import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapPin } from '@phosphor-icons/react';
import { useCafe } from '../../context';
import { Arrow, ProductCard } from '../../components';
import { brand } from './brand';

const A = '/assets/crowd/';
const tiles = [
  { key: 'crLovers', image: 'photo-woman-cup.webp' },
  { key: 'crIndulgers', image: 'photo-cups-hands.webp' },
  { key: 'crCreatives', image: 'photo-two-cups.webp' },
  { key: 'crFast', image: 'photo-carrier-orange.webp' },
];
const strip = ['photo-bag-orange', 'photo-green-bag', 'photo-green-cup', 'photo-carrier'];

function Band({ words }: { words: string[] }) {
  const run = Array.from({ length: 5 }, () => words).flat();
  return (
    <div className="cr-band" aria-hidden="true">
      <div className="ticker-track">
        {[0, 1].map((copy) => (
          <ul key={copy}>
            {run.map((word, index) => (
              <li key={index}>
                {word}
                <i />
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}

export function Home() {
  const { t } = useTranslation();
  const { data, ar } = useCafe();
  const [params] = useSearchParams();
  const table = params.get('table');
  // A table QR code lands on the menu, not on the story.
  if (table) return <Navigate to={`/menu?table=${encodeURIComponent(table)}`} replace />;
  const picks = data.items.filter((item) => item.featured).slice(0, 4);
  const branch = data.branches[0];
  const bandWords = ar
    ? ['قهوة', 'ناس', 'صحبة', 'ده Crowd']
    : ['Coffee', 'People', 'Connection', 'That’s Crowd'];
  return (
    <div className="cr-home">
      <section className="cr-hero" aria-labelledby="home-title">
        <div className="cr-hero-copy">
          <p className="cr-chip">{t('crTag')}</p>
          <h1 id="home-title">
            <span>{t('crHeroA')}</span> <em>{t('crHeroB')}</em>
          </h1>
          <p className="cr-lede">{t('crLede')}</p>
          <Link className="cr-cta" to="/menu">
            {t('crCta')}
            <Arrow />
          </Link>
        </div>
        <figure className="cr-hero-photo">
          <img
            src={brand.assets.hero}
            alt={t('heroCaption')}
            width="1000"
            height="1250"
            fetchPriority="high"
          />
          <span className="cr-badge">
            <img src={brand.assets.emblem} alt="" width="92" height="92" />
          </span>
          <figcaption className="cr-sticker">{t('crSticker')}</figcaption>
        </figure>
      </section>

      <Band words={bandWords} />

      <section className="cr-win" aria-labelledby="cr-win-title">
        <div className="cr-win-card">
          <div className="cr-win-copy">
            <h2 id="cr-win-title">{t('crWinTitle')}</h2>
            <p>{t('crWinSub')}</p>
            <Link className="cr-cta cr-cta-small" to="/menu">
              {t('crWinCta')}
              <Arrow />
            </Link>
          </div>
          <img
            src={`${A}p-iced-spanish-latte.webp`}
            alt=""
            width="700"
            height="645"
            loading="lazy"
          />
        </div>
      </section>

      <section className="cr-all" aria-labelledby="cr-all-title">
        <h2 id="cr-all-title">{t('crAllTitle')}</h2>
        <p className="cr-all-text">{t('crAllText')}</p>
        <ul className="cr-tiles">
          {tiles.map((tile) => (
            <li key={tile.key}>
              <Link to="/menu">
                <img src={`${A}${tile.image}`} alt="" width="600" height="750" loading="lazy" />
                <span>{t(tile.key)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="cr-baked" aria-labelledby="cr-baked-title">
        <p className="cr-ghost" aria-hidden="true">
          {Array.from({ length: 5 }, () => t('crBakedMark')).join('\n')}
        </p>
        <img
          className="cr-cut"
          src={`${A}cut-croissant.webp`}
          alt=""
          width="760"
          height="520"
          loading="lazy"
        />
        <h2 id="cr-baked-title">
          {t('crBakedA')} <em>{t('crBakedB')}</em>
        </h2>
      </section>

      {picks.length > 0 && (
        <section className="cr-picks" aria-labelledby="cr-picks-title">
          <h2 id="cr-picks-title">{t('crPicksTitle')}</h2>
          <div className="menu-list">
            {picks.map((item, index) => (
              <ProductCard key={item.id} item={item} index={index} variant="row" />
            ))}
          </div>
          <Link className="cr-cta" to="/menu">
            {t('crMenuCta')}
            <Arrow />
          </Link>
        </section>
      )}

      <section className="cr-more" aria-labelledby="cr-more-title">
        <img
          className="cr-cup"
          src={`${A}cut-black-cup.webp`}
          alt=""
          width="620"
          height="640"
          loading="lazy"
        />
        <div>
          <h2 id="cr-more-title">{t('crMoreTitle')}</h2>
          <p>{t('crMoreText')}</p>
        </div>
      </section>

      <section className="cr-gallery" aria-labelledby="cr-gallery-title">
        <h2 id="cr-gallery-title">{t('crGalleryTitle')}</h2>
        <ul className="cr-strip">
          {strip.map((name) => (
            <li key={name}>
              <img src={`${A}${name}.webp`} alt="" width="640" height="800" loading="lazy" />
            </li>
          ))}
        </ul>
      </section>

      <section className="cr-visit" aria-labelledby="cr-visit-title">
        <h2 id="cr-visit-title">{t('crVisitTitle')}</h2>
        <p>{t('crVisitText')}</p>
        {branch && (
          <p className="cr-address">
            <MapPin size={22} weight="fill" aria-hidden="true" />
            {ar ? branch.address_ar : branch.address_en}
          </p>
        )}
        <Link className="cr-cta" to="/menu">
          {t('crMenuCta')}
          <Arrow />
        </Link>
      </section>
    </div>
  );
}
