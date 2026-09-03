import { redirect } from "next/navigation";

export default function TecnicoArchiviatiRedirect() {
  redirect("/tecnico/fogli?s=archiviati");
}
