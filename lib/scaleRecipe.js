// Escalar una receta por proporción a partir de un ingrediente principal.
// Ingredientes con formato "0,5 KILO - AJO", "24 UNIDAD - S. PAN", "1,8 LITRO - LECHE".

const UNIT_ALIASES = {
  KILO: "KILO", KILOS: "KILO", KG: "KILO", KGS: "KILO", K: "KILO",
  GR: "GR", GRS: "GR", GRAMO: "GR", GRAMOS: "GR", G: "GR",
  LITRO: "LITRO", LITROS: "LITRO", LT: "LITRO", LTS: "LITRO", L: "LITRO",
  ML: "ML", MILILITRO: "ML", MILILITROS: "ML",
  UNIDAD: "UNIDAD", UNIDADES: "UNIDAD", UND: "UNIDAD", UNDS: "UNIDAD", UN: "UNIDAD", U: "UNIDAD",
  LIBRA: "LIBRA", LIBRAS: "LIBRA", LB: "LIBRA", LBS: "LIBRA",
  ONZA: "ONZA", ONZAS: "ONZA", OZ: "ONZA",
  PORCION: "PORCION", PORCIONES: "PORCION",
};

// gramos por unidad (la libra en Colombia es de 500 g)
export const GRAMS_PER = { KILO: 1000, GR: 1, LIBRA: 500, ONZA: 28.35 };

export function parseNumber(s) {
  let t = String(s ?? "").trim();
  if (!t) return NaN;
  if (t.includes(".") && t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else t = t.replace(",", ".");
  return parseFloat(t);
}

// "0,5 KILO - AJO" → { qty: 0.5, unit: "KILO", unitRaw: "KILO", name: "AJO" }
export function parseQty(text) {
  const m = String(text || "").match(/^\s*(\d+(?:[.,]\d+)*)\s*([A-Za-zÁÉÍÓÚÑáéíóúñ]+\.?)?\s*-?\s*(.*)$/);
  if (!m) return null;
  const qty = parseNumber(m[1]);
  if (!isFinite(qty)) return null;
  const raw = (m[2] || "").replace(/\.$/, "");
  const key = raw.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const unit = UNIT_ALIASES[key] || key;
  return { qty, unit, unitRaw: raw.toUpperCase() || unit, name: (m[3] || "").trim() };
}

export const toGrams = (p) => (p && GRAMS_PER[p.unit] ? p.qty * GRAMS_PER[p.unit] : null);

export function fmtNum(v, maxDec = 3) {
  return Number(v).toLocaleString("es-CO", { maximumFractionDigits: maxDec, minimumFractionDigits: 0 });
}

// Formato de cantidades igual a gabycontrol (kardex): tres decimales con punto → "0.054 KILO", "1.800 LITRO".
export const fmtGaby = (q) => (Math.round(Number(q) * 1000) / 1000).toFixed(3);

// Texto de una cantidad escalada: main en formato gabycontrol + ayuda en gramos/ml para pesar
//   "0.250 KILO · 250 g" · "0.900 LITRO · 900 ml" · "12.000 UNIDAD" · "9.500 UNIDAD · ≈ 10"
export function fmtScaled(p, factor) {
  const q = p.qty * factor;
  const u = p.unitRaw || p.unit;
  if (p.unit === "KILO") return { main: `${fmtGaby(q)} ${u}`, sub: `${fmtNum(Math.round(q * 1000), 0)} g` };
  if (p.unit === "LITRO") return { main: `${fmtGaby(q)} ${u}`, sub: `${fmtNum(Math.round(q * 1000), 0)} ml` };
  if (p.unit === "LIBRA") return { main: `${fmtGaby(q)} ${u}`, sub: `${fmtNum(Math.round(q * 500), 0)} g` };
  if (p.unit === "GR" || p.unit === "ML") return { main: `${fmtGaby(q / 1000)} ${p.unit === "GR" ? "KILO" : "LITRO"}`, sub: `${fmtNum(Math.round(q), 0)} ${p.unit === "GR" ? "g" : "ml"}` };
  if (p.unit === "UNIDAD" || p.unit === "PORCION") {
    const r = Math.round(q * 1000) / 1000;
    return { main: `${fmtGaby(r)} ${u}`, sub: Number.isInteger(r) ? "" : `≈ ${Math.ceil(r)}` };
  }
  return { main: `${fmtGaby(q)} ${u}`, sub: "" };
}

// Ingrediente principal por defecto: el de mayor peso/volumen (ej. Salsa Mayonesa Casino 24 KILO)
export function defaultBaseIndex(parsed) {
  let best = -1, bestV = -1;
  parsed.forEach((p, i) => {
    if (!p) return;
    const g = GRAMS_PER[p.unit] ? p.qty * GRAMS_PER[p.unit] : p.unit === "LITRO" ? p.qty * 1000 : p.unit === "ML" ? p.qty : -1;
    if (g > bestV) { bestV = g; best = i; }
  });
  if (best < 0) best = parsed.findIndex(p => p);
  return best;
}
