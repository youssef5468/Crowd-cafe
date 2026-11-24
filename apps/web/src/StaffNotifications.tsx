import { useEffect, useRef, useState } from 'react';
import { Bell } from '@phosphor-icons/react';
import type { OrderRecord, ReservationRecord } from '@crowd/shared';
import { useCafe } from './context';
import { useUI } from './lib';

type Alert = { id: string; kind: 'orders' | 'reservations'; name: string };
const words = {
  en: {
    title: 'Staff alerts',
    enable: 'Enable browser alerts',
    disable: 'Disable browser alerts',
    sound: 'Sound alerts',
    clear: 'Mark all read',
    empty: 'No new activity since opening this dashboard.',
    order: 'New order',
    reservation: 'New table booking',
    note: 'Keep this dashboard open. Alerts refresh about every 15 seconds; this is not push messaging when the browser is closed.',
    denied: 'Browser alerts are unavailable or blocked. Dashboard alerts still work.',
  },
  ar: {
    title: 'تنبيهات الفريق',
    enable: 'تفعيل تنبيهات المتصفح',
    disable: 'إيقاف تنبيهات المتصفح',
    sound: 'تنبيه صوتي',
    clear: 'تحديد الكل كمقروء',
    empty: 'لا توجد طلبات جديدة منذ فتح لوحة الإدارة.',
    order: 'طلب جديد',
    reservation: 'حجز طاولة جديد',
    note: 'اترك لوحة الإدارة مفتوحة. تتحدث التنبيهات كل ١٥ ثانية تقريبًا، ولا تعمل عند إغلاق المتصفح.',
    denied: 'تنبيهات المتصفح غير متاحة أو محظورة. تنبيهات لوحة الإدارة ما زالت تعمل.',
  },
};
export function StaffNotifications({
  orders,
  reservations,
  userId,
  onSelect,
}: {
  orders: OrderRecord[];
  reservations: ReservationRecord[];
  userId: string;
  onSelect: (tab: 'orders' | 'reservations') => void;
}) {
  const { ar } = useCafe();
  const w = words[ar ? 'ar' : 'en'];
  const notify = useUI((s) => s.notify);
  const seen = useRef<Set<string> | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unread, setUnread] = useState(0);
  const [sound, setSound] = useState(false);
  const [browserAlerts, setBrowserAlerts] = useState(
    () => localStorage.getItem(`crowd-alerts-${userId}`) === 'on',
  );
  useEffect(
    () => () => {
      void audio.current?.close();
    },
    [],
  );
  useEffect(() => {
    const all: Alert[] = [
      ...orders.map((o) => ({ id: `order-${o.id}`, kind: 'orders' as const, name: o.name })),
      ...reservations.map((r) => ({
        id: `reservation-${r.id}`,
        kind: 'reservations' as const,
        name: r.name,
      })),
    ];
    if (!seen.current) {
      seen.current = new Set(all.map((a) => a.id));
      return;
    }
    const added = all.filter((a) => !seen.current!.has(a.id));
    seen.current = new Set(all.map((a) => a.id));
    if (!added.length) return;
    setAlerts((old) => [...added, ...old].slice(0, 8));
    setUnread((old) => old + added.length);
    notify(`${w.title}: ${added.length}`);
    if (sound && audio.current) {
      const oscillator = audio.current.createOscillator();
      const gain = audio.current.createGain();
      oscillator.connect(gain);
      gain.connect(audio.current.destination);
      oscillator.frequency.value = 660;
      gain.gain.setValueAtTime(0.06, audio.current.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.current.currentTime + 0.2);
      oscillator.start();
      oscillator.stop(audio.current.currentTime + 0.2);
    }
    if (browserAlerts && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const notification = new Notification(w.title, {
          body: `${w[added[0].kind === 'orders' ? 'order' : 'reservation']} · ${added.length}`,
          tag: 'crowd-staff',
        });
        notification.onclick = () => {
          window.focus();
          onSelect(added[0].kind);
          notification.close();
        };
      } catch {
        notify(w.denied);
      }
    }
  }, [orders, reservations, browserAlerts, sound, notify, w, onSelect]);
  async function toggleBrowser() {
    if (browserAlerts) {
      localStorage.removeItem(`crowd-alerts-${userId}`);
      setBrowserAlerts(false);
      return;
    }
    if (!('Notification' in window)) {
      notify(w.denied);
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        localStorage.setItem(`crowd-alerts-${userId}`, 'on');
        setBrowserAlerts(true);
      } else notify(w.denied);
    } catch {
      notify(w.denied);
    }
  }
  return (
    <details className="staff-alerts">
      <summary>
        <Bell size={19} />
        {w.title}
        <span className="staff-alerts-count" aria-live="polite">
          {unread}
        </span>
      </summary>
      <div className="staff-alerts-panel">
        <p className="muted">{w.note}</p>
        <div className="action-row">
          <button type="button" className="text-link" onClick={() => void toggleBrowser()}>
            {browserAlerts ? w.disable : w.enable}
          </button>
          <label className="toggle-field">
            <input
              type="checkbox"
              checked={sound}
              onChange={(event) => {
                if (event.target.checked) {
                  try {
                    audio.current ??= new AudioContext();
                    void audio.current.resume().catch(() => setSound(false));
                  } catch {
                    setSound(false);
                    return;
                  }
                }
                setSound(event.target.checked);
              }}
            />
            {w.sound}
          </label>
        </div>
        {!!unread && (
          <button type="button" className="text-link" onClick={() => setUnread(0)}>
            {w.clear}
          </button>
        )}
        {alerts.length ? (
          <ul>
            {alerts.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    onSelect(a.kind);
                    setUnread(0);
                  }}
                >
                  {w[a.kind === 'orders' ? 'order' : 'reservation']} — {a.name}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>{w.empty}</p>
        )}
      </div>
    </details>
  );
}
