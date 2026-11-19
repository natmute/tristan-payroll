import type { Metadata } from 'next';
import './globals.css';
import { Banner } from '@/components/Banner';
import { Header } from '@/components/Header';

export const metadata: Metadata = {
  title: 'Tristan da Cunha Payroll (prototype)',
  description: 'Government of Tristan da Cunha payroll. Prototype with demo data.',
};

// Server actions and pages may take a few seconds on a slow link. Allow up to 30s on hosts that cap run time.
export const maxDuration = 30;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body>
        <Banner />
        <Header />
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
