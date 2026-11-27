// Producción de bodega: producto principal, tipo de cada insumo (exacto / con rango),
// órdenes, registros de producción (rendimiento real) y despieces con merma.
//
// Todo vive en dos JSON compartidos entre los equipos (mismo patrón que las órdenes de panadería):
//   bodega/config.json    → { [recipeId]: { principal, tipos: { [clave]: "rango"|"exacto" }, rango, despiece: { salidas: [...] } } }
//   bodega/registros.json → [ { id, kind: "orden"|"produccion"|"despiece", ... } ]
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const CFG_PATH = "bodega/config.json";
const REG_PATH = "bodega/registros.json";
const BUCKET = "recipe-images";

async function loadDoc(path, empty) {
  try {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const res = await fetch(`${data.publicUrl}?t=${Date.now()}`, { cache: "no-store" });
    if (res.status === 400 || res.status === 404) return empty;
    if (!res.ok) return null;
    const j = await res.json();
    return Array.isArray(empty) ? (Array.isArray(j) ? j : empty) : (j && typeof j === "object" && !Array.isArray(j) ? j : empty);
  } catch (err) { console.error("bodega loadDoc", path, err); return null; }
}
// fn(actual) -> nuevo. Relee la versión más nueva antes de guardar (no pisa lo de otro equipo).
async function updateDoc(path, empty, fn) {
  const cur = await loadDoc(path, empty);
  if (cur == null) return null;
  const next = fn(cur);
  try {
    const blob = new Blob([JSON.stringify(next)], { type: "application/json" });
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { upsert: true, cacheControl: "0", contentType: "application/json" });
    if (error) { console.error("bodega updateDoc", path, error); return null; }
    return next;
  } catch (err) { console.error("bodega updateDoc", path, err); return null; }
}

export const loadBodegaConfig = () => loadDoc(CFG_PATH, {});
export const updateBodegaConfig = (fn) => updateDoc(CFG_PATH, {}, fn);
export const loadRegistros = () => loadDoc(REG_PATH, []);
export const updateRegistros = (fn) => updateDoc(REG_PATH, [], fn);
// Los registros se guardan con tope para que el archivo no crezca sin fin
export const addRegistro = (reg) => updateRegistros(list => [reg, ...list].slice(0, 1500));
export const patchRegistro = (id, fn) => updateRegistros(list => list.map(r => (r.id === id ? fn(r) : r)));

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const norm = (s) => String(s || "").toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Z0-9]+/g, " ").trim();
// Clave de un insumo dentro de la receta: su código; si no tiene, el nombre
export const ingKey = (code, name) => (String(code || "").trim() ? String(code).trim() : "n:" + norm(name));

// ── Tipo de insumo ──
// principal: se pesa primero, sin meta: lo que llegó es lo que se usa y toda la receta se recalcula.
// rango:     verduras, frutas, carnes… se acepta un margen (± RANGO_PCT %).
// exacto:    azúcar, sal, químicos… solo pasa con el peso justo.
export const RANGO_PCT = 5;
const CATS_RANGO = new Set(["VERDURAS", "FRUTAS", "CARNES"]);
export const tipoDefault = (categoria) => (CATS_RANGO.has(norm(categoria)) ? "rango" : "exacto");
export function tipoDe(cfg, key, categoria) {
  const t = cfg?.tipos?.[key];
  return t === "rango" || t === "exacto" ? t : tipoDefault(categoria);
}
export const rangoPct = (cfg) => (Number(cfg?.rango) > 0 ? Number(cfg.rango) : RANGO_PCT);

// Catálogo de insumos (código → categoría), una sola vez por sesión
let _cats = null, _catsP = null;
function fetchCats() {
  if (_cats) return Promise.resolve(_cats);
  if (_catsP) return _catsP;
  _catsP = fetch("/api/insumos").then(r => (r.ok ? r.json() : [])).then(list => {
    const m = {};
    (Array.isArray(list) ? list : []).forEach(i => { if (i?.codigo != null) m[String(i.codigo).trim()] = i.categoria || ""; });
    _cats = m; _catsP = null; return m;
  }).catch(() => { _catsP = null; return {}; });
  return _catsP;
}
export function useInsumoCats(enabled = true) {
  const [cats, setCats] = useState(_cats || {});
  useEffect(() => { if (enabled) fetchCats().then(setCats); }, [enabled]);
  return cats;
}

// Config compartida: se lee al abrir y se puede refrescar
let _cfg = null;
export function useBodegaConfig(enabled = true) {
  const [cfg, setCfg] = useState(_cfg || {});
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    loadBodegaConfig().then(c => { if (alive && c) { _cfg = c; setCfg(c); } });
    return () => { alive = false; };
  }, [enabled]);
  const patch = async (recipeId, fn) => {
    const next = await updateBodegaConfig(all => ({ ...all, [recipeId]: fn(all[recipeId] || {}) }));
    if (next) { _cfg = next; setCfg(next); }
    return !!next;
  };
  return [cfg, patch];
}

// Panes: la receta es la fórmula de la Calculadora de Masas (id del pan en la calculadora)
const PANES = { "S PAN HAMBURGUESA": "pan-burger", "S PAN HAMBURGUESA MINI": "pan-burger-mini", "S PAN SANDWICH": "pan-sandwich", "S PAN PERRO": "pan-perro" };
export const panDeCalculadora = (name) => PANES[norm(name)] || null;

// ── Despieces ──
// merma = lo que entró − lo que salió (en kilos). El costo se reparte entre lo que sale; la merma queda en el reporte.
export function mermaDespiece(entraKg, salidas) {
  const sale = (salidas || []).reduce((a, s) => a + (Number(s.kg) || 0), 0);
  const kg = Math.round((entraKg - sale) * 1000) / 1000;
  return { saleKg: Math.round(sale * 1000) / 1000, kg, pct: entraKg > 0 ? (kg / entraKg) * 100 : 0 };
}

export const fmtFecha = (iso) => { try { return new Date(iso).toLocaleString("es-CO", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };
