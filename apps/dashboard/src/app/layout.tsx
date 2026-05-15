import type { Metadata } from 'next';
import { NavBar } from '@/components/layout/NavBar';
import './globals.css';

export const metadata: Metadata = {
  title: 'Job Scheduler Dashboard',
  description: 'Operator dashboard for the Fireworks job scheduler.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full" style={{ background: 'var(--bg)', color: 'var(--fg)' }}>
        <NavBar />
        {children}
      </body>
    </html>
  );
}
