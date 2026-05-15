'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/queue', label: '⏳ Queue' },
  { href: '/jobs', label: '🔧 Jobs' },
  { href: '/users', label: '👤 Users' },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-sm font-semibold text-gray-900">Job Scheduler</h1>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(({ href, label }) => {
          const active = pathname === href || pathname?.startsWith(href + '/');
          const cls = active
            ? 'block px-3 py-2 rounded text-sm font-medium bg-gray-100 text-gray-900'
            : 'block px-3 py-2 rounded text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900';
          return (
            <Link key={href} href={href} className={cls}>
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
