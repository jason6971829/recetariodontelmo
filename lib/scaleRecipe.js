// Escalar una receta por proporción a partir de un ingrediente principal.
// Ingredientes con formato "0,5 KILO - AJO", "24 UNIDAD - S. PAN", "1,8 LITRO - LECHE".

const UNIT_ALIASES = {
  KILO: "KILO", KILOS: "KILO", KG: "KILO", KGS: "KILO", K: "KILO",
  GR: "GR", GRS: "GR", GRAMO: "GR", GRAMOS: "GR", G: "GR",
  LITRO: "LITRO", LITROS: "LITRO", LT: "LITRO", LTS: "LITRO", L: "LITRO",
  ML: "ML", MILILITRO: "ML", MILILITROS: "ML", CC: "ML",
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

// Formato de cantidades igual a gabycontrol: tres decimales, formato colombiano
// (punto de miles, coma decimal) → "0,054 KILO", "1,800 LITRO", "1.250,000 KILO".
// Mínimo 3 decimales; hasta 5 solo si hacen falta (químicos: 0,0005 KILO = medio gramo).
export const fmtGaby = (q) => {
  const n = Math.round((Number(q) || 0) * 100000) / 100000;
  let [i, d] = Math.abs(n).toFixed(5).split(".");
  while (d.length > 3 && d.endsWith("0")) d = d.slice(0, -1);
  return (n < 0 ? "-" : "") + i.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "," + d;
};
// Lo mismo desde gramos: 6067 g → "6,067"
export const kgFromG = (g) => fmtGaby(Math.round(Number(g) || 0) / 1000);

// Unidades que gabycontrol entiende; las demás caen a factor 1 y descuentan mal
const GABY_OK = new Set(["KILO", "GR", "LITRO", "ML", "UNIDAD"]);
// Problema de unidad de un ingrediente (texto "0,175 UNIDAD - Chorizo"), o null si está bien
export function unitProblem(text) {
  const t = String(text || "").trim();
  if (!t) return null;
  if (/^\s*\d+\s*\/\s*\d+/.test(t)) return "Fracción escrita con /: escribila en decimal (ej. 0,250), si no gabycontrol descuenta 1 entero";
  const p = parseQty(t);
  if (!p) return "Sin cantidad al inicio: gabycontrol lo toma como 1 UNIDAD";
  if (!p.unitRaw || !GABY_OK.has(p.unit)) return `“${p.unitRaw || "sin unidad"}” no existe en gabycontrol: usá KILO, LITRO o UNIDAD (o GRAMOS / ML)`;
  const m = t.match(/^\s*\d+[.,](\d+)/);
  if (p.unit === "UNIDAD" && m && m[1].length > 3) return "Más de 3 decimales: usá una fracción exacta (0,175 · 0,250 · 0,125)";
  if (p.unit === "UNIDAD" && /^(333|666|667)$/.test(String(Math.round((p.qty % 1) * 1000)).padStart(3, "0"))) return "Fracción periódica (tercios): deja residuo en el kardex, usá una exacta (0,250 · 0,375 · 0,500)";
  return null;
}

// Texto de una cantidad escalada: main en formato gabycontrol + ayuda en gramos/ml para pesar
//   "0,250 KILO · 250 g" · "0,900 LITRO · 900 ml" · "0,175 UNIDAD"
export function fmtScaled(p, factor) {
  const q = p.qty * factor;
  const u = p.unitRaw || p.unit;
  if (p.unit === "KILO") return { main: `${fmtGaby(q)} ${u}`, sub: `${fmtNum(q * 1000, q < 0.01 ? 2 : 0)} g` };
  if (p.unit === "LITRO") return { main: `${fmtGaby(q)} ${u}`, sub: `${fmtNum(Math.round(q * 1000), 0)} ml` };
  if (p.unit === "LIBRA") return { main: `${fmtGaby(q)} ${u}`, sub: `${fmtNum(Math.round(q * 500), 0)} g` };
  if (p.unit === "GR" || p.unit === "ML") return { main: `${fmtGaby(q / 1000)} ${p.unit === "GR" ? "KILO" : "LITRO"}`, sub: `${fmtNum(Math.round(q), 0)} ${p.unit === "GR" ? "g" : "ml"}` };
  // UNIDAD: fracción de pieza con decimales, sin redondear (regla gabycontrol)
  if (p.unit === "UNIDAD") return { main: `${fmtGaby(q)} ${u}`, sub: "" };
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
