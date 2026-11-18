import type { Metadata } from 'next';
import './globals.css';
import { Banner } from '@/components/Banner';
import { Header } from '@/components/Header';

export const metadata: Metadata = {
  title: 'Tristan da Cunha Payroll (prototype)',
  description: 'Government of Tristan da Cunha payroll. Prototype with demo data.',
};

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
