import { MagneticButton, MagneticLink } from './motion';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import * as Dialog from '@radix-ui/react-dialog';
import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  Minus,
  X,
  ShoppingBag,
  Coffee,
  Check,
  Trash,
} from '@phosphor-icons/react';
import { type MenuItem } from '@galal/shared';
import { useCafe } from './context';
import { useCart, useUI, text, unitPrice } from './lib';
import { theme } from './theme.config';
import { brand, productImage } from './brand';
import { stickerFor } from '@skin/stickers';

export function Arrow() {
  const { ar } = useCafe();
  return <ArrowUpRight size={19} className={ar ? 'flip' : ''} />;
}
export function Reveal({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return <div className={className}>{children}</div>;
}
export function PageHeading({
  eyebrow,
  title,
  body,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
}) {
  return (
    <header className="page-heading page-heading-enter">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {body && <p className="lede">{body}</p>}
    </header>
  );
}
export function FormError({ error }: { error: unknown }) {
  return error ? (
    <p role="alert" className="form-error">
      {error instanceof Error ? error.message : String(error)}
    </p>
  ) : null;
}
export function Modal({
  open,
  onOpenChange,
  title,
  children,
  className = '',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className={`modal ${className}`} aria-describedby={undefined}>
          <div className="modal-heading">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close className="icon-button" aria-label={t('close')}>
              <X size={24} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Quantity({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="quantity">
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={value <= 1}
        aria-label={`${t('quantity')} -`}
      >
        <Minus size={15} />
      </button>
      <output aria-live="polite">{value}</output>
      <button
        type="button"
        disabled={value >= 30}
        onClick={() => onChange(value + 1)}
        aria-label={`${t('quantity')} +`}
      >
        <Plus size={15} />
      </button>
    </div>
  );
}
export function ProductCard({
  item,
  index = 0,
  variant = 'card',
}: {
  item: MenuItem;
  index?: number;
  variant?: 'card' | 'row';
}) {
  const { ar, price, branding } = useCafe();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const tone = ['rose', 'cream', 'burgundy', 'sand'][index % 4];
  const sticker = stickerFor(item, index, ar);
  if (variant === 'row')
    return (
      <>
        <article className="product-row">
          {sticker && <span className="row-sticker">{sticker}</span>}
          <button
            type="button"
            className="row-thumb"
            aria-label={`${t('details')} ${text(item, ar)}`}
            onClick={() => setOpen(true)}
          >
            <img
              src={item.image ? productImage(item.image) : branding.logo}
              alt=""
              width="160"
              height="160"
              loading="lazy"
            />
          </button>
          <div className="row-main">
            <h3>
              <button type="button" className="text-button" onClick={() => setOpen(true)}>
                {text(item, ar)}
              </button>
            </h3>
            <p className="row-desc">{ar ? item.description_ar : item.description_en}</p>
            <p className="row-price">
              {item.priceConfirmed ? (
                <>
                  {item.variants.length > 1 && <span>{t('from')} </span>}
                  <strong>{price(Math.min(...item.variants.map((v) => v.price)))}</strong>
                </>
              ) : (
                <span>{t('pricePending')}</span>
              )}
              {item.priceConfirmed && !item.available && <small> · {t('unavailable')}</small>}
            </p>
          </div>
          <button
            type="button"
            className="add-button"
            aria-label={`${t(item.priceConfirmed ? 'add' : 'details')} ${text(item, ar)}`}
            disabled={item.priceConfirmed && !item.available}
            onClick={() => setOpen(true)}
          >
            {item.priceConfirmed ? <Plus size={21} /> : <ArrowUpRight size={21} />}
          </button>
        </article>
        {open && <ProductModal item={item} open={open} onOpenChange={setOpen} />}
      </>
    );
  return (
    <>
      <Reveal className="product-card" delay={(index % 4) * theme.motion.reveal.stagger}>
        <article>
          <button
            className={`product-art ${tone}`}
            aria-label={`${t('details')} ${text(item, ar)}`}
            onClick={() => setOpen(true)}
          >
            {item.image ? (
              <img
                className="product-photo"
                src={productImage(item.image)}
                alt={text(item, ar)}
                width="600"
                height="600"
                loading="lazy"
              />
            ) : (
              <>
                <span className="art-wordmark" aria-hidden="true">
                  {branding.name}
                </span>
                <Coffee size={88} weight="thin" aria-hidden="true" />
                <span className="art-caption" aria-hidden="true">
                  {t('coffeeLabel')}
                </span>
              </>
            )}
          </button>
          <div className="product-info">
            <div>
              <h3>
                <button className="text-button" onClick={() => setOpen(true)}>
                  {text(item, ar)}
                </button>
              </h3>
              <p>
                {item.priceConfirmed ? (
                  <>
                    {t('from')}{' '}
                    <strong>{price(Math.min(...item.variants.map((v) => v.price)))}</strong>
                  </>
                ) : (
                  t('pricePending')
                )}
              </p>
            </div>
            <button
              className="add-button"
              aria-label={`${t(item.priceConfirmed ? 'add' : 'details')} ${text(item, ar)}`}
              disabled={item.priceConfirmed && !item.available}
              onClick={() => setOpen(true)}
            >
              {item.priceConfirmed ? <Plus size={21} /> : <ArrowUpRight size={21} />}
            </button>
          </div>
          {item.priceConfirmed && !item.available && <small>{t('unavailable')}</small>}
        </article>
      </Reveal>
      {open && <ProductModal item={item} open={open} onOpenChange={setOpen} />}
    </>
  );
}
function ProductModal({
  item,
  open,
  onOpenChange,
}: {
  item: MenuItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const { ar, price, branding } = useCafe();
  const [variantId, setVariant] = useState(item.variants[0].id);
  const [addonIds, setAddons] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const add = useCart((s) => s.add);
  const notify = useUI((s) => s.notify);
  const line = { item, variantId, addonIds, quantity, notes };
  if (!item.priceConfirmed)
    return (
      <Modal open={open} onOpenChange={onOpenChange} title={text(item, ar)}>
        <img
          className="product-modal-photo"
          src={item.image ? productImage(item.image) : branding.logo}
          alt={text(item, ar)}
          width="600"
          height="500"
        />
        <p className="lede">{ar ? item.description_ar : item.description_en}</p>
        <p className="notice">{t('collectionNote')}</p>
        {(brand.facebook || brand.instagram) && (
          <a
            className="button"
            href={brand.facebook || brand.instagram}
            target="_blank"
            rel="noreferrer"
          >
            {t('originalMenu')}
            <Arrow />
          </a>
        )}
      </Modal>
    );

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={text(item, ar)}>
      {item.image && (
        <img
          className="product-modal-photo"
          src={productImage(item.image)}
          alt={text(item, ar)}
          width="600"
          height="400"
        />
      )}
      <p className="muted">{ar ? item.description_ar : item.description_en}</p>
      <fieldset className="options">
        <legend>{t('option')}</legend>
        {item.variants.map((v) => (
          <label className="option-row" key={v.id}>
            <span>
              <input
                type="radio"
                name="variant"
                checked={variantId === v.id}
                onChange={() => setVariant(v.id)}
              />
              {text(v, ar)}
            </span>
            <strong>{price(v.price)}</strong>
          </label>
        ))}
        <small>{t('optionsNote')}</small>
      </fieldset>
      {item.addons.length > 0 && (
        <fieldset className="options">
          <legend>{t('addons')}</legend>
          {item.addons.map((a) => (
            <label className="option-row" key={a.id}>
              <span>
                <input
                  type="checkbox"
                  checked={addonIds.includes(a.id)}
                  onChange={(e) =>
                    setAddons(
                      e.target.checked ? [...addonIds, a.id] : addonIds.filter((id) => id !== a.id),
                    )
                  }
                />
                {text(a, ar)}
              </span>
              {price(a.price)}
            </label>
          ))}
        </fieldset>
      )}
      <label className="field">
        {t('notes')}
        <textarea
          maxLength={300}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('itemNotes')}
        />
      </label>
      <div className="modal-actions">
        <Quantity value={quantity} onChange={setQuantity} />
        <MagneticButton
          className="button"
          disabled={!item.available}
          onClick={() => {
            add(line);
            notify(t('added'));
            onOpenChange(false);
          }}
        >
          <ShoppingBag size={20} />
          {t('add')}
          <span>{price(unitPrice({ ...line, key: '' }) * quantity)}</span>
        </MagneticButton>
      </div>
    </Modal>
  );
}
export function Bag() {
  const { t } = useTranslation();
  const { ar, price } = useCafe();
  const { bagOpen, setBagOpen } = useUI();
  const { lines, setQuantity, remove } = useCart();
  const total = lines.reduce((sum, line) => sum + unitPrice(line) * line.quantity, 0);
  return (
    <Modal open={bagOpen} onOpenChange={setBagOpen} title={t('cart')} className="bag-modal">
      {!lines.length ? (
        <div className="empty-state">
          <Coffee size={52} weight="thin" />
          <h3>{t('emptyBag')}</h3>
          <p>{t('emptyBagText')}</p>
          <MagneticLink className="button" to="/menu" onClick={() => setBagOpen(false)}>
            {t('explore')}
            <Arrow />
          </MagneticLink>
        </div>
      ) : (
        <>
          <div className="bag-lines">
            {lines.map((line) => (
              <div className="bag-line" key={line.key}>
                <div className="bag-icon">
                  <Coffee size={30} />
                </div>
                <div className="bag-line-main">
                  <h3>{text(line.item, ar)}</h3>
                  <p>
                    {text(
                      line.item.variants.find((v) => v.id === line.variantId)!,
                      ar,
                    )}
                    {line.addonIds.length > 0 &&
                      ` + ${line.item.addons
                        .filter((a) => line.addonIds.includes(a.id))
                        .map((a) => text(a, ar))
                        .join(', ')}`}
                  </p>
                  {line.notes && <small>{line.notes}</small>}
                  <Quantity
                    value={line.quantity}
                    onChange={(value) => setQuantity(line.key, value)}
                  />
                </div>
                <div className="bag-line-end">
                  <strong>{price(unitPrice(line) * line.quantity)}</strong>
                  <button
                    className="icon-button"
                    aria-label={`${t('remove')} ${text(line.item, ar)}`}
                    onClick={() => remove(line.key)}
                  >
                    <Trash size={19} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="totals">
            <span>{t('subtotal')}</span>
            <strong>{price(total)}</strong>
          </div>
          <MagneticLink className="button wide" to="/table-order" onClick={() => setBagOpen(false)}>
            {t('checkout')}
            <ArrowRight size={20} />
          </MagneticLink>
        </>
      )}
    </Modal>
  );
}
export function SuccessMark() {
  return (
    <span className="success-mark">
      <Check size={38} />
    </span>
  );
}
