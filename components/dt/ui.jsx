"use client";
// Piezas compartidas del rediseño Don Telmo: iconos de línea y colores de categoría.

const s = (d, w = 1.8) => ({ width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: w, strokeLinecap: "round", strokeLinejoin: "round" });

export const Icon = {
  menu: (p = {}) => <svg {...s()} {...p}><path d="M3 6h18M3 12h18M3 18h18" /></svg>,
  search: (p = {}) => <svg {...s()} {...p}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>,
  plus: (p = {}) => <svg {...s(0, 2.2)} {...p}><path d="M12 5v14M5 12h14" /></svg>,
  gear: (p = {}) => <svg {...s()} {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>,
  logout: (p = {}) => <svg {...s()} {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>,
  book: (p = {}) => <svg {...s()} {...p}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z" /><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" /></svg>,
  printer3d: (p = {}) => <svg {...s()} {...p}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M7 7h10M9 7v4l3 3 3-3V7M7 17h10" /></svg>,
  calc: (p = {}) => <svg {...s()} {...p}><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M8 6h8M8 12h.01M12 12h.01M16 12h.01M8 17h.01M12 17h.01M16 17h.01" /></svg>,
  box: (p = {}) => <svg {...s()} {...p}><path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8" /></svg>,
  pencil: (p = {}) => <svg {...s()} {...p}><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>,
  trash: (p = {}) => <svg {...s()} {...p}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>,
  grid: (p = {}) => <svg {...s()} {...p}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>,
  list: (p = {}) => <svg {...s()} {...p}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>,
  chevron: (p = {}) => <svg {...s()} {...p}><path d="M9 6l6 6-6 6" /></svg>,
  close: (p = {}) => <svg {...s(0, 2.2)} {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>,
  user: (p = {}) => <svg {...s()} {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
  users: (p = {}) => <svg {...s()} {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></svg>,
  globe: (p = {}) => <svg {...s()} {...p}><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" /></svg>,
  download: (p = {}) => <svg {...s()} {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>,
  upload: (p = {}) => <svg {...s()} {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>,
  sheet: (p = {}) => <svg {...s()} {...p}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18" /></svg>,
  chart: (p = {}) => <svg {...s()} {...p}><path d="M18 20V10M12 20V4M6 20v-6" /></svg>,
  activity: (p = {}) => <svg {...s()} {...p}><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>,
  drop: (p = {}) => <svg {...s()} {...p}><path d="M12 2.7l5.7 5.7a8 8 0 1 1-11.3 0z" /></svg>,
  tag: (p = {}) => <svg {...s()} {...p}><path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8zM7 7h.01" /></svg>,
  megaphone: (p = {}) => <svg {...s()} {...p}><path d="M3 11l18-5v12L3 14v-3zM11.6 16.8a3 3 0 1 1-5.8-1.6" /></svg>,
  pizza: (p = {}) => <svg {...s()} {...p}><path d="M12 2 2 20h20L12 2zM9 13h.01M14 15h.01M12 9h.01" /></svg>,
};

// Colores de categoría del diseño (monograma con tinte)
const CAT_COLORS = {
  ADICIONES: "#D9731A", AREPAS: "#C9962B", HAMBURGUESAS: "#B5552E", PIZZAS: "#C8423B", PORCIONES: "#7A8B3C",
  "PASTAS & LASAGNAS": "#B07A2A", "PASTAS Y LASAGNAS": "#B07A2A", MAZORCADAS: "#C9A227", ENSALADAS: "#3E8E5A", PATACONES: "#8C7A2E",
  "PERROS CALIENTES": "#B4462F", SANDWICHES: "#9A6B3F", SALCHIPAPAS: "#C46A2A", SODAS: "#2F7FA8", "RECETAS BODEGA": "#3F5E8C",
};
const FALLBACK = ["#D9731A", "#C9962B", "#B5552E", "#7A8B3C", "#3E8E5A", "#2F7FA8", "#9A6B3F", "#B4462F", "#3F5E8C", "#C46A2A"];
const norm = (x) => String(x || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
export function catColor(name) {
  const k = norm(name);
  if (CAT_COLORS[k]) return CAT_COLORS[k];
  let h = 0; for (const ch of k) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return FALLBACK[h % FALLBACK.length];
}
export const initialOf = (name) => (String(name || "").replace(/^(AD\.|S\.|HAMB\.)\s*/i, "").trim()[0] || "•").toUpperCase();
export const titleCase = (x) => String(x || "").toLowerCase().replace(/(^|\s|&)(\p{L})/gu, (m, a, b) => a + b.toUpperCase());

export function Monogram({ name, size = 30, radius = 9, color, dark = false }) {
  const c = color || catColor(name);
  return (
    <span style={{ width: size, height: size, borderRadius: radius, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", background: c + (dark ? "33" : "24"), color: dark ? "#fff" : c, fontFamily: "var(--dt-serif)", fontWeight: 700, fontSize: Math.round(size * 0.48) }}>
      {initialOf(name)}
    </span>
  );
}
