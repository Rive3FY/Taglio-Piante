import { redirect } from "next/navigation";

export default async function LineaArchivioRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/tecnico/per-linea?linea=${encodeURIComponent(id)}`);
}
