import { Card } from '@/components/ui';

// Shown only when DEMO_ACCESS_CODE is set. See middleware.ts.
export default async function UnlockPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-4 text-2xl font-semibold text-primary-900">Demo access</h1>
      <Card>
        <p className="mb-4 text-sm text-slate-700">This is a prototype with demo data. Enter the access code you were given.</p>
        <form method="post" action="/api/unlock">
          <input type="hidden" name="next" value={sp.next ?? '/'} />
          <label htmlFor="code" className="mb-1 block text-sm text-slate-700">Access code</label>
          <input id="code" name="code" type="password" autoComplete="off" required
            className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          {sp.error && <p role="alert" className="mt-3 rounded border border-red-300 bg-red-50 p-2 text-sm text-red-800">That code is not right. Try again.</p>}
          <button className="mt-4 rounded bg-primary-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-700">Continue</button>
        </form>
      </Card>
    </div>
  );
}
