import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { CheckCircle, Minus, Plus, Trash, X } from '@phosphor-icons/react';
import { isCodeExpired, personTotals, type OrderRecord, type TableOrderInput } from '@galal/shared';
import { useCafe } from '../context';
import { api, text, unitPrice, useCart } from '../lib';
import { useTable } from '../table';
import { useTableWords } from './tableWords';
import './table-order.css';

const tablePattern = /^[A-Za-z0-9-]{1,10}$/;

/** Step 1: review the bag, say which table, optionally split it between friends, and get the code. */
export function TableOrderNew() {
  const w = useTableWords();
  const { ar, price } = useCafe();
  const cart = useCart();
  const navigate = useNavigate();
  const knownTable = useTable();
  const [table, setTable] = useState(knownTable ?? '');
  const [group, setGroup] = useState(false);
  const [people, setPeople] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [assigned, setAssigned] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const lines = cart.lines;
  const personOf = (key: string) =>
    group ? (people.includes(assigned[key]) ? assigned[key] : (people[0] ?? '')) : '';
  const total = lines.reduce((sum, line) => sum + unitPrice(line) * line.quantity, 0);
  const perPerson = group
    ? personTotals(
        lines.map((line) => ({
          person: personOf(line.key),
          quantity: line.quantity,
          unitPrice: unitPrice(line),
        })),
      )
    : [];
  const mutation = useMutation({
    mutationFn: (input: TableOrderInput) =>
      api<OrderRecord>('/table-orders', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: (order) => {
      cart.clear();
      navigate(`/table-order/${order.id}?token=${order.accessToken}`, { replace: true });
    },
    onError: (e: Error) => setError(e.message),
  });
  const tableValid = tablePattern.test(table.trim());
  const needsNames = group && people.length === 0;
  const canSubmit = lines.length > 0 && tableValid && !needsNames && !mutation.isPending;
  const addPerson = () => {
    const name = draft.trim().slice(0, 40);
    if (name && !people.includes(name) && people.length < 12) setPeople([...people, name]);
    setDraft('');
  };
  const submit = () => {
    setError('');
    mutation.mutate({
      tableNumber: table.trim(),
      notes: notes.trim(),
      name: '',
      items: lines.map((line) => ({
        itemId: line.item.id,
        variantId: line.variantId,
        addonIds: line.addonIds,
        quantity: line.quantity,
        notes: line.notes,
        person: personOf(line.key),
      })),
    });
  };
  if (!lines.length)
    return (
      <main className="container to-page">
        <h1 className="to-title">{w.orderTitle}</h1>
        <p className="to-muted">{w.empty}</p>
        <Link className="button" to={knownTable ? `/menu?table=${knownTable}` : '/menu'}>
          {w.pickFromMenu}
        </Link>
      </main>
    );
  return (
    <main className="container to-page">
      <h1 className="to-title">{w.orderTitle}</h1>
      <section className="to-card" aria-label={w.tableLabel}>
        <label className="to-label" htmlFor="to-table">
          {w.tableLabel}
        </label>
        <input
          id="to-table"
          className="to-input to-table-input"
          value={table}
          maxLength={10}
          autoComplete="off"
          inputMode="text"
          onChange={(e) => setTable(e.target.value.replace(/[^A-Za-z0-9-]/g, ''))}
          aria-invalid={table !== '' && !tableValid}
        />
        <small className="to-muted">{tableValid || !table ? w.tableHint : w.tableInvalid}</small>
      </section>
      <section className="to-card">
        <div className="to-segment" role="group" aria-label={w.group}>
          <button type="button" aria-pressed={!group} onClick={() => setGroup(false)}>
            {w.alone}
          </button>
          <button type="button" aria-pressed={group} onClick={() => setGroup(true)}>
            {w.group}
          </button>
        </div>
        {group && (
          <div className="to-people">
            <small className="to-muted">{w.groupHint}</small>
            <div className="to-person-row">
              <input
                className="to-input"
                value={draft}
                maxLength={40}
                placeholder={w.personName}
                aria-label={w.personName}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addPerson();
                  }
                }}
              />
              <button type="button" className="button" onClick={addPerson}>
                {w.addPerson}
              </button>
            </div>
            {people.length > 0 && (
              <ul className="to-chips">
                {people.map((name) => (
                  <li key={name}>
                    {name}
                    <button
                      type="button"
                      aria-label={`${w.remove} ${name}`}
                      onClick={() => setPeople(people.filter((p) => p !== name))}
                    >
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {needsNames && <small className="to-error">{w.needName}</small>}
          </div>
        )}
      </section>
      <section className="to-card" aria-label={w.items}>
        <ul className="to-lines">
          {lines.map((line) => (
            <li key={line.key}>
              <div className="to-line-main">
                <strong>{text(line.item, ar)}</strong>
                <span className="to-muted">
                  {text(
                    line.item.variants.find((v) => v.id === line.variantId) ??
                      line.item.variants[0],
                    ar,
                  )}
                  {line.addonIds.length > 0 &&
                    ` + ${line.item.addons
                      .filter((a) => line.addonIds.includes(a.id))
                      .map((a) => text(a, ar))
                      .join(', ')}`}
                </span>
                {line.notes && <small className="to-muted">{line.notes}</small>}
                {group && people.length > 0 && (
                  <label className="to-assign">
                    <span>{w.whoFor}</span>
                    <select
                      value={personOf(line.key)}
                      onChange={(e) => setAssigned({ ...assigned, [line.key]: e.target.value })}
                    >
                      {people.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              <div className="to-line-side">
                <span className="to-price">{price(unitPrice(line) * line.quantity)}</span>
                <div className="to-stepper">
                  <button
                    type="button"
                    aria-label="-"
                    onClick={() =>
                      line.quantity > 1
                        ? cart.setQuantity(line.key, line.quantity - 1)
                        : cart.remove(line.key)
                    }
                  >
                    {line.quantity > 1 ? <Minus size={16} /> : <Trash size={16} />}
                  </button>
                  <span>{line.quantity}</span>
                  <button
                    type="button"
                    aria-label="+"
                    onClick={() => cart.setQuantity(line.key, line.quantity + 1)}
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
        {group && perPerson.length > 1 && (
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
        <label className="to-label" htmlFor="to-notes">
          {w.notes}
        </label>
        <textarea
          id="to-notes"
          className="to-input"
          rows={2}
          maxLength={500}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <div className="to-total">
          <span>{w.total}</span>
          <strong>{price(total)}</strong>
        </div>
      </section>
      {error && (
        <p className="notice to-error" role="alert">
          {error}
        </p>
      )}
      <button type="button" className="button wide to-cta" disabled={!canSubmit} onClick={submit}>
        {mutation.isPending ? w.sending : w.confirm}
      </button>
    </main>
  );
}

/** Step 2: show the short code as a QR, then follow the order live until it is ready. */
export function TableOrderView() {
  const w = useTableWords();
  const { ar, price } = useCafe();
  const { id } = useParams();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [qr, setQr] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const query = useQuery({
    queryKey: ['table-order', id],
    queryFn: () => api<OrderRecord>(`/orders/${id}?token=${encodeURIComponent(token)}`),
    retry: false,
    staleTime: 0,
    refetchInterval: (q) =>
      q.state.data && ['completed', 'cancelled'].includes(q.state.data.status) ? false : 4000,
  });
  const order = query.data;
  const code = order?.pickupCode ?? '';
  const waiting = order?.status === 'awaiting_payment';
  useEffect(() => {
    if (!code) return;
    let current = true;
    void QRCode.toDataURL(`${window.location.origin}/cashier?code=${code}`, {
      width: 360,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#10342A', light: '#FFFFFF' },
    }).then((url) => current && setQr(url));
    return () => {
      current = false;
    };
  }, [code]);
  useEffect(() => {
    if (!waiting) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [waiting]);
  if (query.isPending)
    return (
      <main className="container to-page">
        <p className="to-muted">{w.loading}</p>
      </main>
    );
  if (!order)
    return (
      <main className="container to-page">
        <p className="notice">{w.notFound}</p>
        <Link className="button" to="/menu">
          {w.pickFromMenu}
        </Link>
      </main>
    );
  const expired = waiting && isCodeExpired(order.codeExpiresAt, now);
  const remaining = Math.max(0, new Date(order.codeExpiresAt ?? 0).getTime() - now);
  const clock = `${String(Math.floor(remaining / 60000)).padStart(2, '0')}:${String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0')}`;
  const step = { confirmed: 0, preparing: 1, ready: 2, completed: 2 }[
    order.status as 'confirmed' | 'preparing' | 'ready' | 'completed'
  ];
  const perPerson = personTotals(order.items);
  return (
    <main className="container to-page">
      <h1 className="to-title">
        {order.tableNumber ? `${w.table} ${order.tableNumber}` : w.orderTitle}
      </h1>
      {waiting && !expired && (
        <section className="to-card to-code-card">
          <h2>{w.codeTitle}</h2>
          {qr && (
            <img
              className="to-qr"
              src={qr}
              alt={`${w.codeLabel} ${code}`}
              width="260"
              height="260"
            />
          )}
          <p className="to-code" dir="ltr" aria-label={w.codeLabel}>
            {code.slice(0, 3)} {code.slice(3)}
          </p>
          <p className="to-muted">{w.codeHelp}</p>
          <p className="to-timer">
            {w.validFor} <b dir="ltr">{clock}</b>
          </p>
        </section>
      )}
      {expired && (
        <section className="to-card">
          <p className="notice to-error">{w.expired}</p>
          <Link className="button" to="/menu">
            {w.newOrder}
          </Link>
        </section>
      )}
      {order.status === 'cancelled' && <p className="notice to-error">{w.cancelled}</p>}
      {step !== undefined && (
        <section className="to-card" aria-live="polite">
          <ol className="to-steps">
            {[w.stepPaid, w.stepPreparing, w.stepReady].map((label, index) => (
              <li key={label} data-done={index <= step} data-current={index === step}>
                <CheckCircle size={22} weight={index <= step ? 'fill' : 'regular'} />
                <span>{label}</span>
              </li>
            ))}
          </ol>
          <p className="to-status">
            {
              {
                confirmed: w.paid,
                preparing: w.preparing,
                ready: w.ready,
                completed: w.done,
              }[order.status as 'confirmed' | 'preparing' | 'ready' | 'completed']
            }
          </p>
        </section>
      )}
      <section className="to-card" aria-label={w.items}>
        <ul className="to-lines to-lines-readonly">
          {order.items.map((line, index) => (
            <li key={index}>
              <div className="to-line-main">
                <strong>
                  {line.quantity} × {text(line, ar)}
                </strong>
                <span className="to-muted">{ar ? line.variant_ar : line.variant_en}</span>
                {line.person && <small className="to-person-tag">{line.person}</small>}
              </div>
              <span className="to-price">{price(line.quantity * line.unitPrice)}</span>
            </li>
          ))}
        </ul>
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
        <div className="to-total">
          <span>{w.total}</span>
          <strong>{price(order.total)}</strong>
        </div>
      </section>
    </main>
  );
}
