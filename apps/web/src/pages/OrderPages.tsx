import { MagneticLink, MagneticButton, MagneticAnchor } from '../motion';
import { useState } from 'react';
import { type z } from 'zod';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  orderSchema,
  reservationSchema,
  cairoDate,
  type OrderInput,
  type OrderRecord,
  type Zone,
  type ReservationInput,
  type ReservationRecord,
} from '@galal/shared';
import { hasBranchLocation } from '@galal/shared/runtime';
import { useCafe, useUser } from '../context';
import { api, text, useCart, unitPrice } from '../lib';
import { Arrow, FormError, PageHeading, SuccessMark } from '../components';
import { BranchCard, BranchPending } from './PublicPages';
import { Hours } from '../Hours';
import { SelectInput } from '../SelectInput';

export function Checkout() {
  const { t } = useTranslation();
  const { data, ar, price } = useCafe();
  const cart = useCart();
  const navigate = useNavigate();
  const user = useUser();
  const zones = useQuery({ queryKey: ['zones'], queryFn: () => api<Zone[]>('/delivery-zones') });
  const [fulfillment, setFulfillment] = useState<'pickup' | 'delivery'>('pickup');
  const [discount, setDiscount] = useState(0);
  const [appliedCode, setAppliedCode] = useState('');
  const [promo, setPromo] = useState('');
  const form = useForm<z.input<typeof orderSchema>, unknown, OrderInput>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      name: user.data?.name ?? '',
      phone: '',
      fulfillment: 'pickup',
      branchId: data.branches[0]?.id ?? '',
      zoneId: '',
      address: '',
      notes: '',
      promoCode: '',
      payment: 'pickup',
      items: cart.lines.map((line) => ({
        itemId: line.item.id,
        variantId: line.variantId,
        addonIds: line.addonIds,
        quantity: line.quantity,
        notes: line.notes,
      })),
    },
  });
  const subtotal = cart.lines.reduce((sum, line) => sum + unitPrice(line) * line.quantity, 0);
  const branchId = form.watch('branchId');
  const branch = data.branches.find((location) => location.id === branchId);
  const zoneId = form.watch('zoneId');
  const zone = zones.data?.find((z) => z.id === zoneId);
  const fee = fulfillment === 'delivery' ? (zone?.fee ?? 0) : 0;
  const promoMutation = useMutation({
    mutationFn: () =>
      api<{ discount: number }>('/promo/validate', {
        method: 'POST',
        body: JSON.stringify({ code: promo, subtotal }),
      }),
    onSuccess: (result) => {
      setDiscount(result.discount);
      setAppliedCode(promo);
      form.setValue('promoCode', promo);
    },
  });
  const mutation = useMutation({
    mutationFn: (input: OrderInput) =>
      api<OrderRecord>('/orders', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: (order) => {
      cart.clear();
      navigate(`/order/${order.id}?token=${order.accessToken}`, { replace: true });
    },
  });
  if (!data.branches.length)
    return (
      <div className="container section">
        <PageHeading title={t('checkoutTitle')} body={t('setupNotice')} />
        <BranchPending />
      </div>
    );
  if (!cart.lines.length)
    return (
      <div className="state-screen">
        <h1>{t('emptyBag')}</h1>
        <MagneticLink className="button" to="/menu">
          {t('explore')}
          <Arrow />
        </MagneticLink>
      </div>
    );
  return (
    <div className="container section-bottom">
      <PageHeading eyebrow={t('checkout')} title={t('checkoutTitle')} body={t('checkoutText')} />
      {data.settings.previewMode && <p className="notice">{t('preview')}</p>}
      <div className="checkout-grid">
        <form
          className="form-panel"
          onSubmit={form.handleSubmit((input) => mutation.mutate(input))}
        >
          <div className="fulfillment">
            <button
              type="button"
              aria-pressed={fulfillment === 'pickup'}
              className={fulfillment === 'pickup' ? 'selected' : ''}
              onClick={() => {
                setFulfillment('pickup');
                form.setValue('fulfillment', 'pickup');
                form.setValue('payment', 'pickup');
              }}
            >
              {t('pickup')}
            </button>
            <button
              type="button"
              aria-pressed={fulfillment === 'delivery'}
              className={fulfillment === 'delivery' ? 'selected' : ''}
              disabled={!zones.data?.length}
              onClick={() => {
                setFulfillment('delivery');
                form.setValue('fulfillment', 'delivery');
                form.setValue('payment', 'cash');
              }}
            >
              {t('delivery')}
            </button>
          </div>
          {!zones.data?.length && <p className="muted text-sm">{t('deliveryUnavailable')}</p>}
          <div className="form-row">
            <label className="field">
              {t('name')}
              <input
                autoComplete="name"
                {...form.register('name')}
                required
                minLength={2}
                maxLength={100}
              />
              {form.formState.errors.name && (
                <small role="alert">{form.formState.errors.name.message}</small>
              )}
            </label>
            <label className="field">
              {t('phone')}
              <input
                dir="ltr"
                type="tel"
                autoComplete="tel"
                placeholder="01xxxxxxxxx"
                {...form.register('phone')}
                required
              />
              {form.formState.errors.phone && (
                <small role="alert">{form.formState.errors.phone.message}</small>
              )}
            </label>
          </div>
          <label className="field">
            {t('branch')}
            <Controller
              name="branchId"
              control={form.control}
              render={({ field }) => (
                <SelectInput
                  ref={field.ref}
                  name={field.name}
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  aria-label={t('branch')}
                  options={data.branches.map((branch) => ({
                    value: branch.id,
                    label: text(branch, ar),
                  }))}
                />
              )}
            />
          </label>
          {fulfillment === 'pickup' && branch && !hasBranchLocation(branch) && (
            <p className="muted text-sm">{t('pickupLocationPending')}</p>
          )}
          {fulfillment === 'delivery' && (
            <>
              <label className="field">
                {t('zone')}
                <Controller
                  name="zoneId"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <SelectInput
                      ref={field.ref}
                      name={field.name}
                      value={field.value ?? ''}
                      onValueChange={field.onChange}
                      onBlur={field.onBlur}
                      required
                      aria-label={t('zone')}
                      aria-invalid={!!fieldState.error}
                      options={(zones.data ?? []).map((zone) => ({
                        value: zone.id,
                        label: `${text(zone, ar)} (${price(zone.fee)})`,
                      }))}
                    />
                  )}
                />
                {zone && (
                  <small>
                    {t('minimum')}: {price(zone.minimum)}
                  </small>
                )}
              </label>
              {!!user.data?.addresses.length && (
                <label className="field">
                  {t('savedAddress')}
                  <SelectInput
                    aria-label={t('savedAddress')}
                    onValueChange={(value) => {
                      const address = user.data?.addresses[Number(value)];
                      if (address) form.setValue('address', address.address);
                    }}
                    options={user.data.addresses.map((address, index) => ({
                      value: String(index),
                      label: address.label,
                    }))}
                  />
                </label>
              )}
              <label className="field">
                {t('fullAddress')}
                <textarea {...form.register('address')} required minLength={10} maxLength={500} />
                {form.formState.errors.address && (
                  <small role="alert">{form.formState.errors.address.message}</small>
                )}
              </label>
            </>
          )}
          <label className="field">
            {t('orderNotes')}
            <textarea {...form.register('notes')} maxLength={500} />
          </label>
          <p className="notice">{t(fulfillment === 'pickup' ? 'payPickup' : 'payCash')}</p>
          <FormError error={mutation.error} />
          {Object.keys(form.formState.errors).length > 0 && (
            <p role="alert" className="form-error">
              {t('required')}
            </p>
          )}
          <MagneticButton
            className="button wide"
            disabled={
              mutation.isPending ||
              !navigator.onLine ||
              (fulfillment === 'delivery' && (!zone || subtotal < zone.minimum))
            }
          >
            {t(
              mutation.isPending
                ? 'sending'
                : data.settings.previewMode
                  ? 'placeDemo'
                  : 'placeOrder',
            )}
            <Arrow />
          </MagneticButton>
        </form>
        <aside className="form-panel order-summary">
          <h2>{t('orderSummary')}</h2>
          {cart.lines.map((line) => (
            <div className="summary-item" key={line.key}>
              <div>
                <strong>
                  {line.quantity} × {text(line.item, ar)}
                </strong>
                <small>
                  {text(
                    line.item.variants.find((v) => v.id === line.variantId)!,
                    ar,
                  )}
                </small>
                {line.notes && <small>{line.notes}</small>}
              </div>
              <strong>{price(unitPrice(line) * line.quantity)}</strong>
            </div>
          ))}
          <div className="promo-row">
            <label className="field">
              {t('promo')}
              <input
                value={promo}
                onChange={(e) => {
                  setPromo(e.target.value);
                  setDiscount(0);
                  setAppliedCode('');
                  form.setValue('promoCode', '');
                }}
                maxLength={30}
              />
            </label>
            <MagneticButton
              type="button"
              className="button secondary"
              disabled={!promo || promoMutation.isPending}
              onClick={() => promoMutation.mutate()}
            >
              {t('apply')}
            </MagneticButton>
          </div>
          <FormError error={promoMutation.error} />
          <div className="totals">
            <span>{t('subtotal')}</span>
            <strong>{price(subtotal)}</strong>
          </div>
          <div className="totals">
            <span>{t('deliveryFee')}</span>
            <strong>{price(fee)}</strong>
          </div>
          {appliedCode && (
            <div className="totals">
              <span>
                {t('discount')} ({appliedCode})
              </span>
              <strong>-{price(discount)}</strong>
            </div>
          )}
          <div className="totals total">
            <span>{t('total')}</span>
            <strong>{price(subtotal + fee - discount)}</strong>
          </div>
        </aside>
      </div>
    </div>
  );
}
export function Tracking() {
  const { t } = useTranslation();
  const { ar, price, data } = useCafe();
  const { id } = useParams();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const query = useQuery({
    queryKey: ['order', id, token],
    queryFn: () => api<OrderRecord>(`/orders/${id}?token=${encodeURIComponent(token)}`),
    refetchInterval: (query) =>
      ['completed', 'cancelled'].includes(query.state.data?.status ?? '') ? false : 5000,
    retry: false,
  });
  if (query.isPending) return <div className="state-screen">{t('loading')}</div>;
  if (query.isError)
    return (
      <div className="state-screen">
        <FormError error={query.error} />
        <MagneticLink className="button" to="/menu">
          {t('viewMenu')}
        </MagneticLink>
      </div>
    );
  const order = query.data;
  const steps =
    order.fulfillment === 'delivery'
      ? ['received', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'completed']
      : ['received', 'confirmed', 'preparing', 'ready', 'completed'];
  const branch = data.branches.find((b) => b.id === order.branchId);
  return (
    <div className="container section">
      <div className="tracking-card">
        <div className="tracking-head">
          <SuccessMark />
          <h1>{t('orderReceived')}</h1>
          <p>{t('orderReceivedText')}</p>
          <p className="tracking-reference">
            {t('orderNumber')} #{order.id.slice(-8).toUpperCase()}
          </p>
        </div>
        {order.demo && <p className="notice">{t('testOrder')}</p>}
        {order.fulfillment === 'pickup' && branch && !hasBranchLocation(branch) && !order.demo && (
          <p className="notice">{t('pickupLocationPending')}</p>
        )}
        <div className="form-panel">
          <h2>{t(order.status)}</h2>
          <p className="muted text-sm">{t('statusText')}</p>
          {order.status !== 'cancelled' && (
            <ol className="status-stepper">
              {steps.map((step, index) => (
                <li
                  key={step}
                  className={
                    order.status === step
                      ? 'active'
                      : steps.indexOf(order.status) > index
                        ? 'done'
                        : ''
                  }
                >
                  {t(step)}
                </li>
              ))}
            </ol>
          )}
          {order.items.map((line, index) => (
            <div className="summary-item" key={index}>
              <div>
                <strong>
                  {line.quantity} × {ar ? line.name_ar : line.name_en}
                </strong>
                <small>{ar ? line.variant_ar : line.variant_en}</small>
                {line.addons.length > 0 && <small>{line.addons.join(', ')}</small>}
                {line.notes && <small>{line.notes}</small>}
              </div>
              <strong>{price(line.unitPrice * line.quantity)}</strong>
            </div>
          ))}
          <div className="totals">
            <span>{t('subtotal')}</span>
            <strong>{price(order.subtotal)}</strong>
          </div>
          <div className="totals">
            <span>{t('deliveryFee')}</span>
            <strong>{price(order.fee)}</strong>
          </div>
          {order.discount > 0 && (
            <div className="totals">
              <span>{t('discount')}</span>
              <strong>-{price(order.discount)}</strong>
            </div>
          )}
          <div className="totals total">
            <span>{t('total')}</span>
            <strong>{price(order.total)}</strong>
          </div>
          <p className="muted text-sm">
            {t(order.fulfillment === 'pickup' ? 'payPickup' : 'payCash')}
          </p>
          {order.address && <p className="text-sm">{order.address}</p>}
          {order.notes && <p className="text-sm">{order.notes}</p>}
        </div>
        <div className="tracking-actions">
          <MagneticLink className="button" to="/menu">
            {t('newOrder')}
            <Arrow />
          </MagneticLink>
          {data.settings.whatsappEnabled && branch?.phone && (
            <MagneticAnchor
              className="text-link"
              href={`https://wa.me/${branch.phone.replace('+', '')}?text=${encodeURIComponent(`${order.demo ? 'TEST / ' : ''}${t('orderNumber')} #${order.id.slice(-8)} - ${price(order.total)}`)}`}
              target="_blank"
              rel="noreferrer"
            >
              {t('shareWhatsapp')}
            </MagneticAnchor>
          )}
        </div>
      </div>
    </div>
  );
}
export function Reservations() {
  const { t } = useTranslation();
  const { data, ar } = useCafe();
  const branches = data.branches.filter(hasBranchLocation);
  const [reservation, setReservation] = useState<ReservationRecord | null>(null);
  const form = useForm<z.input<typeof reservationSchema>, unknown, ReservationInput>({
    resolver: zodResolver(reservationSchema),
    defaultValues: {
      name: '',
      phone: '',
      branchId: branches[0]?.id ?? '',
      date: cairoDate(),
      time: '',
      partySize: 2,
      notes: '',
    },
  });
  const mutation = useMutation({
    mutationFn: (values: ReservationInput) =>
      api<ReservationRecord>('/reservations', { method: 'POST', body: JSON.stringify(values) }),
    onSuccess: setReservation,
  });
  if (!branches.length)
    return (
      <div className="container section-bottom">
        <PageHeading title={t('reservationTitle')} body={t('bookingSoon')} />
        <div className="contact-grid">
          <BranchPending />
          <Hours />
        </div>
      </div>
    );
  if (reservation)
    return (
      <div className="state-screen">
        <SuccessMark />
        <h1>{t('reservationSent')}</h1>
        <p>{t('reservationPending')}</p>
        {reservation.demo && <p className="notice">{t('testReservation')}</p>}
        <p className="tracking-reference">
          {t('reference')}: {reservation.id.slice(-8).toUpperCase()}
          <br />
          {reservation.date} / {reservation.time}
        </p>
        <MagneticLink className="button" to="/menu">
          {t('explore')}
          <Arrow />
        </MagneticLink>
      </div>
    );
  return (
    <div className="container section">
      <div className="reservation-grid">
        <div className="reservation-intro">
          <p className="eyebrow">{t('reserve')}</p>
          <h1>{t('reservationTitle')}</h1>
          <p className="lede">{t('reservationSubtitle')}</p>
          {branches[0] && (
            <div className="mt-8">
              <BranchCard branch={branches[0]} />
            </div>
          )}
        </div>
        <form
          className="form-panel"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          {data.settings.previewMode && <p className="notice">{t('preview')}</p>}
          <div className="form-row">
            <label className="field">
              {t('name')}
              <input
                {...form.register('name')}
                required
                minLength={2}
                maxLength={100}
                autoComplete="name"
              />
            </label>
            <label className="field">
              {t('phone')}
              <input
                {...form.register('phone')}
                type="tel"
                dir="ltr"
                required
                placeholder="01xxxxxxxxx"
                autoComplete="tel"
              />
            </label>
          </div>
          <label className="field">
            {t('branch')}
            <Controller
              name="branchId"
              control={form.control}
              render={({ field }) => (
                <SelectInput
                  ref={field.ref}
                  name={field.name}
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  aria-label={t('branch')}
                  options={branches.map((branch) => ({
                    value: branch.id,
                    label: text(branch, ar),
                  }))}
                />
              )}
            />
          </label>
          <div className="form-row">
            <label className="field">
              {t('date')}
              <input
                type="date"
                {...form.register('date')}
                min={cairoDate()}
                max={new Date(Date.now() + 90 * 86401000).toISOString().slice(0, 10)}
                required
              />
            </label>
            <label className="field">
              {t('time')}
              <input type="time" {...form.register('time')} step={900} required />
            </label>
          </div>
          <label className="field">
            {t('partySize')}
            <Controller
              name="partySize"
              control={form.control}
              render={({ field }) => (
                <SelectInput
                  ref={field.ref}
                  name={field.name}
                  value={String(field.value ?? 2)}
                  onValueChange={(value) => field.onChange(Number(value))}
                  onBlur={field.onBlur}
                  aria-label={t('partySize')}
                  options={Array.from({ length: 12 }, (_, index) => ({
                    value: String(index + 1),
                    label: new Intl.NumberFormat(ar ? 'ar-EG' : 'en-EG').format(index + 1),
                  }))}
                />
              )}
            />
          </label>
          <label className="field">
            {t('reservationNotes')}
            <textarea {...form.register('notes')} maxLength={500} />
          </label>
          {Object.values(form.formState.errors).map((error, index) => (
            <FormError key={index} error={error.message} />
          ))}
          <FormError error={mutation.error} />
          <MagneticButton className="button wide" disabled={mutation.isPending}>
            {t(mutation.isPending ? 'sending' : 'sendRequest')}
            <Arrow />
          </MagneticButton>
        </form>
      </div>
    </div>
  );
}
