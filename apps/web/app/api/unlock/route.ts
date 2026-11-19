import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function tokenFor(code: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`tdc-demo-gate:${code}`));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// POST /api/unlock. Checks the demo access code and sets a cookie. See middleware.ts.
export async function POST(req: Request) {
  const form = await req.formData();
  const given = String(form.get('code') ?? '');
  const next = String(form.get('next') ?? '/');
  // Only allow a path on this site, never another address.
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/';
  const expected = process.env.DEMO_ACCESS_CODE;
  const origin = new URL(req.url).origin;

  if (!expected || (await tokenFor(given)) !== (await tokenFor(expected))) {
    return NextResponse.redirect(`${origin}/unlock?error=1&next=${encodeURIComponent(safeNext)}`, 303);
  }
  const res = NextResponse.redirect(`${origin}${safeNext}`, 303);
  res.cookies.set('demo_access', await tokenFor(expected), {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 12,
  });
  return res;
}
