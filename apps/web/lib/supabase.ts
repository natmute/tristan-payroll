import 'server-only';
import { createClient } from '@supabase/supabase-js';

// Server-side only. Uses the service role key, which bypasses RLS.
// Never import this from a client component.
export function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env vars are missing. See apps/web/.env.example.');
  return createClient(url, key, { auth: { persistSession: false } });
}
