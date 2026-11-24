import { createContext, useContext, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { type MenuResponse, type User } from '@crowd/shared';
import { api, getMenu, money } from './lib';
import { theme } from './theme.config';
type Branding = {
  name: string;
  descriptor: string;
  logo: string;
  hero: string;
  menu: string;
  phone: string;
  whatsapp: string;
};
type Context = {
  data: MenuResponse;
  ar: boolean;
  price: (value: number) => string;
  branding: Branding;
};
const CafeContext = createContext<Context | null>(null);
export function CafeProvider({ children }: { children: ReactNode }) {
  const { i18n, t } = useTranslation();
  const query = useQuery({ queryKey: ['menu'], queryFn: getMenu, networkMode: 'always' });
  if (query.isPending)
    return (
      <main className="state-screen">
        <img src={theme.brand.logo || '/assets/crowd/logo.webp'} alt={theme.brand.name} width="180" />
        <p>{t('loading')}</p>
      </main>
    );
  if (query.isError)
    return (
      <main className="state-screen">
        <h1>{t('error')}</h1>
        <button className="button" onClick={() => void query.refetch()}>
          {t('retry')}
        </button>
      </main>
    );
  const branding: Branding = {
    ...theme.brand,
    name: query.data.settings.theme['brand.name'] || theme.brand.name,
    logo: query.data.settings.theme['brand.logo'] || theme.brand.logo,
    hero: query.data.settings.theme['brand.hero'] || theme.brand.hero,
  };
  return (
    <CafeContext.Provider
      value={{
        data: query.data,
        ar: i18n.language === 'ar',
        branding,
        price: (v) => money(v, query.data.settings.arabicNumerals),
      }}
    >
      {children}
    </CafeContext.Provider>
  );
}
export function useCafe() {
  const value = useContext(CafeContext);
  if (!value) throw new Error('CafeProvider missing');
  return value;
}
export function useUser() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => api<User>('/me'),
    retry: false,
    staleTime: 60000,
  });
}
