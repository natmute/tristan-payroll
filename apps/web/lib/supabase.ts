import 'server-only';
import { createClient } from '@supabase/supabase-js';

// The island's link (Starlink) can stall or drop. A request that hangs would freeze the page, so every
// database call gets a timeout. Reads are safe to repeat, so they retry. Writes are never retried
// automatically (a retry could save twice): the user sees an error, keeps their input, and tries again.
const READ_TIMEOUT_MS = 8_000;
const READ_ATTEMPTS = 3;
const WRITE_TIMEOUT_MS = 25_000;
const SLOW_MS = 3_000;

const resilientFetch: typeof fetch = async (input, init) => {
  const method = (init?.method ?? 'GET').toUpperCase();
  const isRead = method === 'GET' || method === 'HEAD';
  const attempts = isRead ? READ_ATTEMPTS : 1;
  const where = String(typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url)
    .replace(/^https?:\/\/[^/]+/, '').slice(0, 90);

  for (let attempt = 1; ; attempt++) {
    const started = Date.now();
    const timeout = AbortSignal.timeout(isRead ? READ_TIMEOUT_MS : WRITE_TIMEOUT_MS);
    try {
      const res = await fetch(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout });
      const ms = Date.now() - started;
      if (ms > SLOW_MS) console.warn(`[slow database call] ${method} ${where} took ${ms}ms`);
      return res;
    } catch (error) {
      console.warn(`[database call failed] ${method} ${where} attempt ${attempt}/${attempts} after ${Date.now() - started}ms: ${(error as Error).message}`);
      if (attempt >= attempts) throw error;
    }
  }
};

// Server-side only. Uses the service role key, which bypasses RLS.
// Never import this from a client component.
export function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env vars are missing. See apps/web/.env.example.');
  return createClient(url, key, { auth: { persistSession: false }, global: { fetch: resilientFetch } });
}
