import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Camera, CheckCircle, Stop } from '@phosphor-icons/react';
import { parsePickupCode, personTotals, type OrderRecord } from '@crowd/shared';
import { useCafe } from '../context';
import { ApiRequestError, api, text } from '../lib';
import { StaffGate } from './StaffGate';
import { useTableWords, type TableWords } from './tableWords';
import './table-order.css';

type Detector = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type DetectorConstructor = new (options: { formats: string[] }) => Detector;

/** Camera scanner: the browser's BarcodeDetector when it exists, otherwise jsQR (loaded on demand). */
function QrScanner({ onCode, w }: { onCode: (code: string) => void; w: TableWords }) {
  const video = useRef<HTMLVideoElement>(null);
  const latest = useRef(onCode);
  latest.current = onCode;
  const [active, setActive] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!active) return;
    let stopped = false;
    let stream: MediaStream | undefined;
    let timer: number | undefined;
    const canvas = document.createElement('canvas');
    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (stopped) return stream.getTracks().forEach((track) => track.stop());
        const element = video.current;
        if (!element) return;
        element.srcObject = stream;
        await element.play();
        const Native = (window as unknown as { BarcodeDetector?: DetectorConstructor })
          .BarcodeDetector;
        const detector = Native ? new Native({ formats: ['qr_code'] }) : null;
        const jsQR = detector ? null : (await import('jsqr')).default;
        const tick = async () => {
          if (stopped) return;
          if (element.readyState >= 2 && element.videoWidth) {
            const scale = Math.min(1, 640 / element.videoWidth);
            canvas.width = Math.round(element.videoWidth * scale);
            canvas.height = Math.round(element.videoHeight * scale);
            const context = canvas.getContext('2d', { willReadFrequently: true });
            if (context) {
              context.drawImage(element, 0, 0, canvas.width, canvas.height);
              let value: string | undefined;
              if (detector) value = (await detector.detect(canvas))[0]?.rawValue;
              else if (jsQR) {
                const frame = context.getImageData(0, 0, canvas.width, canvas.height);
                value = jsQR(frame.data, frame.width, frame.height)?.data;
              }
              const code = value ? parsePickupCode(value) : null;
              if (code) {
                setActive(false);
                latest.current(code);
                return;
              }
            }
          }
          timer = window.setTimeout(() => void tick(), 180);
        };
        void tick();
      } catch {
        setError(w.cameraError);
        setActive(false);
      }
    };
    void start();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [active, w]);
  return (
    <div className="cashier-scanner">
      {active && <video ref={video} muted playsInline aria-label={w.scanTitle} />}
      <button
        type="button"
        className="button"
        onClick={() => {
          setError('');
          setActive((on) => !on);
        }}
      >
        {active ? <Stop size={20} /> : <Camera size={20} />}
        {active ? w.stopCamera : w.startCamera}
      </button>
      {error && <small className="to-error">{error}</small>}
    </div>
  );
}

function CashierDesk() {
  const w = useTableWords();
  const { ar, price } = useCafe();
  const [params, setParams] = useSearchParams();
  const [typed, setTyped] = useState('');
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [phase, setPhase] = useState<'scan' | 'review' | 'done'>('scan');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const explain = useCallback(
    (error: unknown) => {
      const status = error instanceof ApiRequestError ? error.status : 0;
      if (status === 404) return w.notFoundCode;
      if (status === 409) return w.handled;
      if (status === 410) return w.expiredCode;
      return error instanceof Error ? error.message : w.cameraError;
    },
    [w],
  );
  const lookup = useCallback(
    async (raw: string) => {
      const code = parsePickupCode(raw);
      if (!code) return setMessage(w.invalidCode);
      setBusy(true);
      setMessage('');
      try {
        setOrder(await api<OrderRecord>(`/admin/table-orders/${code}`));
        setPhase('review');
      } catch (error) {
        setMessage(explain(error));
      } finally {
        setBusy(false);
      }
    },
    [explain, w],
  );
  // A customer's QR is a link, so scanning it with any camera app opens this page with ?code=
  const fromLink = params.get('code');
  useEffect(() => {
    if (!fromLink) return;
    setParams({}, { replace: true });
    void lookup(fromLink);
  }, [fromLink, lookup, setParams]);
  const reset = () => {
    setOrder(null);
    setPhase('scan');
    setTyped('');
    setMessage('');
  };
  const act = async (run: () => Promise<void>) => {
    setBusy(true);
    setMessage('');
    try {
      await run();
    } catch (error) {
      setMessage(explain(error));
    } finally {
      setBusy(false);
    }
  };
  const pay = () =>
    act(async () => {
      if (!order?.pickupCode) return;
      setOrder(
        await api<OrderRecord>(`/admin/table-orders/${order.pickupCode}/pay`, { method: 'POST' }),
      );
      setPhase('done');
    });
  const cancel = () =>
    act(async () => {
      if (!order || !window.confirm(w.confirmCancel)) return;
      await api(`/admin/orders/${order.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'cancelled' }),
      });
      reset();
      setMessage(w.cancelledDone);
    });
  const perPerson = order ? personTotals(order.items) : [];
  return (
    <main className="container to-page cashier">
      <h1 className="to-title">{w.cashierTitle}</h1>
      {phase === 'scan' && (
        <section className="to-card">
          <h2>{w.scanTitle}</h2>
          <QrScanner onCode={(code) => void lookup(code)} w={w} />
          <form
            className="cashier-manual"
            onSubmit={(event) => {
              event.preventDefault();
              void lookup(typed);
            }}
          >
            <label className="to-label" htmlFor="cashier-code">
              {w.orType}
            </label>
            <div className="to-person-row">
              <input
                id="cashier-code"
                className="to-input to-code-input"
                dir="ltr"
                value={typed}
                maxLength={12}
                autoComplete="off"
                autoCapitalize="characters"
                placeholder={w.codePlaceholder}
                onChange={(event) => setTyped(event.target.value.toUpperCase())}
              />
              <button type="submit" className="button" disabled={busy || !typed.trim()}>
                {w.find}
              </button>
            </div>
          </form>
        </section>
      )}
      {message && (
        <p className="notice to-error" role="alert">
          {message}
        </p>
      )}
      {order && phase !== 'scan' && (
        <section className="to-card">
          <div className="cashier-head">
            <strong className="cashier-table">
              {w.table} {order.tableNumber}
            </strong>
            <span className="to-code to-code-small" dir="ltr">
              {order.pickupCode}
            </span>
          </div>
          <ul className="to-lines to-lines-readonly">
            {order.items.map((line, index) => (
              <li key={index}>
                <div className="to-line-main">
                  <strong>
                    {line.quantity} × {text(line, ar)}
                  </strong>
                  <span className="to-muted">
                    {ar ? line.variant_ar : line.variant_en}
                    {line.addons.length > 0 && ` + ${line.addons.join(', ')}`}
                  </span>
                  {line.notes && <small className="to-muted">{line.notes}</small>}
                  {line.person && <small className="to-person-tag">{line.person}</small>}
                </div>
                <span className="to-price">{price(line.quantity * line.unitPrice)}</span>
              </li>
            ))}
          </ul>
          {order.notes && <p className="to-muted">{order.notes}</p>}
          {perPerson.length > 1 && (
            <div className="to-split">
              <strong>{w.each}</strong>
              <ul>
                {perPerson.map((entry) => (
                  <li key={entry.person}>
                    <span>{entry.person}</span>
                    <span>{price(entry.total)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="to-total cashier-due">
            <span>{w.amountDue}</span>
            <strong>{price(order.total)}</strong>
          </div>
          {phase === 'review' ? (
            <div className="cashier-actions">
              <button
                type="button"
                className="button wide to-cta"
                disabled={busy}
                onClick={() => void pay()}
              >
                {w.received}
              </button>
              <button
                type="button"
                className="button secondary wide"
                disabled={busy}
                onClick={() => void cancel()}
              >
                {w.cancel}
              </button>
            </div>
          ) : (
            <div className="cashier-actions">
              <p className="to-status">
                <CheckCircle size={22} weight="fill" /> {w.sent}
              </p>
              <button type="button" className="button wide to-cta" onClick={reset}>
                {w.next}
              </button>
            </div>
          )}
        </section>
      )}
    </main>
  );
}

export function Cashier() {
  return (
    <StaffGate>
      <CashierDesk />
    </StaffGate>
  );
}
