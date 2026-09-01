"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db, enqueueSync, nextNumero, deleteRapportino } from "@/lib/db";
import { formatDate, lineaDescrizione, todayIso, uid } from "@/lib/format";
import { officialSchedaObjectUrl } from "@/lib/fillScheda";
import { matchOperatore, OPERATORI } from "@/lib/operatori";
import { useSession } from "@/lib/SessionContext";
import type { Ditta, Linea, Prestazione, Rapportino, RapportinoRiga } from "@/lib/types";
import { LineaPicker } from "./LineaPicker";
import { SignaturePad } from "./SignaturePad";

const EMPTY_LINEE: Linea[] = [];
const EMPTY_DITTE: Ditta[] = [];
const EMPTY_PREST: Prestazione[] = [];
const DEFAULT_RAPPRESENTANTE = "Sali Kali";

type Props = {
  existing?: Rapportino;
  mode: "compile" | "assign";
};

export function RapportinoForm({ existing, mode }: Props) {
  const router = useRouter();
  const { session } = useSession();
  const linee = useLiveQuery(() => db.linee.toArray(), []) ?? EMPTY_LINEE;
  const ditte = useLiveQuery(() => db.ditte.toArray(), []) ?? EMPTY_DITTE;
  const prestazioniRaw = useLiveQuery(() => db.prestazioni.toArray(), []) ?? EMPTY_PREST;
  const prestazioni = useMemo(
    () => [...prestazioniRaw].sort((a, b) => a.codice.localeCompare(b.codice, "it")),
    [prestazioniRaw],
  );

  const [lineaId, setLineaId] = useState(existing?.lineaId ?? "");
  const [campata, setCampata] = useState(existing?.campata ?? "");
  const [dataLavoro, setDataLavoro] = useState(existing?.dataLavoro ?? todayIso());
  const [ditta, setDitta] = useState(existing?.ditta ?? "");
  const [rappresentanteDitta, setRappresentanteDitta] = useState(
    existing?.rappresentanteDitta || DEFAULT_RAPPRESENTANTE,
  );
  const [dipendenteTerna, setDipendenteTerna] = useState(
    matchOperatore(existing?.dipendenteTerna || session?.nome),
  );
  const [nOperatori, setNOperatori] = useState(existing?.nOperatori ?? 0);
  const [qty, setQty] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    for (const r of existing?.righe ?? []) m[r.prestazioneId] = r.quantita;
    return m;
  });
  const [firmaOperatore, setFirmaOperatore] = useState(existing?.firmaOperatore);
  const [firmaTerna, setFirmaTerna] = useState(existing?.firmaTerna);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);

  useEffect(() => {
    if (existing?.dipendenteTerna) return;
    const matched = matchOperatore(session?.nome);
    if (!matched) return;
    setDipendenteTerna((current) => current || matched);
  }, [existing?.dipendenteTerna, session?.nome]);

  const effectiveLineaId = lineaId;
  const effectiveDitta = ditta || ditte[0]?.ragioneSociale || "";
  const linea = useMemo(
    () => linee.find((l) => l.id === effectiveLineaId),
    [linee, effectiveLineaId],
  );

  async function persist(stato: Rapportino["stato"], extra: Partial<Rapportino> = {}) {
    if (!effectiveLineaId) {
      setError("Seleziona la linea.");
      return null;
    }
    if (!campata.trim()) {
      setError("Indica la campata.");
      return null;
    }
    setSaving(true);
    setError(null);
    const now = new Date().toISOString();
    const id = existing?.id ?? uid("rap");
    const numero = existing?.numero ?? (await nextNumero());
    const righe: RapportinoRiga[] = prestazioni
      .filter((p) => (qty[p.id] ?? 0) > 0)
      .map((p) => ({
        id: uid("riga"),
        prestazioneId: p.id,
        quantita: qty[p.id],
      }));
    const record: Rapportino = {
      id,
      numero,
      lineaId: effectiveLineaId,
      campata: campata.trim(),
      dataLavoro,
      ditta: effectiveDitta.trim(),
      rappresentanteDitta,
      dipendenteTerna: dipendenteTerna.trim(),
      nOperatori,
      stato,
      syncStatus: "pending",
      righe,
      firmaOperatore,
      firmaTerna,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      presoDa: extra.presoDa ?? existing?.presoDa ?? session?.nome,
      presoAt: extra.presoAt ?? existing?.presoAt,
      inviatoAt: extra.inviatoAt ?? existing?.inviatoAt,
      archiviatoAt: extra.archiviatoAt ?? existing?.archiviatoAt,
    };
    await db.rapportini.put(record);
    await enqueueSync(
      id,
      extra.archiviatoAt ? "archive" : extra.inviatoAt ? "submit" : extra.presoAt ? "take" : "upsert",
    );
    setSaving(false);
    return record;
  }

  async function saveDraft() {
    const saved = await persist(existing?.stato === "da_prendere" ? "bozza" : existing?.stato ?? "bozza");
    if (!saved) return;
    if (mode === "assign") {
      router.push("/tecnico/da-prendere");
      return;
    }
    router.push(session?.ruolo === "tecnico" ? `/tecnico/rapportini/${saved.id}` : `/operatore/${saved.id}`);
  }

  async function assign() {
    const saved = await persist("da_prendere");
    if (saved) router.push("/tecnico/linee/" + saved.lineaId);
  }

  async function previewSheet() {
    if (!effectiveLineaId) {
      setError("Seleziona la linea.");
      return;
    }
    if (!campata.trim()) {
      setError("Indica la campata.");
      return;
    }
    setPreviewBusy(true);
    setError(null);
    const now = new Date().toISOString();
    const draft: Rapportino = {
      id: existing?.id ?? "preview",
      numero: existing?.numero ?? "ANTEPRIMA",
      lineaId: effectiveLineaId,
      campata: campata.trim(),
      dataLavoro,
      ditta: effectiveDitta.trim(),
      rappresentanteDitta,
      dipendenteTerna: dipendenteTerna.trim(),
      nOperatori,
      stato: existing?.stato ?? "bozza",
      syncStatus: "local",
      righe: prestazioni
        .filter((p) => (qty[p.id] ?? 0) > 0)
        .map((p) => ({ id: uid("riga"), prestazioneId: p.id, quantita: qty[p.id] })),
      firmaOperatore,
      firmaTerna,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    try {
      const url = await officialSchedaObjectUrl({ item: draft, linea, prestazioni });
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossibile preparare il foglio.");
    } finally {
      setPreviewBusy(false);
    }
  }

  async function submit() {
    if (!dipendenteTerna.trim()) {
      setError("Indica il dipendente TERNA.");
      return;
    }
    if (!effectiveDitta.trim()) {
      setError("Indica la ditta.");
      return;
    }
    const hasQty = prestazioni.some((p) => (qty[p.id] ?? 0) > 0);
    if (!hasQty) {
      setError("Inserisci almeno una quantità nelle prestazioni.");
      return;
    }
    const now = new Date().toISOString();
    if (firmaOperatore) {
      const saved = await persist("archiviato", { inviatoAt: now, archiviatoAt: now });
      if (saved) router.push(session?.ruolo === "tecnico" ? "/tecnico" : "/operatore");
      return;
    }
    const saved = await persist("in_attesa", { inviatoAt: now });
    if (saved) router.push(session?.ruolo === "tecnico" ? "/tecnico/in-attesa" : "/operatore");
  }

  async function removeExisting() {
    if (!existing) return;
    const ok = window.confirm(
      `Cancellare il rapportino ${existing.numero}? L’operazione non si può annullare.`,
    );
    if (!ok) return;
    setSaving(true);
    try {
      await deleteRapportino(existing.id);
      router.push(mode === "assign" ? "/tecnico" : "/operatore");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="form-stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (mode === "assign") void assign();
        else void saveDraft();
      }}
    >
      <section className="panel scheda-panel">
        {existing?.stato === "in_attesa" ? (
          <p className="muted">
            Questo rapportino è in attesa. Completalo e, con la firma della ditta, va in archivio.
          </p>
        ) : null}
        <div className="scheda-head">
          <label>
            Codice linea
            <LineaPicker linee={linee} value={effectiveLineaId} onChange={setLineaId} />
          </label>
          <label>
            Descrizione linea
            <input readOnly value={lineaDescrizione(linea)} />
          </label>
          <label>
            Campata
            <input
              value={campata}
              onChange={(e) => setCampata(e.target.value)}
            />
          </label>
          {mode === "assign" ? (
            <label>
              Data
              <input type="date" value={dataLavoro} onChange={(e) => setDataLavoro(e.target.value)} />
            </label>
          ) : null}
        </div>

        <div className="consegna-kicker">Consegna</div>
        <p className="consegna-flow">
          In data {formatDate(dataLavoro)} il sottoscritto{" "}
          <select
            className="inline-field"
            value={dipendenteTerna}
            onChange={(e) => setDipendenteTerna(e.target.value)}
            aria-label="Dipendente TERNA"
          >
            <option value="">Seleziona…</option>
            {OPERATORI.map((op) => (
              <option key={op} value={op}>
                {op}
              </option>
            ))}
          </select>{" "}
          Dipendente TERNA
          <br />
          Al Sig.{" "}
          <input
            className="inline-field"
            value={rappresentanteDitta}
            onChange={(e) => setRappresentanteDitta(e.target.value)}
            aria-label="Rappresentante della ditta"
          />{" "}
          in qualità di rappresentante della Ditta{" "}
          <select
            className="inline-field"
            value={effectiveDitta}
            onChange={(e) => setDitta(e.target.value)}
            aria-label="Ditta"
          >
            {ditte.map((d) => (
              <option key={d.id} value={d.ragioneSociale}>
                {d.ragioneSociale}
              </option>
            ))}
          </select>
          . La campata in oggetto per effettuare il taglio piante / pulizia base come concordato nel
          sopralluogo congiunto svoltosi in data odierna, in cui è stata stabilita la fattibilità del
          taglio piante.
        </p>
        <p className="muted legal-note">
          Le distanze minime tra conduttori e alberi non devono essere inferiori alle distanze
          riportate nel modello di presa in carico attività di taglio piante — dichiarazione di
          responsabilità.
        </p>
      </section>

      {mode === "compile" ? (
        <>
          <section className="panel">
            <h2>Descrizione prestazioni e quantità</h2>
            <table className="prest-table">
              <thead>
                <tr>
                  <th>Voce</th>
                  <th>Descrizione</th>
                  <th>U.M.</th>
                  <th>Q.tà</th>
                </tr>
              </thead>
              <tbody>
                {prestazioni.map((p) => (
                  <tr key={p.id}>
                    <td className="cod">{p.codice}</td>
                    <td>{p.descrizione}</td>
                    <td className="um">{p.unitaMisura}</td>
                    <td className="qty">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={qty[p.id] ?? ""}
                        onChange={(e) =>
                          setQty((prev) => ({
                            ...prev,
                            [p.id]: e.target.value === "" ? 0 : Number(e.target.value),
                          }))
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="panel">
            <div className="scheda-foot">
              <label>
                Data
                <input type="date" value={dataLavoro} onChange={(e) => setDataLavoro(e.target.value)} />
              </label>
              <label>
                Personale della ditta — N° operatori
                <input
                  type="number"
                  min={0}
                  value={nOperatori}
                  onChange={(e) => setNOperatori(Number(e.target.value))}
                />
              </label>
            </div>
            <div className="sheet-signs">
              <SignaturePad
                label="Il Designato TERNA"
                hint="Usa la S Pen sul tablet. Il salvataggio è locale finché non c’è rete."
                value={firmaTerna}
                onChange={setFirmaTerna}
              />
              <SignaturePad
                label="Il Designato Ditta"
                hint="Firma del rappresentante della ditta."
                value={firmaOperatore}
                onChange={setFirmaOperatore}
              />
            </div>
          </section>
        </>
      ) : null}

      {error ? <p className="form-error">{error}</p> : null}

      <div className="form-actions">
        {mode === "assign" ? (
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Salvataggio…" : "Crea in Da prendere"}
          </button>
        ) : (
          <>
            <button type="submit" className="btn btn-secondary" disabled={saving}>
              {saving ? "Salvataggio…" : "Salva in locale"}
            </button>
            <button type="button" className="btn btn-ghost" disabled={previewBusy} onClick={() => void previewSheet()}>
              {previewBusy ? "Preparazione foglio…" : "Vedi foglio ufficiale"}
            </button>
            <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void submit()}>
              {firmaOperatore ? "Invia in archivio" : "Invia in attesa"}
            </button>
            {existing ? (
              <button
                type="button"
                className="btn btn-danger"
                disabled={saving}
                onClick={() => void removeExisting()}
              >
                Cancella rapportino
              </button>
            ) : null}
          </>
        )}
      </div>
      {previewUrl ? (
        <iframe title="Foglio ufficiale scheda taglio piante" className="scheda-frame" src={previewUrl} />
      ) : null}
    </form>
  );
}
