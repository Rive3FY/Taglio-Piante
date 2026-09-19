/**
 * Simulatore di rete da cantiere, per provare l'app come si comporta davvero
 * sul campo invece che con la fibra dell'ufficio.
 *
 * Il caso interessante non è «rete staccata»: quello lo sanno simulare tutti.
 * È la rete che resta agganciata e non risponde, perché è lì che l'app sembrava
 * bloccata. Il browser continua a dire che è online, la richiesta parte, e non
 * torna più niente.
 *
 *   node scripts/rete-ballerina.mjs            # ascolta su 3100, inoltra a 3000
 *
 * Da un altro terminale, o dalla barra indirizzi:
 *   curl localhost:3100/__rete/ok       rete normale
 *   curl localhost:3100/__rete/lenta    tre secondi di ritardo su tutto
 *   curl localhost:3100/__rete/muta     accetta e non risponde mai
 *   curl localhost:3100/__rete/giu      rifiuta subito
 *   curl localhost:3100/__rete          stato attuale
 */

import http from "node:http";

const PORTA = Number(process.env.PORTA ?? 3100);
const VERSO = Number(process.env.VERSO ?? 3000);
const RITARDO_LENTA_MS = 3000;

const MODI = new Set(["ok", "lenta", "muta", "giu"]);
let modo = "ok";

const attesa = (ms) => new Promise((r) => setTimeout(r, ms));

function inoltra(req, res) {
  const proxy = http.request(
    { host: "127.0.0.1", port: VERSO, path: req.url, method: req.method, headers: req.headers },
    (risposta) => {
      res.writeHead(risposta.statusCode ?? 502, risposta.headers);
      risposta.pipe(res);
    },
  );
  proxy.on("error", () => {
    if (!res.headersSent) res.writeHead(502);
    res.end("app non raggiungibile");
  });
  req.pipe(proxy);
}

const server = http.createServer(async (req, res) => {
  if (req.url?.startsWith("/__rete")) {
    const richiesto = req.url.split("/")[2];
    if (richiesto && MODI.has(richiesto)) modo = richiesto;
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    res.end(`rete: ${modo}\n`);
    return;
  }

  if (modo === "giu") {
    req.socket.destroy();
    return;
  }

  if (modo === "muta") {
    // Il cuore della simulazione: la connessione resta aperta e muta.
    // Senza scadenze lato client, qui l'app si ferma per sempre.
    return;
  }

  if (modo === "lenta") await attesa(RITARDO_LENTA_MS);

  inoltra(req, res);
});

server.listen(PORTA, () => {
  console.log(`rete-ballerina: http://localhost:${PORTA} -> http://localhost:${VERSO} (modo: ${modo})`);
});
