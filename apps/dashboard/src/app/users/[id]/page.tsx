type Params = { id: string };

export default async function UserDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  return <h1>User {id}</h1>;
}
