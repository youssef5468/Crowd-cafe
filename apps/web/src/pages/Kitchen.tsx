import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { SpeakerHigh, SpeakerSlash } from '@phosphor-icons/react';
import type { OrderRecord, OrderStatus } from '@galal/shared';
import { useCafe } from '../context';
import { api, text, useUI } from '../lib';
import { StaffGate } from './StaffGate';
import { useTableWords } from './tableWords';
import './table-order.css';

const next: Partial<Record<OrderStatus, OrderStatus>> = {
  confirmed: 'preparing',
  preparing: 'ready',
  ready: 'completed',
};

function KitchenBoard() {
  const w = useTableWords();
  const { ar } = useCafe();
  const notify = useUI((state) => state.notify);
  const [now, setNow] = useState(() => Date.now());
  const [sound, setSound] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const seen = useRef<Set<string> | null>(null);
  const query = useQuery({
    queryKey: ['kitchen'],
    queryFn: () => api<OrderRecord[]>('/admin/kitchen'),
    refetchInterval: 4000,
    refetchIntervalInBackground: true,
    staleTime: 0,
  });
  const advance = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
      api(`/admin/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: () => void query.refetch(),
    onError: (error: Error) => notify(error.message),
  });
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(
    () => () => {
      void audio.current?.close();
    },
    [],
  );
  const orders = query.data;
  useEffect(() => {
    if (!orders) return;
    const fresh = orders.filter(
      (order) => !seen.current?.has(order.id) && order.status === 'confirmed',
    );
    if (seen.current && fresh.length && sound && audio.current) {
      const context = audio.current;
      [0, 0.22].forEach((delay) => {
        const tone = context.createOscillator();
        const gain = context.createGain();
        tone.frequency.value = 880;
        gain.gain.value = 0.2;
        tone.connect(gain).connect(context.destination);
        tone.start(context.currentTime + delay);
        tone.stop(context.currentTime + delay + 0.15);
      });
    }
    seen.current = new Set(orders.map((order) => order.id));
  }, [orders, sound]);
  const enableSound = () => {
    if (!audio.current) audio.current = new AudioContext();
    void audio.current.resume();
    setSound(true);
  };
  const columns: { status: OrderStatus; title: string; action: string }[] = [
    { status: 'confirmed', title: w.colNew, action: w.start },
    { status: 'preparing', title: w.colPreparing, action: w.markReady },
    { status: 'ready', title: w.colReady, action: w.handedOver },
  ];
  return (
    <main className="container to-page kitchen">
      <div className="kitchen-head">
        <h1 className="to-title">{w.kitchenTitle}</h1>
        <button
          type="button"
          className={sound ? 'button secondary' : 'button'}
          onClick={enableSound}
          disabled={sound}
        >
          {sound ? <SpeakerHigh size={20} /> : <SpeakerSlash size={20} />}
          {sound ? w.soundOn : w.sound}
        </button>
      </div>
      {orders && orders.length === 0 && <p className="to-muted">{w.kitchenEmpty}</p>}
      <div className="kitchen-columns">
        {columns.map((column) => {
          const list = (orders ?? []).filter((order) => order.status === column.status);
          return (
            <section key={column.status} className="kitchen-column" aria-label={column.title}>
              <h2>
                {column.title} <span>{list.length}</span>
              </h2>
              {list.map((order) => {
                const minutes = Math.max(
                  0,
                  Math.floor((now - new Date(order.paidAt ?? order.createdAt).getTime()) / 60000),
                );
                const target = next[order.status];
                return (
                  <article key={order.id} className="kitchen-card" data-late={minutes >= 10}>
                    <header>
                      <strong>
                        {order.tableNumber ? `${w.table} ${order.tableNumber}` : order.name}
                      </strong>
                      <span>
                        {minutes} {w.min}
                      </span>
                    </header>
                    <ul>
                      {order.items.map((line, index) => (
                        <li key={index}>
                          <span className="kitchen-line">
                            <b>{line.quantity} ×</b> {text(line, ar)}
                          </span>
                          <small>
                            {ar ? line.variant_ar : line.variant_en}
                            {line.addons.length > 0 && ` + ${line.addons.join(', ')}`}
                          </small>
                          {line.notes && <small className="kitchen-note">{line.notes}</small>}
                          {line.person && <small className="to-person-tag">{line.person}</small>}
                        </li>
                      ))}
                    </ul>
                    {order.notes && <p className="kitchen-note">{order.notes}</p>}
                    {target && (
                      <button
                        type="button"
                        className="button wide"
                        disabled={advance.isPending}
                        onClick={() => advance.mutate({ id: order.id, status: target })}
                      >
                        {column.action}
                      </button>
                    )}
                  </article>
                );
              })}
            </section>
          );
        })}
      </div>
      <small className="to-muted">{w.live}</small>
    </main>
  );
}

export function Kitchen() {
  return (
    <StaffGate>
      <KitchenBoard />
    </StaffGate>
  );
}
