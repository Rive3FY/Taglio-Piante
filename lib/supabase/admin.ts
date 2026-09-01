import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Ruolo } from "@/lib/types";

let admin: SupabaseClient | null = null;

/** Client con service role: bypassa RLS, deve restare solo lato server. */
export function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) return null;
  if (!admin) {
    admin = createClient(url, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}

export type Profilo = {
  user_id: string;
  nome: string;
  email: string;
  ruolo: Ruolo;
};

type AuthResult =
  | { ok: true; profilo: Profilo; admin: SupabaseClient }
  | { ok: false; status: number; message: string };

/** Verifica il token del chiamante e pretende che sia il tecnico. */
export async function requireTecnico(request: Request): Promise<AuthResult> {
  const client = getAdmin();
  if (!client) {
    return { ok: false, status: 500, message: "Server non configurato: manca SUPABASE_SERVICE_ROLE_KEY." };
  }

  const header = request.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token) return { ok: false, status: 401, message: "Accesso non autorizzato." };

  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return { ok: false, status: 401, message: "Sessione non valida." };

  const { data: profilo } = await client
    .from("profili")
    .select("user_id, nome, email, ruolo")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (!profilo || profilo.ruolo !== "tecnico") {
    return { ok: false, status: 403, message: "Operazione riservata al tecnico." };
  }

  return { ok: true, profilo: profilo as Profilo, admin: client };
}
