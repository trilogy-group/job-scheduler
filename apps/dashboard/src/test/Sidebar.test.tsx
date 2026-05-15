import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

const pathnameRef = { current: '/queue' };

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameRef.current,
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

import { Sidebar } from '@/components/Sidebar';

describe('Sidebar', () => {
  it('renders the brand title and nav items', () => {
    pathnameRef.current = '/queue';
    render(<Sidebar />);
    expect(screen.getByText('Job Scheduler')).toBeTruthy();
    expect(screen.getByText(/Queue/)).toBeTruthy();
    expect(screen.getByText(/Jobs/)).toBeTruthy();
    expect(screen.getByText(/Users/)).toBeTruthy();
  });

  it('marks the current pathname as active (exact match)', () => {
    pathnameRef.current = '/jobs';
    render(<Sidebar />);
    const jobsLink = screen.getByText(/Jobs/).closest('a');
    expect(jobsLink?.className).toMatch(/bg-gray-100/);
    const queueLink = screen.getByText(/Queue/).closest('a');
    expect(queueLink?.className).not.toMatch(/bg-gray-100/);
  });

  it('marks the current pathname as active (prefix match)', () => {
    pathnameRef.current = '/jobs/abc-123';
    render(<Sidebar />);
    const jobsLink = screen.getByText(/Jobs/).closest('a');
    expect(jobsLink?.className).toMatch(/bg-gray-100/);
  });

  it('tolerates a null pathname', () => {
    // @ts-expect-error — exercising the optional chaining branch
    pathnameRef.current = null;
    render(<Sidebar />);
    const queueLink = screen.getByText(/Queue/).closest('a');
    expect(queueLink?.className).not.toMatch(/bg-gray-100/);
  });
});
