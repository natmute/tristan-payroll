import { db } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const { count, error } = await db().from('employees').select('*', { count: 'exact', head: true });
  return (
    <div>
      <h1 className="text-2xl font-semibold text-primary-900">Dashboard</h1>
      {error ? (
        <p className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-red-800">Database error: {error.message}</p>
      ) : (
        <p className="mt-4 text-slate-700">Connected. {count} employees in the demo database.</p>
      )}
    </div>
  );
}
