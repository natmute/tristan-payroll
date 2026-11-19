import { NextResponse, type NextRequest } from 'next/server';

// Demo access gate. The prototype has no real login, so anyone who finds the URL could switch to
// Administrator and edit data. When DEMO_ACCESS_CODE is set, every page needs the code first.
// This is NOT real authentication and is removed when real auth arrives in the full build.
// Leave DEMO_ACCESS_CODE unset for local development.
async function tokenFor(code: string): Promise<string> {
  const bytes = new TextEncoder().encode(`tdc-demo-gate:${code}`);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function middleware(req: NextRequest) {
  const code = process.env.DEMO_ACCESS_CODE;
  if (!code) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (pathname === '/unlock' || pathname === '/api/unlock') return NextResponse.next();
  if (req.cookies.get('demo_access')?.value === (await tokenFor(code))) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = '/unlock';
  url.search = `?next=${encodeURIComponent(pathname + req.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
