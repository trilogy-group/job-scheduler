type Params = { id: string };

export default async function JobDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  return <h1>Job {id}</h1>;
}
