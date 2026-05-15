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
    <html lang="en" suppressHydrationWarning>
      <body className="bg-[#0a0e11] text-[#f8f8f8] antialiased min-h-screen">
        <NavBar />
        {children}
      </body>
    </html>
  );
}
