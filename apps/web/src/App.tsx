import { useEffect, useState, lazy, Suspense } from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { IconContext, ShoppingBag, Moon, Sun, ArrowUpRight } from '@phosphor-icons/react';
import { useCafe } from './context';
import { useCart, useUI } from './lib';
import { applyTheme } from './theme.config';
import { Bag } from './components';
import { ContactLinks } from './ContactLinks';
import { Hours } from './Hours';
import { brand } from './brand';
import { Home } from '@skin/Home';
import { BrandMark } from '@skin/BrandMark';
import { Decor } from '@skin/decor';
import { Menu, About, Gallery, Contact, Branches, Events, NotFound } from './pages/PublicPages';
import { CartBar, TabBar } from './nav';
import '@skin/skin.css';
const Checkout = lazy(() => import('./pages/OrderPages').then((m) => ({ default: m.Checkout })));
const Tracking = lazy(() => import('./pages/OrderPages').then((m) => ({ default: m.Tracking })));
const Reservations = lazy(() =>
  import('./pages/OrderPages').then((m) => ({ default: m.Reservations })),
);
const Account = lazy(() => import('./pages/Account').then((m) => ({ default: m.Account })));
const Admin = lazy(() => import('./pages/Admin').then((m) => ({ default: m.Admin })));
const TableOrderNew = lazy(() =>
  import('./pages/TableOrder').then((m) => ({ default: m.TableOrderNew })),
);
const TableOrderView = lazy(() =>
  import('./pages/TableOrder').then((m) => ({ default: m.TableOrderView })),
);
const Cashier = lazy(() => import('./pages/Cashier').then((m) => ({ default: m.Cashier })));
const Kitchen = lazy(() => import('./pages/Kitchen').then((m) => ({ default: m.Kitchen })));
export function App() {
  const { t, i18n } = useTranslation();
  const { data, ar, branding } = useCafe();
  const [mode, setMode] = useState<'light' | 'dark'>(() =>
    localStorage.getItem('crowd-theme') === 'dark' ? 'dark' : 'light',
  );
  const [online, setOnline] = useState(navigator.onLine);
  const location = useLocation();
  const toast = useUI((s) => s.toast);
  useEffect(() => {
    document.documentElement.lang = ar ? 'ar' : 'en';
    document.documentElement.dir = ar ? 'rtl' : 'ltr';
    localStorage.setItem('crowd-language', i18n.language);
  }, [ar, i18n.language]);
  useEffect(() => {
    applyTheme(mode, data.settings.theme);
    localStorage.setItem('crowd-theme', mode);
  }, [mode, data.settings.theme]);
  useEffect(() => {
    window.scrollTo(0, 0);
    const part = location.pathname.split('/')[1];
    document.title = `${part ? t(part === 'order' ? 'track' : part) : t('home')} | ${branding.name}`;
  }, [location.pathname, t, branding.name]);
  useEffect(() => {
    const on = () => setOnline(navigator.onLine);
    window.addEventListener('online', on);
    window.addEventListener('offline', on);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', on);
    };
  }, []);
  useEffect(() => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'CafeOrCoffeeShop',
      name: branding.name,
      sameAs: [brand.facebook, brand.instagram].filter(Boolean),
      hasMenu: `${window.location.origin}/menu`,
      ...(brand.hours && {
        openingHoursSpecification: [
          {
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: [
              'Monday',
              'Tuesday',
              'Wednesday',
              'Thursday',
              'Friday',
              'Saturday',
              'Sunday',
            ],
            opens: brand.hours.open,
            closes: brand.hours.close,
          },
        ],
      }),
    });
    document.head.appendChild(script);
    return () => script.remove();
  }, [branding.name]);
  return (
    <IconContext.Provider value={{ weight: 'regular' }}>
      <a className="skip-link" href="#main">
        {t('skipContent')}
      </a>
      {!online && (
        <div className="offline-banner" role="status">
          {t('offline')}
        </div>
      )}
      <Header mode={mode} toggleMode={() => setMode(mode === 'light' ? 'dark' : 'light')} />
      <main id="main" tabIndex={-1}>
        <Suspense fallback={<div className="state-screen">{t('loading')}</div>}>
          <Routes location={location}>
            <Route path="/" element={<Home />} />
            <Route path="/menu" element={<Menu />} />
            <Route path="/about" element={<About />} />
            <Route path="/gallery" element={<Gallery />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/branches" element={<Branches />} />
            <Route path="/events" element={<Events />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/table-order" element={<TableOrderNew />} />
            <Route path="/table-order/:id" element={<TableOrderView />} />
            <Route path="/cashier" element={<Cashier />} />
            <Route path="/kitchen" element={<Kitchen />} />
            <Route path="/order/:id" element={<Tracking />} />
            <Route path="/reservations" element={<Reservations />} />
            <Route path="/account" element={<Account />} />
            <Route path="/admin/*" element={<Admin />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
      <Bag />
      <CartBar />
      {toast && (
        <div role="status" className="toast">
          {toast}
        </div>
      )}
    </IconContext.Provider>
  );
}
function Header({ mode, toggleMode }: { mode: 'light' | 'dark'; toggleMode: () => void }) {
  const { t, i18n } = useTranslation();
  const [mobile, setMobile] = useState(false);
  const location = useLocation();
  const count = useCart((s) => s.lines.reduce((sum, line) => sum + line.quantity, 0));
  const setBagOpen = useUI((s) => s.setBagOpen);
  const isHome = location.pathname === '/';
  useEffect(() => setMobile(false), [location.pathname]);
  useEffect(() => {
    if (!mobile) return;
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobile(false);
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [mobile]);
  const links = [
    ['/', 'home'],
    ['/menu', 'menu'],
    ['/about', 'about'],
    ['/gallery', 'gallery'],
    ['/contact', 'contact'],
  ];
  return (
    <>
      <div className="announcement">
        <Hours compact />
        {brand.facebook && (
          <a href={brand.facebook} target="_blank" rel="noreferrer">
            {brand.name} <ArrowUpRight size={14} />
          </a>
        )}
      </div>
      <Decor slim={!isHome} />
      <header className={`site-header glass${isHome ? ' home-header' : ''}`}>
        <div className="header-inner container">
          <Link to="/" className="brand" aria-label={brand.name}>
            <BrandMark />
          </Link>
          <nav className="desktop-nav" aria-label={t('menu')}>
            {links.map(([to, key]) => (
              <NavLink key={to} to={to} end={to === '/'}>
                {t(key)}
              </NavLink>
            ))}
          </nav>
          <div className="header-actions">
            <button
              className="language-button"
              onClick={() => void i18n.changeLanguage(i18n.language === 'ar' ? 'en' : 'ar')}
            >
              {t('language')}
            </button>
            <button
              className="icon-button theme-button"
              onClick={toggleMode}
              aria-label={t('dark')}
            >
              {mode === 'light' ? <Moon size={19} /> : <Sun size={19} />}
            </button>
            <button
              className="bag-button bag-trigger"
              onClick={() => setBagOpen(true)}
              aria-label={`${t('cart')} ${count}`}
            >
              <ShoppingBag size={21} />
              <span className="bag-count">{count}</span>
            </button>
          </div>
        </div>
      </header>
      {mobile && (
        <nav className="mobile-nav glass" id="mobile-navigation" aria-label={t('nav')}>
          {[...links, ['/reservations', 'reserve'], ['/account', 'account']].map(([to, key]) => (
            <NavLink key={to} to={to} end={to === '/'}>
              {t(key)}
              <ArrowUpRight size={18} />
            </NavLink>
          ))}
        </nav>
      )}
      <TabBar onMore={() => setMobile((open) => !open)} moreOpen={mobile} />
    </>
  );
}
function Footer() {
  const { t, i18n } = useTranslation();
  return (
    <footer className="site-footer">
      <div className="footer-main container">
        <div>
          <Link to="/" className="brand footer-brand">
            <BrandMark />
          </Link>
          <p>{t('footerLine')}</p>
          <ContactLinks />
        </div>
        <div>
          <h3>{t('footerExplore')}</h3>
          {[
            ['/menu', 'menu'],
            ['/about', 'about'],
            ['/gallery', 'gallery'],
            ['/events', 'events'],
          ].map(([to, key]) => (
            <Link key={to} to={to}>
              {t(key)}
            </Link>
          ))}
        </div>
        <div>
          <h3>{t('openingHours')}</h3>
          <p>
            {t('daily')}
            <br />
            {t('hoursValue')}
          </p>
          <Link to="/branches">{t('branches')}</Link>
          <Link to="/reservations">{t('reserve')}</Link>
        </div>
      </div>
      <div className="footer-bottom container">
        <p>
          © {new Date().getFullYear()} {brand.name}. {t('footerRights')}
        </p>
        <div>
          <Link to="/account">{t('account')}</Link>
          <Link to="/admin">{t('admin')}</Link>
          <Link to="/cashier">{i18n.language === 'ar' ? 'الكاشير' : 'Cashier'}</Link>
          <Link to="/kitchen">{i18n.language === 'ar' ? 'الباريستا' : 'Barista'}</Link>
        </div>
      </div>
    </footer>
  );
}
