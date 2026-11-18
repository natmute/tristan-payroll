import type { ReactNode } from 'react';

export function PageTitle({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold text-primary-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

const CHIP: Record<string, string> = {
  green: 'bg-green-100 text-green-800',
  amber: 'bg-amber-100 text-amber-900',
  grey: 'bg-slate-200 text-slate-700',
  blue: 'bg-primary-100 text-primary-800',
};

// Colour is never the only signal: the chip always carries text.
export function Chip({ tone = 'grey', children }: { tone?: keyof typeof CHIP; children: ReactNode }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${CHIP[tone]}`}>{children}</span>;
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-slate-200 bg-white p-4 shadow-sm ${className}`}>{children}</section>;
}

export function Th({ children, right }: { children?: ReactNode; right?: boolean }) {
  return (
    <th scope="col" className={`sticky top-0 bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 ${right ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  );
}

export function Td({ children, right, className = '' }: { children?: ReactNode; right?: boolean; className?: string }) {
  return <td className={`px-3 py-2 ${right ? 'text-right tabular-nums' : ''} ${className}`}>{children}</td>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">{children}</div>;
}

export function ErrorBox({ message }: { message: string }) {
  return <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-red-800">Database error: {message}</p>;
}
