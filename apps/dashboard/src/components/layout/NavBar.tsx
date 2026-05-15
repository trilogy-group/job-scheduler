'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/queue', label: 'Queue', testId: 'nav-queue' },
  { href: '/jobs', label: 'Jobs', testId: 'nav-jobs' },
  { href: '/users', label: 'Users', testId: 'nav-users' },
] as const;

export function NavBar() {
  const pathname = usePathname() ?? '';
  return (
    <nav aria-label="primary navigation" className="flex gap-1 px-4 py-2 border-b bg-white">
      {NAV_ITEMS.map(({ href, label, testId }) => {
        const active = pathname === href || pathname.startsWith(href + '/');
        return (
          <Link
            key={href}
            href={href}
            data-testid={testId}
            aria-current={active ? 'page' : undefined}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              active
                ? 'bg-blue-600 text-white font-bold underline'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
