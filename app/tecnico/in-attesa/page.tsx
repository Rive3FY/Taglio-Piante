import { redirect } from "next/navigation";

export default function InAttesaPage() {
  redirect("/tecnico/fogli?s=archiviati");
}
