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
      style={{ backgroundColor: 'var(--bg-elev)', borderBottom: '1px solid var(--border)' }}
      className="flex items-center gap-1 px-4 py-2 sticky top-0 z-50"
    >
      <span className="text-sm font-semibold tracking-tight mr-4" style={{ color: 'var(--color-accent-500)' }}>
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
            style={
              active
                ? { color: 'var(--fg)', backgroundColor: 'var(--bg-hover)', borderColor: 'var(--border-strong)' }
                : { color: 'var(--fg-muted)' }
            }
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors border ${
              active ? 'border-[var(--border-strong)]' : 'border-transparent hover:text-[var(--fg)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
