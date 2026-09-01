import { requireTecnico } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function errore(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

function normalizza(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export async function POST(request: Request) {
  const auth = await requireTecnico(request);
  if (!auth.ok) return errore(auth.message, auth.status);

  const body = (await request.json().catch(() => null)) as
    | { nome?: string; email?: string; password?: string }
    | null;

  const nome = normalizza(body?.nome);
  const email = normalizza(body?.email).toLowerCase();
  const password = typeof body?.password === "string" ? body.password : "";

  if (!nome) return errore("Indica nome e cognome.", 400);
  if (!email.includes("@")) return errore("Indica un indirizzo email valido.", 400);
  if (password.length < 8) return errore("La password deve avere almeno 8 caratteri.", 400);

  const { data: creato, error: createError } = await auth.admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nome },
  });

  if (createError || !creato.user) {
    const message = createError?.message ?? "Creazione account non riuscita.";
    const conflitto = /already|registered|exists/i.test(message);
    return errore(conflitto ? "Esiste già un account con questa email." : message, conflitto ? 409 : 400);
  }

  const { error: profiloError } = await auth.admin.from("profili").insert({
    user_id: creato.user.id,
    nome,
    email,
    ruolo: "operatore",
  });

  if (profiloError) {
    await auth.admin.auth.admin.deleteUser(creato.user.id);
    return errore(profiloError.message, 400);
  }

  return Response.json({
    operatore: { id: creato.user.id, nome, email, ruolo: "operatore" },
  });
}

export async function PATCH(request: Request) {
  const auth = await requireTecnico(request);
  if (!auth.ok) return errore(auth.message, auth.status);

  const body = (await request.json().catch(() => null)) as
    | { userId?: string; nome?: string; password?: string; firma?: string | null }
    | null;

  const userId = normalizza(body?.userId);
  const nome = normalizza(body?.nome);
  const password = typeof body?.password === "string" ? body.password : "";
  const cambiaFirma = Boolean(body && "firma" in body);
  const firma = typeof body?.firma === "string" ? body.firma : null;

  if (!userId) return errore("Operatore non indicato.", 400);
  if (!nome && !password && !cambiaFirma) return errore("Niente da aggiornare.", 400);
  if (password && password.length < 8) {
    return errore("La password deve avere almeno 8 caratteri.", 400);
  }
  if (firma && !firma.startsWith("data:image/")) {
    return errore("Formato firma non valido.", 400);
  }
  if (firma && firma.length > 1_000_000) {
    return errore("Firma troppo pesante: usa un’immagine più piccola.", 400);
  }

  if (nome) {
    const { error } = await auth.admin
      .from("profili")
      .update({ nome, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (error) return errore(error.message, 400);

    const { error: metaError } = await auth.admin.auth.admin.updateUserById(userId, {
      user_metadata: { nome },
    });
    if (metaError) return errore(metaError.message, 400);
  }

  if (password) {
    const { error } = await auth.admin.auth.admin.updateUserById(userId, { password });
    if (error) return errore(error.message, 400);
  }

  if (cambiaFirma) {
    const { error } = await auth.admin
      .from("profili")
      .update({ firma, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (error) return errore(error.message, 400);
  }

  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const auth = await requireTecnico(request);
  if (!auth.ok) return errore(auth.message, auth.status);

  const body = (await request.json().catch(() => null)) as { userId?: string } | null;
  const userId = normalizza(body?.userId);

  if (!userId) return errore("Operatore non indicato.", 400);
  if (userId === auth.profilo.user_id) return errore("Non puoi eliminare il tuo account.", 400);

  const { data: profilo } = await auth.admin
    .from("profili")
    .select("ruolo")
    .eq("user_id", userId)
    .maybeSingle();

  if (profilo?.ruolo === "tecnico") return errore("Non puoi eliminare un account tecnico.", 400);

  const { error } = await auth.admin.auth.admin.deleteUser(userId);
  if (error) return errore(error.message, 400);

  return Response.json({ ok: true });
}
