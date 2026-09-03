"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { db, enqueueSync, nextNumero } from "@/lib/db";
import { formatDate, todayIso, uid } from "@/lib/format";
import { officialSchedaObjectUrl } from "@/lib/fillScheda";
import { matchOperatore } from "@/lib/operatori";
import { useSession } from "@/lib/SessionContext";
import { useSync } from "@/lib/SyncContext";
import type { CampataLavoro, Ditta, Linea, Operatore, Prestazione, Rapportino, RapportinoCampata, RapportinoRiga } from "@/lib/types";
import { rapportinoEChiuso } from "@/lib/types";
import { LineaPicker } from "./LineaPicker";
import { SignaturePad } from "./SignaturePad";
import { CampateEsitiEditor, testoCampateDaEsiti } from "./CampateEsitiEditor";
import { DeleteRapportinoButton } from "./DeleteRapportinoButton";
import { applicaEsitiDaRapportino } from "@/lib/campate/apply";
import { eLavoroBasi, esitiClassificati } from "@/lib/campate/basi";
import {
  campateGiaTagliateDaFoglio,
  esitiCheToccanoDaNonTagliare,
  messaggioCampateDaNonTagliare,
  messaggioCampateGiaTagliate,
} from "@/lib/campate/guard";
import { annoDaDataLavoro, annoDi } from "@/lib/campate/anno";
import { readSquadra, type PrefsSquadra } from "@/lib/squadra";

const EMPTY_LINEE: Linea[] = [];
const EMPTY_DITTE: Ditta[] = [];
const EMPTY_PREST: Prestazione[] = [];
const EMPTY_OPERATORI: Operatore[] = [];

type Props = {
  existing?: Rapportino;
  /** Se valorizzato, il rapportino parte dalle campate pianificate di quella linea. */
  precompilatoLineaId?: string;
  /** Una sola campata dall’elenco: apre il foglio già impostato su quella. */
  precompilatoCampataId?: string;
};

export function RapportinoForm({ existing, precompilatoLineaId, precompilatoCampataId }: Props) {
  const router = useRouter();
  const { session } = useSession();
  const { syncNow } = useSync();
  const [squadraTick, setSquadraTick] = useState(0);
  const [squadra, setSquadra] = useState<PrefsSquadra | null>(null);
  useEffect(() => {
    const on = () => setSquadraTick((n) => n + 1);
    window.addEventListener("squadra-aggiornata", on);
    return () => window.removeEventListener("squadra-aggiornata", on);
  }, []);
  useEffect(() => {
    setSquadra(session ? readSquadra(session.userId) : null);
  }, [session, squadraTick]);
  const linee = useLiveQuery(() => db.linee.toArray(), []) ?? EMPTY_LINEE;
  const ditte = useLiveQuery(() => db.ditte.toArray(), []) ?? EMPTY_DITTE;
  const prestazioniRaw = useLiveQuery(() => db.prestazioni.toArray(), []) ?? EMPTY_PREST;
  const prestazioni = useMemo(
    () => [...prestazioniRaw].sort((a, b) => a.codice.localeCompare(b.codice, "it", { numeric: true })),
    [prestazioniRaw],
  );
  const operatoriRecord = useLiveQuery(() => db.operatori.orderBy("nome").toArray(), []) ?? EMPTY_OPERATORI;
  const operatori = useMemo(() => operatoriRecord.map((o) => o.nome), [operatoriRecord]);

  const [lineaId, setLineaId] = useState(existing?.lineaId ?? precompilatoLineaId ?? "");
  const campateLineaRaw =
    useLiveQuery(
      () => (lineaId ? db.campateLavoro.where("lineaId").equals(lineaId).toArray() : Promise.resolve([] as CampataLavoro[])),
      [lineaId],
    ) ?? [];
  const campataScelta = useLiveQuery(
    () => (precompilatoCampataId ? db.campateLavoro.get(precompilatoCampataId) : undefined),
    [precompilatoCampataId],
  );
  const [campata, setCampata] = useState(existing?.campata ?? "");
  const [esiti, setEsiti] = useState<RapportinoCampata[]>(existing?.esitiCampate ?? []);
  const [dataLavoro, setDataLavoro] = useState(existing?.dataLavoro ?? todayIso());
  const campateLinea = useMemo(
    () => campateLineaRaw.filter((c) => annoDi(c) === annoDaDataLavoro(existing?.dataLavoro ?? dataLavoro)),
    [campateLineaRaw, existing?.dataLavoro, dataLavoro],
  );
  const [ditta, setDitta] = useState(existing?.ditta ?? "");
  const [rappresentanteDitta, setRappresentanteDitta] = useState(
    existing?.rappresentanteDitta || squadra?.rappresentanteDitta || "",
  );
  const [dipendenteTerna, setDipendenteTerna] = useState(existing?.dipendenteTerna ?? "");
  const [nOperatoriText, setNOperatoriText] = useState(
    existing?.nOperatori && existing.nOperatori > 0
      ? String(existing.nOperatori)
      : squadra?.nOperatori
        ? String(squadra.nOperatori)
        : "",
  );
  const nOperatori = nOperatoriText === "" ? 0 : Number(nOperatoriText) || 0;
  const [qty, setQty] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    for (const r of existing?.righe ?? []) m[r.prestazioneId] = r.quantita;
    return m;
  });
  const [firmaOperatore, setFirmaOperatore] = useState(existing?.firmaOperatore);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [dockReady, setDockReady] = useState(false);
  const previewBlobRef = useRef<string | null>(null);

  useEffect(() => {
    if (operatori.length === 0) return;
    const matched = matchOperatore(existing?.dipendenteTerna || session?.nome, operatori);
    if (!matched) return;
    setDipendenteTerna((current) => current || matched);
  }, [existing?.dipendenteTerna, operatori, session?.nome]);

  useEffect(() => {
    setDockReady(true);
    return () => {
      if (previewBlobRef.current) URL.revokeObjectURL(previewBlobRef.current);
    };
  }, []);

  useEffect(() => {
    if (!previewUrl) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewUrl(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewUrl]);

  // La firma TERNA arriva dal profilo di chi è indicato come dipendente.
  const firmaProfilo = useMemo(
    () => operatoriRecord.find((o) => o.nome === dipendenteTerna)?.firma,
    [operatoriRecord, dipendenteTerna],
  );
  const firmaTerna = firmaProfilo;

  const effectiveLineaId = lineaId;
  const effectiveDitta = ditta || ditte[0]?.ragioneSociale || "";
  const linea = useMemo(
    () => linee.find((l) => l.id === effectiveLineaId),
    [linee, effectiveLineaId],
  );

  const pianificate = useMemo(
    () =>
      campateLinea
        .filter((c) => c.tipo !== "base" && c.origine === "prevista" && c.stato === "da_tagliare")
        .sort(
          (a, b) =>
            a.normalizzata.localeCompare(b.normalizzata, "it", { numeric: true }) ||
            (a.priorita ?? "").localeCompare(b.priorita ?? ""),
        ),
    [campateLinea],
  );

  useEffect(() => {
    if (campataScelta?.lineaId) setLineaId((cur) => cur || campataScelta.lineaId);
  }, [campataScelta]);

  useEffect(() => {
    if (existing) return;
    const s = session ? readSquadra(session.userId) : null;
    if (!s) return;
    setRappresentanteDitta(s.rappresentanteDitta);
    setNOperatoriText(String(s.nOperatori));
  }, [session, existing, squadraTick]);

  useEffect(() => {
    if (!existing) return;
    if (existing.rappresentanteDitta) setRappresentanteDitta(existing.rappresentanteDitta);
    if (existing.nOperatori > 0) setNOperatoriText(String(existing.nOperatori));
  }, [existing?.id, existing?.rappresentanteDitta, existing?.nOperatori, existing?.updatedAt]);

  const testoBox = esiti.length > 0 ? testoCampateDaEsiti(esiti) : campata;
  const qtyHaBase = useMemo(
    () =>
      eLavoroBasi(
        testoBox,
        {
          righe: prestazioni
            .filter((p) => (qty[p.id] ?? 0) > 0)
            .map((p) => ({ id: p.id, prestazioneId: p.id, quantita: qty[p.id] })),
        },
        prestazioni,
      ),
    [prestazioni, qty, testoBox],
  );

  const campateBloccate = useMemo(() => {
    if (qtyHaBase) return [];
    const righe = prestazioni
      .filter((p) => (qty[p.id] ?? 0) > 0)
      .map((p) => ({ id: p.id, prestazioneId: p.id, quantita: qty[p.id] }));
    return esitiCheToccanoDaNonTagliare(
      campateLinea,
      testoBox,
      { righe },
      prestazioni,
      esiti.length > 0 ? esiti : undefined,
    );
  }, [campateLinea, testoBox, prestazioni, qty, esiti, qtyHaBase]);
  const erroreDaNonTagliare = messaggioCampateDaNonTagliare(campateBloccate);
  const campateGiaTagliate = useMemo(() => {
    if (qtyHaBase) return [];
    const righe = prestazioni
      .filter((p) => (qty[p.id] ?? 0) > 0)
      .map((p) => ({ id: p.id, prestazioneId: p.id, quantita: qty[p.id] }));
    const classificati = esitiClassificati(
      testoBox,
      { righe },
      prestazioni,
      esiti.length > 0 ? esiti : undefined,
    );
    return campateGiaTagliateDaFoglio(campateLinea, classificati, existing?.id);
  }, [campateLinea, testoBox, prestazioni, qty, esiti, qtyHaBase, existing?.id]);
  const avvisoGiaTagliata = messaggioCampateGiaTagliate(campateGiaTagliate);

  const modoPrecompilato = Boolean(
    precompilatoLineaId ||
      precompilatoCampataId ||
      (existing?.esitiCampate?.some((e) => e.tipo !== "base") ?? false),
  );

  useEffect(() => {
    if (existing?.esitiCampate?.length) return;
    if (esiti.length > 0) return;

    if (precompilatoCampataId) {
      const scelta = campataScelta ?? campateLinea.find((c) => c.id === precompilatoCampataId);
      if (!scelta) return;
      setLineaId(scelta.lineaId);
      setEsiti([
        {
          id: uid("es"),
          campataId: scelta.id,
          originale: scelta.originale,
          normalizzata: scelta.normalizzata,
          priorita: scelta.priorita,
          esito: "tagliata",
        },
      ]);
      return;
    }

    if (!modoPrecompilato) return;
    if (pianificate.length === 0) return;
    setEsiti(
      pianificate.map((c) => ({
        id: uid("es"),
        campataId: c.id,
        originale: c.originale,
        normalizzata: c.normalizzata,
        priorita: c.priorita,
        esito: "tagliata" as const,
      })),
    );
  }, [
    modoPrecompilato,
    existing?.esitiCampate,
    pianificate,
    esiti.length,
    precompilatoCampataId,
    campateLinea,
    campataScelta,
  ]);

  async function persist(stato: Rapportino["stato"], extra: Partial<Rapportino> = {}) {
    if (!effectiveLineaId) {
      setError("Seleziona la linea.");
      return null;
    }
    if (!campata.trim() && esiti.length === 0) {
      setError("Indica la campata.");
      return null;
    }
    setSaving(true);
    setError(null);
    try {
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
      const testoSorgente = esiti.length > 0 ? testoCampateDaEsiti(esiti) : campata.trim();
      const esitiSalvati = esitiClassificati(testoSorgente, { righe }, prestazioni, esiti);
      const campateSulDb = (await db.campateLavoro.where("lineaId").equals(effectiveLineaId).toArray()).filter(
        (c) => annoDi(c) === annoDaDataLavoro(dataLavoro),
      );
      const bloccate = qtyHaBase
        ? []
        : esitiCheToccanoDaNonTagliare(
            campateSulDb,
            testoSorgente,
            { righe },
            prestazioni,
            esitiSalvati,
          );
      if (bloccate.length > 0) {
        setError(messaggioCampateDaNonTagliare(bloccate));
        return null;
      }
      const campataTesto = testoSorgente;
      const sigDitta = (rappresentanteDitta || squadra?.rappresentanteDitta || "").trim();
      const nSquadra = nOperatori || squadra?.nOperatori || 0;
      const record: Rapportino = {
        id,
        numero,
        lineaId: effectiveLineaId,
        campata: campataTesto,
        dataLavoro,
        ditta: effectiveDitta.trim(),
        rappresentanteDitta: sigDitta,
        dipendenteTerna: dipendenteTerna.trim(),
        nOperatori: nSquadra,
        stato,
        syncStatus: "pending",
        righe,
        esitiCampate: esitiSalvati.length > 0 ? esitiSalvati : undefined,
        firmaOperatore,
        firmaTerna,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        ownerId: existing?.ownerId ?? session?.userId,
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
      if (session && rapportinoEChiuso(stato)) {
        await applicaEsitiDaRapportino(record, session);
      }
      void syncNow();
      return record;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Salvataggio non riuscito.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  function homeDopoInvio() {
    if (session?.ruolo === "tecnico") return "/tecnico";
    return "/operatore";
  }

  async function salva() {
    setOkMsg(null);
    if (!effectiveLineaId) {
      setError("Seleziona la linea.");
      return;
    }
    if (!campata.trim() && esiti.length === 0) {
      setError("Indica la campata.");
      return;
    }

    const completo =
      Boolean(dipendenteTerna.trim()) &&
      Boolean(effectiveDitta.trim()) &&
      prestazioni.some((p) => (qty[p.id] ?? 0) > 0);

    if (!completo) {
      const stato = rapportinoEChiuso(existing?.stato) ? "archiviato" : "bozza";
      const saved = await persist(stato);
      if (!saved) return;
      if (!existing) {
        router.replace(
          session?.ruolo === "tecnico" ? `/tecnico/rapportini/${saved.id}` : `/operatore/${saved.id}`,
        );
      }
      setOkMsg("Salvato in locale. Completa ditta, dipendente TERNA e almeno una quantità per inviarlo.");
      return;
    }

    const now = new Date().toISOString();
    const saved = await persist("archiviato", {
      inviatoAt: existing?.inviatoAt ?? now,
      archiviatoAt: now,
    });
    if (saved) router.push(homeDopoInvio());
  }

  async function previewSheet() {
    if (!effectiveLineaId) {
      setError("Seleziona la linea.");
      return;
    }
    if (!campata.trim() && esiti.length === 0) {
      setError("Indica la campata.");
      return;
    }
    setPreviewBusy(true);
    setError(null);
    const now = new Date().toISOString();
    const righePreview = prestazioni
      .filter((p) => (qty[p.id] ?? 0) > 0)
      .map((p) => ({ id: uid("riga"), prestazioneId: p.id, quantita: qty[p.id] }));
    const testoSorgente = esiti.length > 0 ? testoCampateDaEsiti(esiti) : campata.trim();
    const esitiSalvati = esitiClassificati(testoSorgente, { righe: righePreview }, prestazioni, esiti);
    const draft: Rapportino = {
      id: existing?.id ?? "preview",
      numero: existing?.numero ?? "ANTEPRIMA",
      lineaId: effectiveLineaId,
      campata: testoSorgente,
      dataLavoro,
      ditta: effectiveDitta.trim(),
      rappresentanteDitta: (rappresentanteDitta || squadra?.rappresentanteDitta || "").trim(),
      dipendenteTerna: dipendenteTerna.trim(),
      nOperatori: nOperatori || squadra?.nOperatori || 0,
      stato: existing?.stato ?? "bozza",
      syncStatus: "local",
      righe: righePreview,
      firmaOperatore,
      firmaTerna,
      esitiCampate: esitiSalvati.length > 0 ? esitiSalvati : undefined,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    try {
      const url = await officialSchedaObjectUrl({ item: draft, linea, prestazioni });
      if (previewBlobRef.current) URL.revokeObjectURL(previewBlobRef.current);
      previewBlobRef.current = url;
      const opened = window.open(url, "_blank");
      if (opened) {
        setPreviewUrl(null);
        opened.focus();
      } else {
        setPreviewUrl(url);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Impossibile preparare il foglio.");
    } finally {
      setPreviewBusy(false);
    }
  }

  return (
    <form
      id="rapportino-form"
      className="form-stack"
      onSubmit={(e) => {
        e.preventDefault();
        void salva();
      }}
    >
      <section className="panel scheda-panel">
        <div className="scheda-head">
          <label>
            Codice linea
            <LineaPicker linee={linee} value={effectiveLineaId} onChange={setLineaId} campo="codice" />
          </label>
          <label>
            Descrizione linea
            <LineaPicker linee={linee} value={effectiveLineaId} onChange={setLineaId} campo="nome" />
          </label>
          <label>
            {qtyHaBase ? "Basi" : "Campata"}
            {modoPrecompilato ? (
              <input readOnly value={esiti.length > 0 ? testoCampateDaEsiti(esiti) : campata} />
            ) : (
              <input
                value={campata}
                onChange={(e) => setCampata(e.target.value)}
                placeholder="Es. 22-23 oppure 22"
              />
            )}
            {qtyHaBase ? (
              <span className="muted">
                I numeri coincidono con 5.1–5.4: sono basi, la tabella campate non si tocca.
              </span>
            ) : erroreDaNonTagliare ? (
              <span className="form-error">{erroreDaNonTagliare}</span>
            ) : avvisoGiaTagliata ? (
              <span className="muted">{avvisoGiaTagliata}</span>
            ) : null}
          </label>
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
            {dipendenteTerna && !operatori.includes(dipendenteTerna) ? (
              <option value={dipendenteTerna}>{dipendenteTerna}</option>
            ) : null}
            {operatori.map((op) => (
              <option key={op} value={op}>
                {op}
              </option>
            ))}
          </select>{" "}
          Dipendente TERNA
          <br />
          Al Sig.{" "}
          {squadra ? (
            <strong>{rappresentanteDitta || squadra.rappresentanteDitta}</strong>
          ) : (
            <input
              className="inline-field"
              value={rappresentanteDitta}
              onChange={(e) => setRappresentanteDitta(e.target.value)}
              aria-label="Rappresentante della ditta"
            />
          )}{" "}
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

      {modoPrecompilato ? (
        <CampateEsitiEditor
          pianificate={pianificate}
          esiti={esiti}
          campateLinea={campateLinea}
        />
      ) : null}

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
              {squadra ? (
                <p className="muted" style={{ margin: 0 }}>
                  Personale della ditta — N° operatori:{" "}
                  <strong>{nOperatori || squadra.nOperatori}</strong>
                </p>
              ) : (
                <label>
                  Personale della ditta — N° operatori
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="0"
                    value={nOperatoriText}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "" || /^\d+$/.test(v)) setNOperatoriText(v);
                    }}
                  />
                </label>
              )}
            </div>
            {dipendenteTerna && !firmaProfilo ? (
              <p className="muted">
                Manca la firma nel profilo di {dipendenteTerna}: sul foglio ufficiale non comparirà.
                Chiedi al tecnico di caricarla.
              </p>
            ) : (
              <p className="muted">
                La firma TERNA si mette da sola dal profilo dell’operatore. Qui serve solo quella della
                ditta.
              </p>
            )}
            <SignaturePad
              label="Il Designato Ditta"
              hint="Compare sul foglio ufficiale."
              value={firmaOperatore}
              onChange={setFirmaOperatore}
            />
            <button
              type="button"
              className="btn btn-ghost"
              disabled={previewBusy}
              onClick={() => void previewSheet()}
            >
              {previewBusy ? "Preparazione foglio…" : "Vedi foglio ufficiale"}
            </button>
          </section>

      {existing ? (
        <div className="danger-actions">
          <DeleteRapportinoButton
            id={existing.id}
            numero={existing.numero}
            href={session?.ruolo === "tecnico" ? "/tecnico/archiviati" : "/operatore"}
          />
        </div>
      ) : null}

      {error ? <p className="form-error">{error}</p> : null}
      {okMsg ? <p className="muted">{okMsg}</p> : null}

      {dockReady
        ? createPortal(
            <div className="form-actions-dock">
              <button type="submit" form="rapportino-form" className="btn btn-primary" disabled={saving || Boolean(erroreDaNonTagliare)}>
                {saving ? "Salvataggio…" : "Salva"}
              </button>
            </div>,
            document.body,
          )
        : null}

      {dockReady && previewUrl
        ? createPortal(
            <div
              className="scheda-overlay"
              role="dialog"
              aria-modal="true"
              aria-label="Foglio ufficiale"
            >
              <div className="scheda-overlay-bar">
                <button type="button" className="btn btn-secondary" onClick={() => setPreviewUrl(null)}>
                  Chiudi
                </button>
              </div>
              <iframe title="Foglio ufficiale scheda taglio piante" src={previewUrl} />
            </div>,
            document.body,
          )
        : null}
    </form>
  );
}
