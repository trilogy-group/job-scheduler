import Link from 'next/link';

export default function DashboardPage() {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-sm text-gray-600">
        Operator overview for the Fireworks job scheduler.
      </p>
      <Link href="/queue" className="text-blue-600 hover:underline">
        View Queue
      </Link>
    </main>
  );
}
