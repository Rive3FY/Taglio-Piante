/**
 * Dimostrazione filmabile del comportamento con rete scadente: pilota una
 * finestra vera annotando a schermo cosa sta succedendo.
 *
 * Servono la app avviata (npm run build && npm run start), il simulatore
 * (node scripts/rete-ballerina.mjs) e un Chrome con la porta di controllo
 * aperta, così la registrazione parte dall'app già pronta:
 *
 *   google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/demo-chrome
 *   SOLO_PREPARAZIONE=1 node scripts/demo-offline.mjs
 *   node scripts/demo-offline.mjs
 */

import puppeteer from "puppeteer-core";

const APP = "http://localhost:3100";

const modo = (m) => fetch(`${APP}/__rete/${m}`).then((r) => r.text());
const attendi = (ms) => new Promise((r) => setTimeout(r, ms));

const PORTA_DEBUG = 9222;
const soloPreparazione = Boolean(process.env.SOLO_PREPARAZIONE);

/**
 * La preparazione (apertura del browser, profilo sul dispositivo) lascia la
 * finestra aperta, così la registrazione può partire dall'app già pronta
 * invece che da mezzo minuto di allestimento.
 */
const browser = await puppeteer.connect({
  browserURL: `http://127.0.0.1:${PORTA_DEBUG}`,
  defaultViewport: null,
});

const [page] = await browser.pages();
await page.setViewport(null);

await page.evaluateOnNewDocument(() => {
  // Ingrandisce tutto: su un video a schermo intero il testo dell'app sarebbe
  // troppo piccolo per leggere lo stato della sincronizzazione.
  const ingrandisci = () => {
    if (document.documentElement) document.documentElement.style.zoom = "1.5";
  };
  ingrandisci();
  document.addEventListener("DOMContentLoaded", ingrandisci);

  const mostra = () => {
    if (!document.body) return;
    const testo = sessionStorage.getItem("__nota");
    if (!testo) return;
    let el = document.getElementById("__nota");
    if (!el) {
      el = document.createElement("div");
      el.id = "__nota";
      Object.assign(el.style, {
        position: "fixed",
        left: "0",
        right: "0",
        bottom: "0",
        zIndex: "2147483647",
        padding: "16px 22px",
        background: "rgba(10, 26, 20, 0.94)",
        color: "#eaf5ee",
        font: "600 20px/1.35 system-ui, sans-serif",
        letterSpacing: "0.2px",
        pointerEvents: "none",
        borderTop: "3px solid #4ea87a",
      });
      document.body.appendChild(el);
    }
    el.textContent = testo;
  };
  window.__annota = (t) => {
    sessionStorage.setItem("__nota", t);
    mostra();
  };
  document.addEventListener("DOMContentLoaded", mostra);
  window.addEventListener("load", mostra);
  setInterval(mostra, 400);
});

const nota = async (testo, pausa = 2600) => {
  await page.evaluate((t) => window.__annota?.(t), testo).catch(() => {});
  await attendi(pausa);
};

async function pillola() {
  return page
    .evaluate(() => document.querySelector(".sync-pill")?.textContent?.trim() ?? "?")
    .catch(() => "?");
}

/** Clicca un link dell'app e cronometra quanto ci mette la pagina a comparire. */
async function vaiA(percorso, etichetta) {
  const t0 = Date.now();
  await page
    .evaluate((p) => {
      const a = [...document.querySelectorAll("a")].find((x) => x.getAttribute("href") === p);
      if (a) a.click();
      else location.assign(p);
    }, percorso)
    .catch(() => {});

  for (let i = 0; i < 300; i += 1) {
    const pronto = await page
      .evaluate((p) => {
        const testo = (document.body?.innerText ?? "").replace(/\s+/g, " ").trim();
        return location.pathname === p && testo.length > 40 && !/^Apertura|^Caricamento/.test(testo);
      }, percorso)
      .catch(() => false);
    if (pronto) break;
    await attendi(100);
  }
  const secondi = ((Date.now() - t0) / 1000).toFixed(1);
  await nota(`${etichetta} — comparsa in ${secondi} secondi`, 2800);
  return secondi;
}

async function ricarica(etichetta) {
  const t0 = Date.now();
  await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
  for (let i = 0; i < 300; i += 1) {
    const pronto = await page
      .evaluate(() => (document.body?.innerText ?? "").replace(/\s+/g, " ").trim().length > 40)
      .catch(() => false);
    if (pronto) break;
    await attendi(100);
  }
  const secondi = ((Date.now() - t0) / 1000).toFixed(1);
  await nota(`${etichetta} — l'app è tornata in ${secondi} secondi`, 3200);
}

// --- preparazione, prima della registrazione -------------------------------

if (soloPreparazione) {
  await modo("ok");
  await page.goto(`${APP}/`, { waitUntil: "networkidle2" });
  await attendi(1500);

  // Dispositivo su cui l'operatore ha già fatto l'accesso: è così che l'app
  // riapre senza rete, ed è lo stato da cui parte la prova.
  await page.evaluate(() => {
    localStorage.setItem(
      "rt.profilo",
      JSON.stringify({ userId: "u1", nome: "Marco Rossi", email: "m@e.it", ruolo: "operatore" }),
    );
    localStorage.setItem(
      "rt.squadra.u1",
      JSON.stringify({ rappresentanteDitta: "Marco Rossi", nOperatori: 3 }),
    );
  });

  await page.goto(`${APP}/operatore`, { waitUntil: "networkidle2" });
  await attendi(2500);
  await page.evaluate(() => {
    sessionStorage.removeItem("__nota");
    document.getElementById("__nota")?.remove();
  });
  browser.disconnect();
  console.log("pronto per la registrazione");
  process.exit(0);
}

// --- dimostrazione ----------------------------------------------------------

await nota("Linea normale. Pillola in alto a destra: " + (await pillola()), 3000);
await vaiA("/operatore/campate", "Linea normale: apro Campate");
await vaiA("/operatore", "Linea normale: torno indietro");

await modo("muta");
await nota(
  "Ora la rete è quella del cantiere: la connessione viene accettata, ma il server non risponde mai.",
  4200,
);
await vaiA("/operatore/campate", "Poca linea: apro Campate");
await ricarica("Poca linea: ricarico tutta la pagina");

await nota("Adesso tolgo del tutto il segnale.", 2600);
await page.setOfflineMode(true);
await attendi(1200);
await nota("Senza segnale la pillola lo dice: " + (await pillola()), 3400);
await vaiA("/operatore", "Senza segnale: torno alla schermata iniziale");
await ricarica("Senza segnale: ricarico tutta la pagina");

await page.setOfflineMode(false);
await modo("ok");
await attendi(2000);
await nota("Torna il segnale. Pillola: " + (await pillola()), 4000);

await nota("Nessuna attesa infinita: l'app risponde sempre.", 3500);
browser.disconnect();
