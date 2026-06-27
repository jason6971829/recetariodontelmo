// Conversiones a unidad base del kardex de gabycontrol.
// El kardex SOLO maneja KILO, LITRO, UNIDAD — toda receta se guarda en una
// de esas tres en decimal. El usuario puede ESCRIBIR en otras unidades por
// comodidad (gramos, ml, libras, etc), pero se convierten antes de guardar.

const FACTORS = {
  KILO: 1, GRAMOS: 0.001, LIBRA: 0.4536, ONZA: 0.02835,
  LITRO: 1, ML: 0.001,
  UNIDAD: 1, PORCION: 1,
};

const BASE_OF = {
  KILO: "KILO", GRAMOS: "KILO", LIBRA: "KILO", ONZA: "KILO",
  LITRO: "LITRO", ML: "LITRO",
  UNIDAD: "UNIDAD", PORCION: "UNIDAD",
};

const COMPATIBLE = {
  KILO: ["KILO", "GRAMOS", "LIBRA", "ONZA"],
  LITRO: ["LITRO", "ML"],
  UNIDAD: ["UNIDAD"],
};

export const BASE_UNITS = ["KILO", "LITRO", "UNIDAD"];

export function normalizeUnit(u) {
  return String(u || "").toUpperCase().trim();
}

export function baseOf(unit) {
  return BASE_OF[normalizeUnit(unit)] || normalizeUnit(unit);
}

export function isBaseUnit(unit) {
  return BASE_UNITS.includes(normalizeUnit(unit));
}

export function compatibleUnits(baseUnit) {
  return COMPATIBLE[normalizeUnit(baseUnit)] || [normalizeUnit(baseUnit)];
}

// Convierte (qty, unit) a la unidad base del insumo. Si las unidades no son
// compatibles (ej: pedir ML a un insumo KILO) devuelve null.
export function toBaseUnit(qty, unit, targetBase) {
  const u = normalizeUnit(unit);
  const t = normalizeUnit(targetBase);
  const f = FACTORS[u];
  const b = BASE_OF[u];
  if (f == null || b !== t) return null;
  const n = Number(qty);
  if (!Number.isFinite(n)) return null;
  return n * f;
}

// 0.0200 -> "0.02", 1 -> "1", 0.333333 -> "0.3333"
export function formatQty(n) {
  if (!Number.isFinite(n)) return "0";
  const fixed = Number(n).toFixed(4);
  return fixed.replace(/\.?0+$/, "");
}
