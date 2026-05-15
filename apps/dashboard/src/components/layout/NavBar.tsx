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
    <nav
      aria-label="primary navigation"
      className="flex items-center gap-1 px-4 py-2 border-b border-[#23272b] bg-[#0a0e11]"
    >
      <span className="text-[#f8f8f8] text-sm font-semibold mr-4 tracking-tight">
        Job Scheduler
      </span>
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
                ? 'bg-[#00a1c8]/15 text-[#00a1c8] font-semibold'
                : 'text-[#9a9fa5] hover:text-[#f8f8f8] hover:bg-[#1c2024]'
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
