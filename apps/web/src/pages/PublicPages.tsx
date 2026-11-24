import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  MagnifyingGlass,
  SlidersHorizontal,
  Coffee,
  MapPin,
  Clock,
  Phone,
  ArrowUpRight,
} from '@phosphor-icons/react';
import { type Branch } from '@galal/shared';
import { hasBranchLocation, isOpen } from '@galal/shared/runtime';
import { ContactLinks } from '../ContactLinks';
import { SelectInput } from '../SelectInput';
import { useCafe } from '../context';
import { api, text } from '../lib';
import { Arrow, PageHeading, ProductCard, FormError, Modal } from '../components';
import { Hours } from '../Hours';
import { brand } from '../brand';
import { TableChip } from '../nav';

export function Menu() {
  const { t } = useTranslation();
  const { data, ar } = useCafe();
  const [params] = useSearchParams();
  const [category, setCategory] = useState(params.get('category') || 'all');
  const [search, setSearch] = useState('');
  const [temperature, setTemperature] = useState('all');
  const [filters, setFilters] = useState(false);
  const hasPrices = data.items.some((item) => item.priceConfirmed);
  const canOrder =
    !data.settings.previewMode &&
    data.branches.length > 0 &&
    data.items.some((item) => item.priceConfirmed && item.available);
  const items = data.items.filter(
    (item) =>
      (category === 'all' || item.categoryId === category) &&
      (temperature === 'all' || item.temperature === temperature) &&
      `${item.name_en} ${item.name_ar}`.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const grouped = category === 'all' && temperature === 'all' && !search.trim();
  const known = new Set(data.categories.map((c) => c.id));
  const groups = [...data.categories]
    .sort((a, b) => a.sort - b.sort)
    .map((c) => ({ category: c, list: items.filter((item) => item.categoryId === c.id) }))
    .filter((group) => group.list.length > 0);
  const orphans = items.filter((item) => !known.has(item.categoryId));
  return (
    <div className="container menu-page section-bottom">
      <TableChip className="menu-table-chip" />
      <PageHeading
        title={t('menuPageTitle')}
        body={t(canOrder ? 'menuOrderText' : hasPrices ? 'menuPricedText' : 'menuPageText')}
      />
      <div className="menu-toolbar glass">
        <div className="category-tabs" role="group" aria-label={t('categories')}>
          {[{ id: 'all', name_en: t('all'), name_ar: t('all') }, ...data.categories].map((c) => (
            <button
              key={c.id}
              aria-pressed={category === c.id}
              className={category === c.id ? 'selected' : ''}
              onClick={() => setCategory(c.id)}
            >
              {text(c, ar)}
            </button>
          ))}
        </div>
        <div className="search-controls">
          <label className="search-field">
            <MagnifyingGlass size={19} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('search')}
              aria-label={t('search')}
            />
          </label>
          <button
            className="icon-button filter-button"
            aria-label={t('filters')}
            aria-expanded={filters}
            onClick={() => setFilters(!filters)}
          >
            <SlidersHorizontal size={22} />
          </button>
        </div>
      </div>
      {filters && (
        <div className="filter-panel">
          <label>
            {t('hot')} / {t('cold')}
            <SelectInput
              value={temperature}
              onValueChange={setTemperature}
              aria-label={`${t('hot')} / ${t('cold')}`}
              options={[
                { value: 'all', label: t('all') },
                { value: 'hot', label: t('hot') },
                { value: 'cold', label: t('cold') },
              ]}
            />
          </label>
          <button
            className="text-link"
            onClick={() => {
              setTemperature('all');
              setCategory('all');
              setSearch('');
            }}
          >
            {t('clear')}
          </button>
        </div>
      )}
      <p className="sr-only" role="status">
        {items.length} {t('items')}
      </p>
      <div className="menu-list">
        {grouped ? (
          <>
            {groups.map(({ category: c, list }) => (
              <section key={c.id} className="menu-group" aria-labelledby={`group-${c.id}`}>
                <h2 id={`group-${c.id}`}>{text(c, ar)}</h2>
                {list.map((item, index) => (
                  <ProductCard key={item.id} item={item} index={index} variant="row" />
                ))}
              </section>
            ))}
            {orphans.length > 0 && (
              <section className="menu-group">
                {orphans.map((item, index) => (
                  <ProductCard key={item.id} item={item} index={index} variant="row" />
                ))}
              </section>
            )}
          </>
        ) : (
          items.map((item, index) => (
            <ProductCard key={item.id} item={item} index={index} variant="row" />
          ))
        )}
      </div>
      {!items.length && (
        <div className="empty-state">
          <Coffee size={40} />
          <h2>{t('noItems')}</h2>
          <p>{t('noItemsText')}</p>
          <button
            className="button"
            onClick={() => {
              setCategory('all');
              setSearch('');
              setTemperature('all');
            }}
          >
            {t('clear')}
          </button>
        </div>
      )}
      <div className="menu-source">
        {!hasPrices && <p>{t('collectionNote')}</p>}
        <a className="text-link" href={brand.facebook} target="_blank" rel="noreferrer">
          {t('originalMenu')}
          <Arrow />
        </a>
      </div>
    </div>
  );
}
export function BranchCard({ branch }: { branch: Branch }) {
  const { t } = useTranslation();
  const { ar, data } = useCafe();
  const hasLocation = hasBranchLocation(branch);
  const whatsappPhone = data.settings.whatsappEnabled ? branch.phone : null;
  const [open, setOpen] = useState(() => isOpen(branch, data.settings.ramadanMode));
  useEffect(() => {
    const timer = setInterval(() => setOpen(isOpen(branch, data.settings.ramadanMode)), 60000);
    return () => clearInterval(timer);
  }, [branch, data.settings.ramadanMode]);
  const hours =
    (data.settings.ramadanMode && branch.ramadanOpen ? branch.ramadanOpen : branch.open) +
    ' - ' +
    (data.settings.ramadanMode && branch.ramadanClose ? branch.ramadanClose : branch.close);
  return (
    <div className="branch-card">
      <div className="branch-title">
        <h3>{text(branch, ar)}</h3>
        <span className="open-badge">{t(open ? 'openNow' : 'closedNow')}</span>
      </div>
      <div className="branch-detail">
        <MapPin size={21} />
        <p>{ar ? branch.address_ar : branch.address_en}</p>
      </div>
      <div className="branch-detail">
        <Clock size={21} />
        <p>
          <span dir="ltr">{hours}</span>
          <small>{t('nextDay')}</small>
        </p>
      </div>
      {branch.phone && (
        <div className="branch-detail">
          <Phone size={20} />
          <a href={`tel:${branch.phone}`} dir="ltr">
            {branch.phone}
          </a>
        </div>
      )}
      {!hasLocation && <p>{t('pickupLocationPending')}</p>}
      {(hasLocation || whatsappPhone) && (
        <div className="branch-actions">
          {hasLocation && (
            <a
              className="button"
              href={`https://www.google.com/maps/dir/?api=1&destination=${branch.lat},${branch.lng}`}
              target="_blank"
              rel="noreferrer"
            >
              {t('directions')}
              <Arrow />
            </a>
          )}
          {whatsappPhone && (
            <a
              className="text-link"
              href={`https://wa.me/${whatsappPhone.replace('+', '')}`}
              target="_blank"
              rel="noreferrer"
            >
              {t('whatsapp')}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
export function BranchPending() {
  const { t } = useTranslation();
  return (
    <div className="branch-pending">
      <MapPin size={30} />
      <h2>{t('branchPending')}</h2>
      <p>{t('branchPendingBody')}</p>
      <a className="button" href={brand.facebook} target="_blank" rel="noreferrer">
        {t('facebookAction')}
        <Arrow />
      </a>
    </div>
  );
}
export function About() {
  const { t } = useTranslation();
  const { data, ar } = useCafe();
  return (
    <div className="container section-bottom">
      <PageHeading title={t('aboutTitle')} body={t('aboutSubtitle')} />
      <div className="about-grid">
        <div className="about-logo">
          <img src={brand.assets.logo} alt={t('galleryLogo')} width="960" height="960" />
        </div>
        <div className="about-body">
          <h2>{t('brandIntro')}</h2>
          <p className="lede">{ar ? data.settings.about_ar : data.settings.about_en}</p>
          <p>{t('aboutBody')}</p>
          <Link className="button" to="/menu">
            {t('explore')}
            <Arrow />
          </Link>
        </div>
      </div>
      <div className="about-hours">
        <Hours />
      </div>
    </div>
  );
}
const gallery = brand.gallery;
export function Gallery() {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <div className="container section-bottom">
      <PageHeading title={t('galleryTitle')} body={t('galleryText')} />
      <p className="notice">{t('archiveNote')}</p>
      <div className="gallery-grid">
        {gallery.map((item, i) => (
          <figure key={item.src}>
            <button
              className="gallery-image"
              aria-label={`${t('details')}: ${t(item.alt)} ${i + 1}`}
              onClick={() => setSelected(i)}
            >
              <img src={item.src} alt={t(item.alt)} width="675" height="844" loading="lazy" />
            </button>
            <figcaption>
              {t('galleryCampaign')}
              <ArrowUpRight size={17} />
            </figcaption>
          </figure>
        ))}
      </div>
      {selected !== null && (
        <Modal
          open
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
          title={t(gallery[selected].alt)}
          className="gallery-modal"
        >
          <img src={gallery[selected].src} alt={t(gallery[selected].alt)} />
          <p className="muted">{t('archiveNote')}</p>
        </Modal>
      )}
    </div>
  );
}
export function Branches() {
  const { t } = useTranslation();
  const { data } = useCafe();
  return (
    <div className="container section-bottom">
      <PageHeading title={t('branches')} body={t('contactText')} />
      {data.branches.length ? (
        <div className="branch-grid">
          {data.branches.map((branch) => (
            <BranchCard key={branch.id} branch={branch} />
          ))}
        </div>
      ) : (
        <BranchPending />
      )}
      <div className="about-hours">
        <Hours />
      </div>
    </div>
  );
}
export function Contact() {
  const { t } = useTranslation();
  const { data, ar } = useCafe();
  const branch = data.branches.find(hasBranchLocation);
  return (
    <div className="container section-bottom">
      <PageHeading title={t('contactTitle')} body={t('contactText')} />
      <div className="contact-grid">
        <div className="contact-details">
          {data.branches.length ? (
            data.branches.map((branch) => <BranchCard key={branch.id} branch={branch} />)
          ) : (
            <BranchPending />
          )}
          <ContactLinks includeWhatsapp={false} />
        </div>
        {branch ? (
          <iframe
            className="map contact-map"
            title={t('mapTitle')}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
            src={`https://maps.google.com/maps?q=${branch.lat},${branch.lng}&z=16&hl=${ar ? 'ar' : 'en'}&output=embed`}
          />
        ) : (
          <Hours />
        )}
      </div>
    </div>
  );
}
export function Events() {
  const { t } = useTranslation();
  const { ar } = useCafe();
  type CafeEvent = {
    id: string;
    name_en: string;
    name_ar: string;
    description_en: string;
    description_ar: string;
    date: string;
  };
  const query = useQuery({ queryKey: ['events'], queryFn: () => api<CafeEvent[]>('/events') });
  return (
    <div className="container section-bottom">
      <PageHeading title={t('eventsTitle')} body={t('eventsText')} />
      {query.isPending ? (
        <p>{t('loading')}</p>
      ) : query.isError ? (
        <FormError error={query.error} />
      ) : query.data.length ? (
        <div className="event-list">
          {query.data.map((event) => (
            <article key={event.id}>
              <time>{event.date}</time>
              <h2>{text(event, ar)}</h2>
              <p>{ar ? event.description_ar : event.description_en}</p>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Coffee size={48} />
          <h2>{t('noEvents')}</h2>
          <a className="button" href={brand.facebook} target="_blank" rel="noreferrer">
            {t('facebookAction')}
            <Arrow />
          </a>
        </div>
      )}
    </div>
  );
}
export function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="state-screen">
      <Coffee size={54} />
      <h1>{t('notFound')}</h1>
      <Link to="/" className="button">
        {t('goHome')}
        <Arrow />
      </Link>
    </div>
  );
}
