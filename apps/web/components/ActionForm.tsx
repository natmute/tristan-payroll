'use client';
import Link from 'next/link';
import { useRef, useState, useTransition } from 'react';

type Result = { error?: string } | void;

// Submits to a server action without resetting the form, so a failed or dropped
// request never loses what the user typed (Starlink can be slow or drop).
export function ActionForm({
  action,
  submitLabel,
  cancelHref,
  resetOnSuccess = false,
  compact = false,
  children,
}: {
  action: (formData: FormData) => Promise<Result>;
  submitLabel: string;
  cancelHref?: string;
  resetOnSuccess?: boolean;
  compact?: boolean;
  children: React.ReactNode;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={ref}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        setError(null);
        start(async () => {
          try {
            const result = await action(data);
            if (result && result.error) setError(result.error);
            else if (resetOnSuccess) ref.current?.reset();
          } catch {
            setError('Could not reach the server. Your input is still here, so try again when the connection is back.');
          }
        });
      }}
    >
      {children}
      {error && (
        <p role="alert" className="mt-3 rounded border border-red-300 bg-red-50 p-2 text-sm text-red-800">{error}</p>
      )}
      <div className={`flex items-center gap-3 ${compact ? 'mt-2' : 'mt-5'}`}>
        <button
          disabled={pending}
          className="rounded bg-primary-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
        >
          {pending ? 'Saving...' : submitLabel}
        </button>
        {cancelHref && <Link href={cancelHref} className="text-sm text-primary-700 hover:underline">Cancel</Link>}
      </div>
    </form>
  );
}
