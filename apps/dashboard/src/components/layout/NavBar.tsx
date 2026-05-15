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
      style={{
        background: 'var(--bg-elev)',
        borderBottom: '1px solid var(--border)',
      }}
      className="flex items-center gap-1 px-4 py-2"
    >
      {/* Brand mark */}
      <div className="flex items-center gap-1.5 mr-6">
        <span
          className="block size-2 rounded-full"
          style={{ background: 'var(--color-accent-500)' }}
        />
        <span
          className="text-sm font-semibold tracking-tight"
          style={{ color: 'var(--fg)' }}
        >
          Scheduler
        </span>
      </div>

      {NAV_ITEMS.map(({ href, label, testId }) => {
        const active = pathname === href || pathname.startsWith(href + '/');
        return (
          <Link
            key={href}
            href={href}
            data-testid={testId}
            aria-current={active ? 'page' : undefined}
            className="px-3 py-1.5 rounded text-sm font-medium transition-colors"
            style={{
              color: active ? 'var(--fg)' : 'var(--fg-muted)',
              background: active ? 'var(--bg-hover)' : 'transparent',
              borderLeft: active ? '2px solid var(--color-accent-500)' : '2px solid transparent',
            }}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
