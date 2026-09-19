import "fake-indexeddb/auto";

class MemoriaLocale implements Storage {
  private dati = new Map<string, string>();
  get length() {
    return this.dati.size;
  }
  clear() {
    this.dati.clear();
  }
  getItem(key: string) {
    return this.dati.get(key) ?? null;
  }
  key(i: number) {
    return [...this.dati.keys()][i] ?? null;
  }
  removeItem(key: string) {
    this.dati.delete(key);
  }
  setItem(key: string, value: string) {
    this.dati.set(key, String(value));
  }
}

Object.defineProperty(globalThis, "localStorage", {
  value: new MemoriaLocale(),
  configurable: true,
  writable: true,
});

Object.defineProperty(globalThis, "navigator", {
  value: { onLine: true },
  configurable: true,
  writable: true,
});

// Il codice dell'app distingue browser e server con `typeof window`: qui serve
// che creda di stare in un browser, con i soli agganci che usa davvero.
const finestra = globalThis as unknown as Record<string, unknown>;
finestra.addEventListener ??= () => {};
finestra.removeEventListener ??= () => {};
finestra.window = globalThis;
