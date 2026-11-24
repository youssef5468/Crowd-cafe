import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { QueryClient } from '@tanstack/react-query';
import { type MenuItem, type MenuResponse } from '@crowd/shared';
import i18n from './i18n';

export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000, refetchOnWindowFocus: true } },
});
export class ApiRequestError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
  }
}
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.method && !['GET', 'HEAD'].includes(init.method.toUpperCase()))
    headers.set('X-crowd-CSRF', '1');
  if (init.body && !(init.body instanceof FormData))
    headers.set('Content-Type', 'application/json');
  let response = await fetch(`/api${path}`, { ...init, headers, credentials: 'include' });
  if (response.status === 401 && !path.startsWith('/auth/')) {
    const refresh = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-crowd-CSRF': '1' },
    });
    if (refresh.ok)
      response = await fetch(`/api${path}`, { ...init, headers, credentials: 'include' });
  }
  const payload: unknown = await response.json();
  if (!response.ok)
    throw new ApiRequestError(
      typeof payload === 'object' && payload && 'error' in payload
        ? String(payload.error)
        : i18n.t('error'),
      response.status,
    );
  return payload as T;
}
export async function getMenu(): Promise<MenuResponse> {
  try {
    const menu = await api<MenuResponse>('/menu');
    localStorage.setItem('crowd-menu', JSON.stringify(menu));
    return menu;
  } catch (error) {
    if (!navigator.onLine) {
      const cached = localStorage.getItem('crowd-menu');
      if (cached) return JSON.parse(cached) as MenuResponse;
    }
    throw error;
  }
}
export type CartLine = {
  key: string;
  item: MenuItem;
  variantId: string;
  addonIds: string[];
  quantity: number;
  notes: string;
};
type CartState = {
  lines: CartLine[];
  add: (line: Omit<CartLine, 'key'>) => void;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
};
export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      add: (line) =>
        set((state) => ({ lines: [...state.lines, { ...line, key: crypto.randomUUID() }] })),
      setQuantity: (key, quantity) =>
        set((state) => ({
          lines: state.lines.map((line) =>
            line.key === key ? { ...line, quantity: Math.min(30, Math.max(1, quantity)) } : line,
          ),
        })),
      remove: (key) => set((state) => ({ lines: state.lines.filter((line) => line.key !== key) })),
      clear: () => set({ lines: [] }),
    }),
    { name: 'crowd-bag', version: 1 },
  ),
);
export const unitPrice = (line: CartLine) => {
  const variant = line.item.variants.find((v) => v.id === line.variantId);
  return (
    (variant?.price ?? 0) +
    line.item.addons
      .filter((a) => line.addonIds.includes(a.id))
      .reduce((sum, a) => sum + a.price, 0)
  );
};
type UIState = {
  bagOpen: boolean;
  setBagOpen: (open: boolean) => void;
  toast: string;
  notify: (text: string) => void;
};
let toastTimer: ReturnType<typeof setTimeout>;
export const useUI = create<UIState>((set) => ({
  bagOpen: false,
  setBagOpen: (bagOpen) => set({ bagOpen }),
  toast: '',
  notify: (toast) => {
    clearTimeout(toastTimer);
    set({ toast });
    toastTimer = setTimeout(() => set({ toast: '' }), 3500);
  },
}));
export function text(record: { name_en: string; name_ar: string }, ar: boolean) {
  return ar ? record.name_ar : record.name_en;
}
export function money(value: number, arabicNumerals = false) {
  return `${new Intl.NumberFormat(i18n.language === 'ar' && arabicNumerals ? 'ar-EG' : 'en-EG', { maximumFractionDigits: 2 }).format(value)} ${i18n.t('egp')}`;
}
