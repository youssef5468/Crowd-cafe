import { MagneticButton, MagneticLink } from '../motion';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery } from '@tanstack/react-query';
import { type User, type OrderRecord } from '@crowd/shared';
import { useCafe, useUser } from '../context';
import { api, queryClient, useUI } from '../lib';
import { Arrow, FormError, PageHeading } from '../components';

export function AuthForm() {
  const { t } = useTranslation();
  const [register, setRegister] = useState(false);
  const mutation = useMutation({
    mutationFn: (values: { name: string; email: string; password: string }) =>
      api<User>(`/auth/${register ? 'register' : 'login'}`, {
        method: 'POST',
        body: JSON.stringify(values),
      }),
    onSuccess: (user) => queryClient.setQueryData(['me'], user),
  });
  return (
    <div className="container">
      <form
        className="form-panel auth-panel"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          mutation.mutate({
            name: String(form.get('name') ?? ''),
            email: String(form.get('email')),
            password: String(form.get('password')),
          });
        }}
      >
        <p className="eyebrow">{t('account')}</p>
        <h1>{t(register ? 'register' : 'signIn')}</h1>
        {register && (
          <label className="field">
            {t('name')}
            <input name="name" autoComplete="name" required minLength={2} maxLength={100} />
          </label>
        )}
        <label className="field">
          {t('email')}
          <input name="email" type="email" autoComplete="email" required maxLength={254} />
        </label>
        <label className="field">
          {t('password')}
          <input
            name="password"
            type="password"
            aria-label={t('password')}
            aria-describedby="password-help"
            autoComplete={register ? 'new-password' : 'current-password'}
            required
            minLength={10}
            maxLength={128}
          />
          <small id="password-help">{t('passwordHelp')}</small>
        </label>
        <FormError error={mutation.error} />
        <MagneticButton className="button wide" disabled={mutation.isPending}>
          {t(mutation.isPending ? 'sending' : register ? 'createAccount' : 'login')}
          <Arrow />
        </MagneticButton>
        <MagneticButton
          type="button"
          className="text-link"
          onClick={() => {
            setRegister(!register);
            mutation.reset();
          }}
        >
          {t(register ? 'haveAccount' : 'needAccount')}
        </MagneticButton>
        <p className="muted text-xs mt-5 mb-0">{t('guest')}</p>
      </form>
    </div>
  );
}
export function Account() {
  const user = useUser();
  const { t } = useTranslation();
  const { price } = useCafe();
  const notify = useUI((s) => s.notify);
  const orders = useQuery({
    queryKey: ['my-orders'],
    queryFn: () => api<OrderRecord[]>('/me/orders'),
    enabled: !!user.data,
  });
  const saveAddress = useMutation({
    mutationFn: (addresses: User['addresses']) =>
      api<User>('/me/addresses', { method: 'PATCH', body: JSON.stringify(addresses) }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['me'], updated);
      notify(t('saved'));
    },
  });
  const logout = useMutation({
    mutationFn: () => api('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      queryClient.setQueryData(['me'], null);
      queryClient.removeQueries({ queryKey: ['my-orders'] });
      queryClient.removeQueries({ queryKey: ['admin'] });
      queryClient.removeQueries({ queryKey: ['stats'] });
    },
  });
  if (user.isPending) return <div className="state-screen">{t('loading')}</div>;
  if (!user.data) return <AuthForm />;
  return (
    <div className="container section-bottom">
      <PageHeading eyebrow={user.data.name} title={t('accountTitle')} />
      <div className="action-row mb-8">
        <MagneticButton className="text-link" onClick={() => logout.mutate()}>
          {t('logout')}
        </MagneticButton>
        {['owner', 'staff'].includes(user.data.role) && (
          <MagneticLink className="button" to="/admin">
            {t('dashboard')}
            <Arrow />
          </MagneticLink>
        )}
      </div>
      <div className="account-grid">
        <section>
          <h2>{t('orderHistory')}</h2>
          {orders.isPending ? (
            <p>{t('loading')}</p>
          ) : orders.isError ? (
            <FormError error={orders.error} />
          ) : orders.data?.length ? (
            orders.data.map((order) => (
              <Link
                className="order-history-card"
                to={`/order/${order.id}?token=${order.accessToken}`}
                key={order.id}
              >
                <div>
                  <h3>#{order.id.slice(-8).toUpperCase()}</h3>
                  <p>
                    {t(order.status)} {order.demo && ` / ${t('previewMode')}`}
                  </p>
                </div>
                <strong>{price(order.total)}</strong>
                <Arrow />
              </Link>
            ))
          ) : (
            <p className="muted">{t('noOrders')}</p>
          )}
        </section>
        <section className="form-panel">
          <h2>{t('addresses')}</h2>
          {user.data.addresses.map((address, index) => (
            <div key={index} className="mb-6">
              <strong className="text-sm">{address.label}</strong>
              <p className="muted text-xs">{address.address}</p>
              <MagneticButton
                className="text-link"
                onClick={() =>
                  saveAddress.mutate(user.data!.addresses.filter((_, i) => i !== index))
                }
              >
                {t('remove')}
              </MagneticButton>
            </div>
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const fields = new FormData(form);
              saveAddress.mutate(
                [
                  ...user.data!.addresses,
                  { label: String(fields.get('label')), address: String(fields.get('address')) },
                ],
                { onSuccess: () => form.reset() },
              );
            }}
          >
            <label className="field">
              {t('addressLabel')}
              <input name="label" required maxLength={60} />
            </label>
            <label className="field">
              {t('fullAddress')}
              <textarea name="address" required minLength={10} maxLength={500} />
            </label>
            <FormError error={saveAddress.error} />
            <MagneticButton
              className="button"
              disabled={saveAddress.isPending || user.data.addresses.length >= 10}
            >
              {t('save')}
            </MagneticButton>
          </form>
        </section>
      </div>
    </div>
  );
}
