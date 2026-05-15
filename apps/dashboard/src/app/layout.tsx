import type { Metadata } from 'next';
import { NavBar } from '@/components/layout/NavBar';
import './globals.css';

export const metadata: Metadata = {
  title: 'Job Scheduler Dashboard',
  description: 'Operator dashboard for the Fireworks fine-tuning job scheduler.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-[var(--bg)] text-[var(--fg)] min-h-screen">
        <NavBar />
        <main className="px-4 py-6 max-w-[1600px] mx-auto">
          {children}
        </main>
      </body>
    </html>
  );
}
