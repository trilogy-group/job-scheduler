/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeJob } from './fixtures';

// --- Mocks (declared before page imports) -------------------------------

const redirectMock = vi.fn();
const notFoundMock = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});

// Per-test holders for client-side hooks.
let currentParams: Record<string, string> = {};
let currentSearchParams: Record<string, string> = {};

vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => redirectMock(...args),
  notFound: (...args: unknown[]) => notFoundMock(...args),
  usePathname: () => '/queue',
  useParams: () => currentParams,
  useSearchParams: () => ({
    get: (key: string) => currentSearchParams[key] ?? null,
  }),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
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

// Mock the supabase singleton so lib fetch functions can be re-pointed per test.
vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn() },
  LOCAL_DEV_USER_ID: null,
}));

// Mock supabase-server so anything that still imports it stays safe.
const createServerClientMock = vi.fn();
vi.mock('@/lib/supabase-server', () => ({
  createServerClient: (...args: unknown[]) => createServerClientMock(...args),
}));

// Mock supabase-browser — this is what the dashboard pages now use.
const createBrowserClientMock = vi.fn();
vi.mock('@/lib/supabase-browser', () => ({
  createBrowserClient: (...args: unknown[]) => createBrowserClientMock(...args),
}));

// Mock the recharts-based chart so jsdom doesn't need ResizeObserver.
vi.mock('@/components/charts/JobsOverTimeChart', () => ({
  default: () => <div data-testid="jobs-over-time-chart-mock" />,
}));

import { supabase } from '@/lib/supabase';

function chain(result: { data: unknown; error: unknown }) {
  const c: any = {};
  for (const m of ['select', 'eq', 'order', 'limit', 'in']) {
    c[m] = vi.fn(() => c);
  }
  c.single = vi.fn(() => Promise.resolve(result));
  c.maybeSingle = vi.fn(() => Promise.resolve(result));
  c.then = (resolve: (v: unknown) => unknown) => resolve(result);
  return c;
}

const mockedFrom = supabase.from as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockedFrom.mockReset();
  createServerClientMock.mockReturnValue({ from: mockedFrom });
  createBrowserClientMock.mockReturnValue({ from: mockedFrom });
  redirectMock.mockReset();
  notFoundMock.mockClear();
  currentParams = {};
  currentSearchParams = {};
});

// --- Root page (redirect) -----------------------------------------------

describe('app/page.tsx (root)', () => {
  it('redirects to /queue', async () => {
    const { default: Home } = await import('@/app/page');
    Home();
    expect(redirectMock).toHaveBeenCalledWith('/queue');
  });
});

// --- Root layout --------------------------------------------------------

describe('app/layout.tsx', () => {
  it('renders children inside main element', async () => {
    // layout.tsx imports './globals.css' — stub that with a virtual module.
    vi.doMock('../../src/app/globals.css', () => ({}), { virtual: true } as any);
    const mod = await import('@/app/layout');
    const RootLayout = mod.default;
    // Render the layout's body content directly (skip <html>/<body> wrappers
    // because react-dom won't append them inside jsdom's existing document).
    const layoutTree = RootLayout({ children: <span>child-marker</span> }) as any;
    // layoutTree is <html><body>...</body></html>. Pull out the body's children.
    const body = layoutTree.props.children;
    const fragment = <>{body.props.children}</>;
    const { container } = render(fragment);
    expect(container.textContent).toContain('child-marker');
    expect(mod.metadata.title).toBe('Job Scheduler Dashboard');
  });
});

// --- Queue page ---------------------------------------------------------

describe('app/queue/page.tsx', () => {
  it('renders Active Queue header and queue table on success', async () => {
    mockedFrom.mockReturnValue(chain({ data: [makeJob({ state: 'QUEUED' })], error: null }));
    const { default: QueuePage } = await import('@/app/queue/page');
    render(<QueuePage />);
    expect(await screen.findByText(/Active Queue/)).toBeTruthy();
  });

  it('renders Active Queue with empty table when fetch errors', async () => {
    mockedFrom.mockReturnValue(chain({ data: null, error: new Error('down') }));
    const { default: QueuePage } = await import('@/app/queue/page');
    const { container } = render(<QueuePage />);
    expect(container.textContent).toMatch(/Active Queue/);
    // With default QUEUED+PROGRESS filter, empty state shows 'No active jobs'
    expect(await screen.findByText(/No active jobs/)).toBeTruthy();
  });
});

// --- Jobs index page ----------------------------------------------------

describe('app/jobs/page.tsx', () => {
  it('renders All Jobs header and jobs table on success', async () => {
    mockedFrom.mockReturnValue(chain({ data: [makeJob({ state: 'SUCCESS' })], error: null }));
    const { default: JobsPage } = await import('@/app/jobs/page');
    const { container } = render(<JobsPage />);
    expect(container.textContent).toMatch(/All Jobs/);
    // wait a tick for state update to settle
    await screen.findByText(/All Jobs/);
  });
});

// --- Job detail page ----------------------------------------------------

describe('app/jobs/[id]/page.tsx', () => {
  it('renders job detail on success', async () => {
    const job = makeJob({ id: 'jjjjjjjj-1111-2222-3333-444444444444', display_name: 'D-Job' });
    mockedFrom.mockReturnValue(chain({ data: job, error: null }));
    const { default: JobDetail } = await import('@/app/jobs/[id]/page');
    const tree = await JobDetail({ params: Promise.resolve({ id: job.id }) });
    const { container } = render(tree);
    expect(container.textContent).toContain('D-Job');
  });

  it('falls back to id slice when display_name is null', async () => {
    const job = makeJob({
      id: 'kkkkkkkk-1111-2222-3333-444444444444',
      display_name: null,
    });
    mockedFrom.mockReturnValue(chain({ data: job, error: null }));
    const { default: JobDetail } = await import('@/app/jobs/[id]/page');
    const tree = await JobDetail({ params: Promise.resolve({ id: job.id }) });
    const { container } = render(tree);
    expect(container.textContent).toContain('kkkkkkkk');
  });

  it('renders "Job not found" when job is missing', async () => {
    mockedFrom.mockReturnValue(chain({ data: null, error: null }));
    const { default: JobDetail } = await import('@/app/jobs/[id]/page');
    const tree = await JobDetail({ params: Promise.resolve({ id: 'missing' }) });
    const { container } = render(tree);
    expect(container.textContent).toMatch(/Job not found/);
  });
});

// --- Users index page ---------------------------------------------------

describe('app/users/page.tsx', () => {
  it('renders Users header and users table on success', async () => {
    mockedFrom.mockImplementation((table: string) => {
      if (table === 'users') {
        return chain({
          data: [{ id: 'u-1', email: 'alice@x.com', created_at: '2026-05-01T10:00:00Z' }],
          error: null,
        });
      }
      return chain({ data: [], error: null });
    });
    const { default: UsersPage } = await import('@/app/users/page');
    render(<UsersPage />);
    expect(await screen.findByText(/Users/)).toBeTruthy();
  });
});

// --- User detail page ---------------------------------------------------

describe('app/users/[id]/page.tsx', () => {
  it('renders user stats and job history on success', async () => {
    const user = { id: 'uuuuuuuu-1111-2222-3333-444444444444', email: 'carol@x.com' };
    const jobs = [
      {
        id: 'jjjjjjjj-0000-0000-0000-000000000001',
        kind: 'SFT',
        state: 'SUCCESS',
        display_name: 'job-1',
        gpu_count: 4,
        created_at: '2026-05-01T10:00:00Z',
        started_at: '2026-05-01T10:05:00Z',
        completed_at: '2026-05-01T11:05:00Z',
      },
      {
        id: 'mmmmmmmm-0000-0000-0000-000000000002',
        kind: 'DPO',
        state: 'FAIL',
        display_name: null,
        gpu_count: 2,
        created_at: '2026-05-02T10:00:00Z',
        started_at: null,
        completed_at: null,
      },
    ];
    mockedFrom.mockImplementation((table: string) => {
      if (table === 'users') return chain({ data: user, error: null });
      return chain({ data: jobs, error: null });
    });
    currentParams = { id: user.id };
    currentSearchParams = {};
    const { default: UserDetail } = await import('@/app/users/[id]/page');
    render(<UserDetail />);
    // email may appear in both header and jobs table rows
    const emailEls = await screen.findAllByText('carol@x.com');
    expect(emailEls.length).toBeGreaterThanOrEqual(1);
    expect(await screen.findByText(/Total Jobs/)).toBeTruthy();
  });

  it('renders empty job history', async () => {
    const user = { id: 'uuuuuuuu-1111-2222-3333-555555555555', email: 'dan@x.com' };
    mockedFrom.mockImplementation((table: string) => {
      if (table === 'users') return chain({ data: user, error: null });
      return chain({ data: [], error: null });
    });
    currentParams = { id: user.id };
    currentSearchParams = {};
    const { default: UserDetail } = await import('@/app/users/[id]/page');
    render(<UserDetail />);
    expect(await screen.findByText(/No jobs for this user/)).toBeTruthy();
  });

  it('renders "User not found" when the user does not exist', async () => {
    mockedFrom.mockImplementation(() => chain({ data: null, error: null }));
    currentParams = { id: 'missing' };
    currentSearchParams = {};
    const { default: UserDetail } = await import('@/app/users/[id]/page');
    render(<UserDetail />);
    expect(await screen.findByText(/User not found/)).toBeTruthy();
  });
});

// --- types.ts (type-only file, import for coverage no-op) ---------------

describe('lib/types module', () => {
  it('imports without side effects', async () => {
    const mod = await import('@/lib/types');
    expect(mod).toBeDefined();
  });
});
