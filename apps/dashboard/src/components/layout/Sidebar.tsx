import Link from 'next/link';

const NAV_ITEMS = [
  { href: '/queue', label: 'Queue' },
  { href: '/jobs', label: 'Jobs' },
  { href: '/users', label: 'Users' },
];

export default function Sidebar() {
  return (
    <nav aria-label="Primary" className="flex flex-col gap-2 p-4">
      {NAV_ITEMS.map((item) => (
        <Link key={item.href} href={item.href} className="hover:underline">
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
