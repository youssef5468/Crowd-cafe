import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Coffee, DotsThree, House, ShoppingBag } from '@phosphor-icons/react';
import { useCafe } from './context';
import { useCart, useUI, unitPrice } from './lib';
import { useTable } from './table';

/** Phone navigation: glass tab bar fixed to the bottom of the screen. */
export function TabBar({ onMore, moreOpen }: { onMore: () => void; moreOpen: boolean }) {
  const { t } = useTranslation();
  const table = useTable();
  const count = useCart((s) => s.lines.reduce((sum, line) => sum + line.quantity, 0));
  const setBagOpen = useUI((s) => s.setBagOpen);
  const location = useLocation();
  if (['/admin', '/cashier', '/kitchen'].some((path) => location.pathname.startsWith(path)))
    return null;
  return (
    <nav className="tab-bar glass" aria-label={t('nav')}>
      <NavLink to="/" end>
        <House size={22} />
        <span>{t('home')}</span>
      </NavLink>
      <NavLink to={table ? `/menu?table=${table}` : '/menu'}>
        <Coffee size={22} />
        <span>{t('menu')}</span>
      </NavLink>
      <button
        type="button"
        className="bag-trigger"
        onClick={() => setBagOpen(true)}
        aria-label={`${t('cart')} ${count}`}
      >
        <span className="tab-icon">
          <ShoppingBag size={22} />
          {count > 0 && <b className="tab-badge">{count}</b>}
        </span>
        <span>{t('cart')}</span>
      </button>
      <button
        type="button"
        onClick={onMore}
        aria-expanded={moreOpen}
        aria-controls="mobile-navigation"
      >
        <DotsThree size={22} weight="bold" />
        <span>{t('more')}</span>
      </button>
    </nav>
  );
}

/** Floating glass cart summary over the menu, so ordering never needs a trip to the header. */
export function CartBar() {
  const { t } = useTranslation();
  const { price } = useCafe();
  const location = useLocation();
  const { lines } = useCart();
  const { bagOpen, setBagOpen } = useUI();
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);
  const total = lines.reduce((sum, line) => sum + unitPrice(line) * line.quantity, 0);
  if (!count || bagOpen || !['/', '/menu'].includes(location.pathname)) return null;
  return (
    <button type="button" className="cart-bar glass" onClick={() => setBagOpen(true)}>
      <span className="cart-bar-count">{count}</span>
      <span className="cart-bar-label">{t('viewCart')}</span>
      <strong>{price(total)}</strong>
    </button>
  );
}

/** Small chip shown when the visit started from a table QR code. */
export function TableChip({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  const table = useTable();
  if (!table) return null;
  return (
    <span className={`table-chip glass ${className}`}>{t('tableChip', { number: table })}</span>
  );
}
