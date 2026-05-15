import type { Metadata } from 'next';
import Link from 'next/link';
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
      <body>
        <nav
          aria-label="main navigation"
          className="flex gap-4 p-4 border-b"
        >
          <Link href="/">Home</Link>
          <Link href="/queue">Queue</Link>
          <Link href="/jobs">Jobs</Link>
          <Link href="/users">Users</Link>
        </nav>
        {children}
      </body>
    </html>
  );
}
