import type { Metadata } from 'next';
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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
