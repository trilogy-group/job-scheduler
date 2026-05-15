export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Job Detail</h2>
      <p className="text-gray-500">Job ID: {id}</p>
    </div>
  );
}
