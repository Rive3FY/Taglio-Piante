export function scaricaBlob(data: Blob | Uint8Array, filename: string, type = "application/octet-stream") {
  const blob =
    data instanceof Blob ? data : new Blob([new Uint8Array(data)], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
