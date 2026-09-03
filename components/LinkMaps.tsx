import { urlGoogleMaps, wgs84DaEstNord } from "@/lib/campate/geo";

export function LinkMaps({
  estInt,
  nordInt,
  nomeLinea,
}: {
  estInt?: number;
  nordInt?: number;
  nomeLinea?: string;
}) {
  const p = wgs84DaEstNord(estInt, nordInt, nomeLinea);
  if (!p) return <span className="muted">—</span>;
  return (
    <a
      href={urlGoogleMaps(p.lat, p.lng)}
      target="_blank"
      rel="noopener noreferrer"
      className={`maps-link${p.incerto ? " incerto" : ""}`}
      title={`${p.etichetta} · ${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`}
      onClick={(e) => e.stopPropagation()}
      aria-label="Apri in Google Maps"
    >
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path fill="#34a853" d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7z" />
        <circle cx="12" cy="9" r="3.1" fill="#fbbc04" />
        <circle cx="12" cy="9" r="1.4" fill="#ea4335" />
      </svg>
    </a>
  );
}
