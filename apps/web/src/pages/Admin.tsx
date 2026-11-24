import { useState, useEffect } from 'react';
import { SelectInput } from '../SelectInput';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { Plus, Printer, UploadSimple } from '@phosphor-icons/react';
import {
  type Category,
  type MenuItem,
  type Branch,
  type Zone,
  type Promo,
  type OrderRecord,
  type ReservationRecord,
  type ReviewRecord,
  type Settings,
  type User,
  type OrderStatus,
  seedBranch,
} from '@galal/shared';
import { hasBranchLocation } from '@galal/shared/runtime';
import { api, queryClient, text, useUI } from '../lib';
import { useCafe, useUser } from '../context';
import { PageHeading, FormError, Modal } from '../components';
import { AuthForm } from './Account';
import { theme } from '../theme.config';
import { ProductImageField } from '../ProductImageField';
import { StaffNotifications } from '../StaffNotifications';

type Entity = 'items' | 'categories' | 'branches' | 'zones' | 'promos' | 'events';
type Tab =
  | Entity
  | 'overview'
  | 'orders'
  | 'reservations'
  | 'reviews'
  | 'messages'
  | 'settings'
  | 'users'
  | 'qr';
type GenericRecord = Record<string, unknown>;
type EventRecord = {
  id: string;
  name_en: string;
  name_ar: string;
  description_en: string;
  description_ar: string;
  date: string;
};
type Overview = {
  orders: OrderRecord[];
  reservations: ReservationRecord[];
  reviews: ReviewRecord[];
  contacts: { id: string; name: string; email: string; message: string; createdAt: string }[];
  subscriberCount: number;
  zones: Zone[];
  promos: Promo[];
  events: EventRecord[];
};
type Stats = {
  revenue: number;
  orders: number;
  days: Record<string, { orders: number; revenue: number }>;
  topItems: { name: string; quantity: number }[];
};
const nextStatuses: Record<OrderStatus, OrderStatus[]> = {
  awaiting_payment: ['cancelled'],
  received: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['completed', 'out_for_delivery', 'cancelled'],
  out_for_delivery: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};
function invalidate() {
  void queryClient.invalidateQueries({ queryKey: ['admin'] });
  void queryClient.invalidateQueries({ queryKey: ['stats'] });
  void queryClient.invalidateQueries({ queryKey: ['menu'] });
  void queryClient.invalidateQueries({ queryKey: ['zones'] });
  void queryClient.invalidateQueries({ queryKey: ['events'] });
  void queryClient.invalidateQueries({ queryKey: ['reviews'] });
}
export function Admin() {
  const user = useUser();
  const { data, ar, price } = useCafe();
  const { t } = useTranslation();
  const citywideBranches = new Set(
    data.branches.filter((branch) => !hasBranchLocation(branch)).map((branch) => branch.id),
  );
  const [tab, setTab] = useState<Tab>('overview');
  const [editor, setEditor] = useState<{ entity: Entity; record: GenericRecord } | null>(null);
  const [ticket, setTicket] = useState<OrderRecord | null>(null);
  const notify = useUI((s) => s.notify);
  const authorized = !!user.data && ['owner', 'staff'].includes(user.data.role);
  const overview = useQuery({
    queryKey: ['admin'],
    queryFn: () => api<Overview>('/admin/overview'),
    enabled: authorized,
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
  });
  const stats = useQuery({
    queryKey: ['stats'],
    queryFn: () => api<Stats>('/admin/stats'),
    enabled: authorized,
  });
  const users = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api<User[]>('/admin/users'),
    enabled: authorized && user.data?.role === 'owner' && tab === 'users',
  });
  const mutation = useMutation({
    mutationFn: ({
      path,
      body,
      method = 'PATCH',
    }: {
      path: string;
      body?: unknown;
      method?: string;
    }) => api(path, { method, body: body === undefined ? undefined : JSON.stringify(body) }),
    onSuccess: () => {
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      notify(t('saved'));
    },
  });
  if (user.isPending) return <div className="state-screen">{t('loading')}</div>;
  if (!user.data) return <AuthForm />;
  if (!authorized)
    return (
      <div className="state-screen">
        <h1>{t('accessDenied')}</h1>
        <Link className="button" to="/account">
          {t('account')}
        </Link>
      </div>
    );
  const owner = user.data.role === 'owner';
  const tabs: Tab[] = owner
    ? [
        'overview',
        'orders',
        'reservations',
        'items',
        'categories',
        'branches',
        'zones',
        'promos',
        'events',
        'reviews',
        'messages',
        'settings',
        'users',
        'qr',
      ]
    : ['overview', 'orders', 'reservations', 'items', 'reviews', 'messages', 'qr'];
  const entities: Partial<
    Record<Tab, (MenuItem | Category | Branch | Zone | Promo | EventRecord)[]>
  > = {
    items: data.items,
    categories: data.categories,
    branches: data.branches,
    zones: overview.data?.zones ?? [],
    promos: overview.data?.promos ?? [],
    events: overview.data?.events ?? [],
  };
  const records = entities[tab];
  return (
    <div className="container">
      <PageHeading eyebrow={user.data.name} title={t('dashboard')} />
      <div className="admin-shell">
        <nav className="admin-nav" aria-label={t('dashboard')}>
          {tabs.map((key) => (
            <button key={key} className={tab === key ? 'selected' : ''} onClick={() => setTab(key)}>
              {t(key === 'qr' ? 'qr' : key)}
            </button>
          ))}
        </nav>
        <section className="admin-main">
          {overview.data && (
            <StaffNotifications
              userId={user.data.id}
              orders={overview.data.orders}
              reservations={overview.data.reservations}
              onSelect={setTab}
            />
          )}
          <p className="notice">{t('previewData')}</p>
          <FormError error={mutation.error || overview.error} />
          {tab === 'overview' && (
            <>
              <div className="admin-stats">
                <div>
                  <span>{t('revenue')}</span>
                  <strong>{price(stats.data?.revenue ?? 0)}</strong>
                </div>
                <div>
                  <span>{t('completedOrders')}</span>
                  <strong>{stats.data?.orders ?? 0}</strong>
                </div>
                <div>
                  <span>{t('subscribers')}</span>
                  <strong>{overview.data?.subscriberCount ?? 0}</strong>
                </div>
              </div>
              <h2>{t('topItems')}</h2>
              {stats.data?.topItems.length ? (
                <div className="admin-chart">
                  {stats.data.topItems.map((item) => (
                    <div className="admin-chart-row" key={item.name}>
                      <span>{item.name}</span>
                      <div
                        className="admin-chart-bar"
                        style={{
                          width: `${(item.quantity / (stats.data?.topItems[0]?.quantity || 1)) * 100}%`,
                        }}
                      />
                      <strong>{item.quantity}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted">{t('noData')}</p>
              )}
              {!!Object.keys(stats.data?.days ?? {}).length && (
                <div className="admin-chart">
                  {Object.entries(stats.data!.days).map(([day, value]) => (
                    <div className="totals" key={day}>
                      <span>
                        {day} / {value.orders} {t('orders')}
                      </span>
                      <strong>{price(value.revenue)}</strong>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          {tab === 'orders' && (
            <>
              <h2>{t('orders')}</h2>
              <div className="admin-list">
                {overview.data?.orders.map((order) => (
                  <article className="admin-record" key={order.id}>
                    <div className="admin-record-top">
                      <div>
                        <h3>
                          #{order.id.slice(-8).toUpperCase()} / {order.name}
                        </h3>
                        <p>
                          {t(order.status)} / {t(order.fulfillment)}{' '}
                          {order.demo && ` / ${t('previewMode')}`}
                        </p>
                        <a className="text-link" dir="ltr" href={`tel:${order.phone}`}>
                          {order.phone}
                        </a>
                      </div>
                      <strong>{price(order.total)}</strong>
                    </div>
                    {order.items.map((line, index) => (
                      <p key={index}>
                        {line.quantity} × {ar ? line.name_ar : line.name_en} (
                        {ar ? line.variant_ar : line.variant_en})
                        {line.addons.length > 0 && ` + ${line.addons.join(', ')}`}
                        {line.notes && ` / ${line.notes}`}
                      </p>
                    ))}
                    {order.address && <p>{order.address}</p>}
                    {order.notes && <p>{order.notes}</p>}
                    {order.fulfillment === 'pickup' &&
                      citywideBranches.has(order.branchId) &&
                      ['received', 'confirmed'].includes(order.status) && (
                        <p className="notice">{t('confirmPickupLocation')}</p>
                      )}
                    <div className="admin-record-actions">
                      {nextStatuses[order.status]
                        .filter(
                          (status) =>
                            !(order.fulfillment !== 'delivery' && status === 'out_for_delivery'),
                        )
                        .map((status) => (
                          <button
                            className="button secondary"
                            key={status}
                            disabled={mutation.isPending}
                            onClick={() =>
                              mutation.mutate({
                                path: `/admin/orders/${order.id}/status`,
                                body: { status },
                              })
                            }
                          >
                            {t(status)}
                          </button>
                        ))}
                      <button className="text-link" onClick={() => setTicket(order)}>
                        <Printer size={17} />
                        {t('print')}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              {!overview.data?.orders.length && <p>{t('noData')}</p>}
            </>
          )}
          {tab === 'reservations' && (
            <>
              <h2>{t('reservations')}</h2>
              <div className="admin-list">
                {overview.data?.reservations.map((r) => (
                  <article className="admin-record" key={r.id}>
                    <h3>
                      {r.name} / {r.date} / {r.time}
                    </h3>
                    <p>
                      {t('partySize')}: {r.partySize} / {t(r.status)}{' '}
                      {r.demo && ` / ${t('previewMode')}`}
                    </p>
                    <a className="text-link" dir="ltr" href={`tel:${r.phone}`}>
                      {r.phone}
                    </a>
                    {r.notes && <p>{r.notes}</p>}
                    <div className="admin-record-actions">
                      {['confirmed', 'cancelled']
                        .filter((s) => r.status !== s)
                        .map((status) => (
                          <button
                            className="button secondary"
                            key={status}
                            disabled={mutation.isPending}
                            onClick={() =>
                              mutation.mutate({
                                path: `/admin/reservations/${r.id}`,
                                body: { status },
                              })
                            }
                          >
                            {t(status)}
                          </button>
                        ))}
                    </div>
                  </article>
                ))}
              </div>
              {!overview.data?.reservations.length && <p>{t('noData')}</p>}
            </>
          )}
          {records && (
            <>
              <div className="admin-title-row">
                <h2>{t(tab)}</h2>
                <button
                  className="button"
                  onClick={() =>
                    setEditor({
                      entity: tab as Entity,
                      record: newRecord(tab as Entity, data.categories[0]?.id ?? ''),
                    })
                  }
                >
                  <Plus size={17} />
                  {t('newRecord')}
                </button>
              </div>
              <div className="admin-list">
                {records.map((record) => (
                  <article className="admin-record" key={record.id}>
                    <div className="admin-record-top">
                      <div>
                        <h3>{'name_en' in record ? text(record, ar) : record.code}</h3>
                        {'variants' in record && (
                          <p>
                            {record.priceConfirmed
                              ? record.variants
                                  .map((v) => `${text(v, ar)}: ${price(v.price)}`)
                                  .join(' / ')
                              : t('pricePending')}
                          </p>
                        )}
                        {'available' in record && (
                          <small>{t(record.available ? 'available' : 'unavailable')}</small>
                        )}
                        {'address_en' in record && (
                          <p>{ar ? record.address_ar : record.address_en}</p>
                        )}
                        {'fee' in record && (
                          <p>
                            {t('deliveryFee')}: {price(record.fee)} / {t('minimum')}:{' '}
                            {price(record.minimum)}
                          </p>
                        )}
                      </div>
                      <div className="action-row">
                        <button
                          className="text-link"
                          onClick={() =>
                            setEditor({
                              entity: tab as Entity,
                              record: JSON.parse(JSON.stringify(record)) as GenericRecord,
                            })
                          }
                        >
                          {t('edit')}
                        </button>
                        {owner && (
                          <button
                            className="text-link"
                            disabled={mutation.isPending}
                            onClick={() => {
                              if (window.confirm(t('confirmDelete')))
                                mutation.mutate({
                                  path: `/admin/${tab}/${record.id}`,
                                  method: 'DELETE',
                                });
                            }}
                          >
                            {t('delete')}
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              {!records.length && <p>{t('noData')}</p>}
            </>
          )}
          {tab === 'reviews' && (
            <>
              <h2>{t('reviews')}</h2>
              <div className="admin-list">
                {overview.data?.reviews.map((review) => (
                  <article className="admin-record" key={review.id}>
                    <h3>
                      {review.name} / {review.rating}/5
                    </h3>
                    <p>{review.text}</p>
                    <button
                      className="text-link"
                      onClick={() =>
                        mutation.mutate({
                          path: `/admin/reviews/${review.id}`,
                          body: { approved: !review.approved },
                        })
                      }
                    >
                      {t(review.approved ? 'hide' : 'approve')}
                    </button>
                  </article>
                ))}
              </div>
              {!overview.data?.reviews.length && <p>{t('noData')}</p>}
            </>
          )}
          {tab === 'messages' && (
            <>
              <h2>{t('messages')}</h2>
              <div className="admin-list">
                {overview.data?.contacts.map((message) => (
                  <article className="admin-record" key={message.id}>
                    <h3>{message.name}</h3>
                    <a className="text-link" href={`mailto:${message.email}`}>
                      {message.email}
                    </a>
                    <p className="mt-4">{message.message}</p>
                    <small>
                      {new Date(message.createdAt).toLocaleString(ar ? 'ar-EG' : 'en-EG', {
                        timeZone: 'Africa/Cairo',
                      })}
                    </small>
                  </article>
                ))}
              </div>
              {!overview.data?.contacts.length && <p>{t('noData')}</p>}
            </>
          )}
          {tab === 'users' && (
            <>
              <h2>{t('users')}</h2>
              <div className="admin-list">
                {users.data?.map((member) => (
                  <article key={member.id} className="admin-record">
                    <h3>{member.name}</h3>
                    <p>{member.email}</p>
                    <label className="field">
                      {t('role')}
                      <SelectInput
                        value={member.role}
                        disabled={member.role === 'owner' || mutation.isPending}
                        aria-label={t('role')}
                        onValueChange={(role) =>
                          mutation.mutate({
                            path: `/admin/users/${member.id}/role`,
                            body: { role },
                          })
                        }
                        options={[
                          { value: 'customer', label: t('customer') },
                          { value: 'staff', label: t('staff') },
                          { value: 'owner', label: t('owner'), disabled: true },
                        ]}
                      />
                    </label>
                  </article>
                ))}
              </div>
              <FormError error={users.error} />
            </>
          )}
          {tab === 'settings' && <SettingsEditor initial={data.settings} />}
          {tab === 'qr' && <QrPanel />}
        </section>
      </div>
      {editor && (
        <RecordEditor
          entity={editor.entity}
          initial={editor.record}
          onClose={() => setEditor(null)}
        />
      )}
      <Modal
        open={!!ticket}
        onOpenChange={(open) => {
          if (!open) setTicket(null);
        }}
        title={t('print')}
        className="ticket-modal"
      >
        {ticket && (
          <div id="ticket-content">
            <h2>{theme.brand.name}</h2>
            <p>
              #{ticket.id.slice(-8).toUpperCase()} {ticket.demo && ` / ${t('previewMode')}`}
            </p>
            <p>
              {ticket.name}
              <br />
              {ticket.phone}
              <br />
              {ticket.address}
            </p>
            {ticket.items.map((line, index) => (
              <p key={index}>
                {line.quantity} × {ar ? line.name_ar : line.name_en} (
                {ar ? line.variant_ar : line.variant_en})<br />
                {line.notes}
                <br />
                {price(line.unitPrice * line.quantity)}
              </p>
            ))}
            <p>{ticket.notes}</p>
            <strong>
              {t('total')}: {price(ticket.total)}
            </strong>
          </div>
        )}
        <button className="button mt-6" onClick={() => window.print()}>
          {t('print')}
        </button>
      </Modal>
    </div>
  );
}
function newRecord(entity: Entity, categoryId: string): GenericRecord {
  const id = crypto.randomUUID();
  const names = { id, name_en: '', name_ar: '' };
  switch (entity) {
    case 'items':
      return {
        ...names,
        categoryId,
        description_en: '',
        description_ar: '',
        image: null,
        available: true,
        priceConfirmed: false,
        featured: false,
        temperature: 'hot',
        vegan: false,
        caffeineFree: false,
        variants: [{ id: crypto.randomUUID(), name_en: 'Standard', name_ar: 'عادي', price: 0 }],
        addons: [],
      };
    case 'categories':
      return { ...names, sort: 0 };
    case 'branches':
      return { ...seedBranch, ...names };
    case 'zones':
      return { ...names, fee: 0, minimum: 0, active: true };
    case 'promos':
      return { id, code: '', percent: 10, minimum: 0, expiresAt: null, active: true };
    case 'events':
      return { ...names, description_en: '', description_ar: '', date: '' };
  }
}
function RecordEditor({
  entity,
  initial,
  onClose,
}: {
  entity: Entity;
  initial: GenericRecord;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { data, ar } = useCafe();
  const [record, setRecord] = useState(initial);
  const notify = useUI((s) => s.notify);
  const [uploadError, setUploadError] = useState<unknown>(null);
  const [uploading, setUploading] = useState(false);
  const mutation = useMutation({
    mutationFn: () =>
      api(`/admin/${entity}/${record.id}`, { method: 'PUT', body: JSON.stringify(record) }),
    onSuccess: () => {
      invalidate();
      notify(t('saved'));
      onClose();
    },
  });
  const set = (key: string, value: unknown) =>
    setRecord((previous) => ({ ...previous, [key]: value }));
  async function upload(file: File) {
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size > 4 * 1024 * 1024
    ) {
      setUploadError(new Error(t('photoInvalid')));
      return;
    }
    setUploading(true);
    setUploadError(null);
    const form = new FormData();
    form.append('image', file);
    try {
      const result = await api<{ url: string }>('/admin/uploads', { method: 'POST', body: form });
      set('image', result.url);
      notify(t('uploadDone'));
    } catch (error) {
      setUploadError(error);
    } finally {
      setUploading(false);
    }
  }
  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={`${t('edit')} / ${t(entity)}`}
      className="record-editor"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (uploading || mutation.isPending) return;
          mutation.mutate();
        }}
      >
        <p className="muted text-xs">{t('jsonHelp')}</p>
        {entity === 'items' && (
          <ProductImageField
            value={typeof record.image === 'string' ? record.image : null}
            uploading={uploading}
            disabled={mutation.isPending}
            onUpload={(file) => void upload(file)}
            onRemove={() => {
              set('image', null);
              setUploadError(null);
              notify(t('photoRemoved'));
            }}
          />
        )}
        <div className="form-row">
          {Object.entries(record)
            .filter(
              ([key]) =>
                !['id', 'variants', 'addons'].includes(key) &&
                !(entity === 'items' && key === 'image'),
            )
            .map(([key, value]) => {
              const label = t(`fields.${key}`, { defaultValue: key });
              if (typeof value === 'boolean')
                return (
                  <label key={key} className="toggle-field">
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={(e) => set(key, e.target.checked)}
                    />
                    {label}
                  </label>
                );
              if (key === 'categoryId')
                return (
                  <label className="field" key={key}>
                    {label}
                    <SelectInput
                      required
                      value={String(value)}
                      onValueChange={(value) => set(key, value)}
                      aria-label={label}
                      options={data.categories.map((category) => ({
                        value: category.id,
                        label: text(category, ar),
                      }))}
                    />
                  </label>
                );
              if (key === 'temperature')
                return (
                  <label className="field" key={key}>
                    {label}
                    <SelectInput
                      value={String(value)}
                      onValueChange={(value) => set(key, value)}
                      aria-label={label}
                      options={[
                        { value: 'hot', label: t('hot') },
                        { value: 'cold', label: t('cold') },
                      ]}
                    />
                  </label>
                );
              const coordinate = key === 'lat' || key === 'lng';
              const type =
                typeof value === 'number' || coordinate
                  ? 'number'
                  : key === 'date'
                    ? 'date'
                    : key === 'expiresAt'
                      ? 'datetime-local'
                      : ['open', 'close', 'ramadanOpen', 'ramadanClose'].includes(key)
                        ? 'time'
                        : 'text';
              return (
                <label className="field" key={key}>
                  {label}
                  {key.startsWith('description') || key.startsWith('address') ? (
                    <textarea
                      dir={key.endsWith('_ar') ? 'rtl' : undefined}
                      value={String(value ?? '')}
                      onChange={(e) => set(key, e.target.value)}
                    />
                  ) : (
                    <input
                      type={type}
                      step={coordinate ? 'any' : undefined}
                      dir={key.endsWith('_ar') ? 'rtl' : key === 'phone' ? 'ltr' : undefined}
                      value={
                        key === 'expiresAt' && value
                          ? String(value).slice(0, 16)
                          : String(value ?? '')
                      }
                      onChange={(e) =>
                        set(
                          key,
                          coordinate && e.target.value === ''
                            ? null
                            : type === 'number'
                              ? Number(e.target.value)
                              : key === 'expiresAt'
                                ? e.target.value
                                  ? new Date(e.target.value).toISOString()
                                  : null
                                : ['ramadanOpen', 'ramadanClose', 'image', 'phone'].includes(key)
                                  ? e.target.value || null
                                  : e.target.value,
                        )
                      }
                    />
                  )}
                </label>
              );
            })}
        </div>
        {entity === 'items' && (
          <>
            {(['variants', 'addons'] as const).map((key) => {
              const choices = record[key] as {
                id: string;
                name_en: string;
                name_ar: string;
                price: number;
              }[];
              return (
                <fieldset className="options" key={key}>
                  <legend>{t(key === 'variants' ? 'option' : 'addons')}</legend>
                  {choices.map((choice, index) => (
                    <div className="form-row" key={choice.id}>
                      <label className="field">
                        {t('fields.name_en')}
                        <input
                          required
                          value={choice.name_en}
                          onChange={(e) =>
                            set(
                              key,
                              choices.map((v, i) =>
                                i === index ? { ...v, name_en: e.target.value } : v,
                              ),
                            )
                          }
                        />
                      </label>
                      <label className="field">
                        {t('fields.name_ar')}
                        <input
                          required
                          dir="rtl"
                          value={choice.name_ar}
                          onChange={(e) =>
                            set(
                              key,
                              choices.map((v, i) =>
                                i === index ? { ...v, name_ar: e.target.value } : v,
                              ),
                            )
                          }
                        />
                      </label>
                      <label className="field">
                        {t('fields.price')}
                        <input
                          type="number"
                          required
                          min="0"
                          value={choice.price}
                          onChange={(e) =>
                            set(
                              key,
                              choices.map((v, i) =>
                                i === index ? { ...v, price: Number(e.target.value) } : v,
                              ),
                            )
                          }
                        />
                      </label>
                      <button
                        type="button"
                        className="text-link mb-5"
                        disabled={key === 'variants' && choices.length === 1}
                        onClick={() =>
                          set(
                            key,
                            choices.filter((_, i) => i !== index),
                          )
                        }
                      >
                        {t('remove')}
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() =>
                      set(key, [
                        ...choices,
                        { id: crypto.randomUUID(), name_en: '', name_ar: '', price: 0 },
                      ])
                    }
                  >
                    <Plus size={15} />
                    {t('newRecord')}
                  </button>
                </fieldset>
              );
            })}
          </>
        )}
        <FormError error={uploadError || mutation.error} />
        <button className="button" disabled={mutation.isPending || uploading}>
          {t(mutation.isPending ? 'sending' : 'save')}
        </button>
      </form>
    </Modal>
  );
}
function SettingsEditor({ initial }: { initial: Settings }) {
  const { t } = useTranslation();
  const [values, setValues] = useState(initial);
  const notify = useUI((s) => s.notify);
  const upload = useMutation({
    mutationFn: async ({ file, key }: { file: File; key: string }) => {
      const form = new FormData();
      form.append('image', file);
      const result = await api<{ url: string }>('/admin/uploads', { method: 'POST', body: form });
      return { key, url: result.url };
    },
    onSuccess: ({ key, url }) => {
      setValues((previous) => ({ ...previous, theme: { ...previous.theme, [key]: url } }));
      notify(t('uploadDone'));
    },
  });
  const mutation = useMutation({
    mutationFn: () => api('/admin/settings', { method: 'PUT', body: JSON.stringify(values) }),
    onSuccess: () => {
      invalidate();
      notify(t('saved'));
    },
  });
  return (
    <form
      className="form-panel"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <h2>{t('settings')}</h2>
      <label className="field">
        {t('brandName')}
        <input
          value={values.theme['brand.name'] ?? theme.brand.name}
          maxLength={100}
          onChange={(e) =>
            setValues({ ...values, theme: { ...values.theme, 'brand.name': e.target.value } })
          }
        />
      </label>
      {(['logo', 'hero'] as const).map((key) => (
        <div key={key}>
          <label className="field">
            {t(key === 'logo' ? 'brandLogo' : 'brandHero')}
            <input
              value={values.theme[`brand.${key}`] ?? theme.brand[key]}
              onChange={(e) =>
                setValues({
                  ...values,
                  theme: { ...values.theme, [`brand.${key}`]: e.target.value },
                })
              }
            />
          </label>
          <label className="button secondary upload-label">
            <UploadSimple size={17} />
            {t(upload.isPending ? 'sending' : 'upload')}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={upload.isPending}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload.mutate({ file, key: `brand.${key}` });
              }}
            />
          </label>
        </div>
      ))}
      {(['previewMode', 'ramadanMode', 'arabicNumerals', 'whatsappEnabled'] as const).map((key) => (
        <label className="toggle-field" key={key}>
          <input
            type="checkbox"
            checked={values[key]}
            onChange={(e) => setValues({ ...values, [key]: e.target.checked })}
          />
          {t(key)}
        </label>
      ))}
      {(['facebook', 'instagram', 'about_en', 'about_ar'] as const).map((key) => (
        <label className="field" key={key}>
          {t(key === 'about_en' ? 'aboutEn' : key === 'about_ar' ? 'aboutAr' : key)}
          {key.startsWith('about') ? (
            <textarea
              rows={4}
              dir={key === 'about_ar' ? 'rtl' : 'ltr'}
              value={values[key]}
              onChange={(e) => setValues({ ...values, [key]: e.target.value })}
            />
          ) : (
            <input
              type="url"
              value={values[key]}
              onChange={(e) => setValues({ ...values, [key]: e.target.value })}
            />
          )}
        </label>
      ))}
      <h3>{t('themeTokens')}</h3>
      <p className="muted text-xs">{t('themeHelp')}</p>
      <div className="form-row">
        {(['light', 'dark'] as const).flatMap((mode) =>
          Object.entries(theme.colors[mode]).map(([key, value]) => (
            <label className="field" key={`${mode}.${key}`}>
              {t(`fields.${mode}`)} / {t(`fields.${key}`)}
              <input
                type="color"
                value={values.theme[`${mode}.${key}`] ?? value}
                onChange={(e) =>
                  setValues({
                    ...values,
                    theme: { ...values.theme, [`${mode}.${key}`]: e.target.value },
                  })
                }
              />
            </label>
          )),
        )}
      </div>
      <FormError error={mutation.error || upload.error} />
      <button className="button" disabled={mutation.isPending || upload.isPending}>
        {t('save')}
      </button>
    </form>
  );
}
function QrPanel() {
  const { t } = useTranslation();
  const [table, setTable] = useState(1);
  const [url, setUrl] = useState('');
  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(`${window.location.origin}/menu?table=${table}`, {
      width: 600,
      margin: 2,
    }).then((value) => {
      if (active) setUrl(value);
    });
    return () => {
      active = false;
    };
  }, [table]);
  return (
    <section className="form-panel qr-panel">
      <h2>{t('qr')}</h2>
      <p className="muted text-sm">{t('qrText')}</p>
      <label className="field">
        {t('table')}
        <input
          type="number"
          min="1"
          max="999"
          value={table}
          onChange={(e) => setTable(Math.max(1, Math.min(999, Number(e.target.value))))}
        />
      </label>
      {url && (
        <>
          <div className="qr-image">
            <img src={url} alt={t('qr')} width="200" height="200" />
          </div>
          <a className="button" href={url} download={`crowd-table-${table}.png`}>
            {t('downloadQr')}
          </a>
        </>
      )}
    </section>
  );
}
