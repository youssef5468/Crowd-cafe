import type { ReactNode } from 'react';
import { useUser } from '../context';
import { AuthForm } from './Account';
import { useTableWords } from './tableWords';

/** Cashier and barista screens need a staff or owner account; everyone else sees the sign-in form. */
export function StaffGate({ children }: { children: ReactNode }) {
  const user = useUser();
  const w = useTableWords();
  if (user.isPending)
    return (
      <main className="container to-page">
        <p className="to-muted">{w.loading}</p>
      </main>
    );
  if (!user.data) return <AuthForm />;
  if (!['staff', 'owner'].includes(user.data.role))
    return (
      <main className="container to-page">
        <p className="notice">{w.staffOnly}</p>
      </main>
    );
  return <>{children}</>;
}
