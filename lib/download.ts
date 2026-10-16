export function scaricaBlob(data: Blob | Uint8Array, filename: string, type = "application/octet-stream") {
  const blob =
    data instanceof Blob ? data : new Blob([new Uint8Array(data)], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Safari e Android leggono il blob dopo il click: revocarlo subito annulla il download.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
