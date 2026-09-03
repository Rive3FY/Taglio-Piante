import { redirect } from "next/navigation";

export default function TecnicoBozzeRedirect() {
  redirect("/tecnico/fogli?s=bozze");
}
