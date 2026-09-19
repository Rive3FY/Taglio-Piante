/**
 * Prova automatica del comportamento con rete scadente. Misura quanto ci mette
 * una pagina a comparire davvero, che è la cosa che l'operatore sente.
 *
 * Serve la app costruita e avviata, più il simulatore di rete:
 *   npm run build && npm run start          # terminale 1
 *   node scripts/rete-ballerina.mjs         # terminale 2
 *   node scripts/prova-offline.mjs          # terminale 3
 *
 * Attese ragionevoli: con linea normale e senza segnale la navigazione è
 * immediata (la copia locale c'è già); con la linea muta il primo caricamento
 * completo paga una sola scadenza, circa due secondi e mezzo, mai di più.
 */

import puppeteer from "puppeteer-core";

const APP = "http://localhost:3100";
const CHROME = process.env.CHROME ?? "/opt/google/chrome/chrome";
const modo = async (m) => (await (await fetch(`${APP}/__rete/${m}`)).text()).trim();
const attendi = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const page = await browser.newPage();
const log = [];
page.on("console", (m) => m.type() === "error" && log.push(`[console] ${m.text().slice(0, 130)}`));
page.on("requestfailed", (r) => log.push(`[fallita] ${r.url().replace(APP, "").slice(0, 70)}`));

async function stato() {
  try {
    return await page.evaluate(() => ({
      url: location.pathname,
      testo: (document.body.innerText || "").replace(/\s+/g, " ").trim(),
    }));
  } catch {
    return { url: "(in navigazione)", testo: "" };
  }
}

/** Quanto ci mette la pagina di destinazione a comparire davvero. */
async function cronometra(etichetta, azione, atteso) {
  const t0 = Date.now();
  await azione();
  for (let i = 0; i < 300; i += 1) {
    const s = await stato();
    if (s.url === atteso && s.testo.length > 40 && !/^Apertura|^Caricamento/.test(s.testo)) {
      console.log(`  ${etichetta}: ${((Date.now() - t0) / 1000).toFixed(1)}s -> ${s.url}`);
      return true;
    }
    await attendi(100);
  }
  const s = await stato();
  console.log(`  ${etichetta}: NON ARRIVATA in 30s (url=${s.url} testo="${s.testo.slice(0, 80)}")`);
  return false;
}

const vaiA = (p) => () =>
  page.evaluate((path) => {
    const link = [...document.querySelectorAll("a")].find((a) => a.getAttribute("href") === path);
    if (link) link.click();
    else history.pushState(null, "", path);
  }, p);

console.log("== preparazione (rete ok) ==", await modo("ok"));
await page.goto(`${APP}/`, { waitUntil: "networkidle2" });
await attendi(1500);
await page.evaluate(() =>
  localStorage.setItem(
    "rt.profilo",
    JSON.stringify({ userId: "u1", nome: "Marco Rossi", email: "m@e.it", ruolo: "operatore" }),
  ),
);
await page.goto(`${APP}/operatore`, { waitUntil: "networkidle2" });
await attendi(2000);
console.log("   service worker:", await page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration())?.active)));

console.log("\n== linea normale ==");
await cronometra("vai a Campate ", vaiA("/operatore/campate"), "/operatore/campate");
await cronometra("torna indietro", vaiA("/operatore"), "/operatore");

console.log("\n== linea muta (agganciata ma non risponde) ==", await modo("muta"));
log.length = 0;
await cronometra("vai a Campate ", vaiA("/operatore/campate"), "/operatore/campate");
await cronometra("torna indietro", vaiA("/operatore"), "/operatore");
await cronometra("ricarica tutto", () => page.reload({ waitUntil: "domcontentloaded" }).catch(() => {}), "/operatore");

console.log("\n== senza segnale del tutto ==");
await page.setOfflineMode(true);
await cronometra("vai a Campate ", vaiA("/operatore/campate"), "/operatore/campate");
await cronometra("ricarica tutto", () => page.reload({ waitUntil: "domcontentloaded" }).catch(() => {}), "/operatore/campate");
await page.setOfflineMode(false);

console.log("\n== ritorno della linea ==", await modo("ok"));
await cronometra("vai a Campate ", vaiA("/operatore/campate"), "/operatore/campate");

const pillola = () =>
  page.evaluate(() => document.querySelector(".sync-pill")?.textContent?.trim() ?? "(assente)");
const classePillola = () =>
  page.evaluate(() => document.querySelector(".sync-pill")?.className ?? "(assente)");

console.log("\n== pillola di stato ==");
console.log("  con linea       :", await pillola(), "|", await classePillola());
await page.setOfflineMode(true);
await attendi(600);
console.log("  senza segnale   :", await pillola(), "|", await classePillola());
await page.setOfflineMode(false);
await attendi(1200);
console.log("  segnale tornato :", await pillola(), "|", await classePillola());

const sporcizia = await page.evaluate(async () => {
  const c = await caches.open((await caches.keys())[0]);
  return (await c.keys()).filter((r) => r.url.includes("_rsc")).length;
});
console.log("\n== payload RSC finiti in cache (devono essere 0):", sporcizia);

console.log("\n== errori osservati durante le prove ==");
console.log(log.length ? [...new Set(log)].map((r) => "  " + r).join("\n") : "  nessuno");

await browser.close();
