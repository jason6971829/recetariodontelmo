"use client";
import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";

// Calculadora de porcentaje panadero — herramienta independiente.
// Harina = 100%. Reglas:
//  - Peso a bolear = peso final × (1 + merma%), redondeado HACIA ARRIBA al multiplo.
//  - Modo unidades: harina = unidades × pesoBolear ÷ suma% × 100.
//  - Modo gramos/total: se recalcula la harina, luego todo, y las unidades =
//    piso(masa total ÷ peso), mostrando la masa sobrante.
// Las recetas se cargan/editan aca mismo y se guardan en el navegador.

const STORE_KEY = "calcpan_recipes_v1";

const BASE = {
  id: "formula-base",
  name: "Fórmula base",
  wfinal: 80, merma: 15, round: 5, units: 300,
  instr: `ESTANDARIZACIÓN FÓRMULA BASE: formulación técnica oficial para {unidades} unidades de {peso} g en crudo ({final} g horneados), hidratación al {hidratacion}% sobre Harina Crema del Norte, método estricto de mezcla por fases (margarina y sal de últimas) y control térmico.

PUNTO DE ADICIÓN EN LA AMASADORA
• En seco (Vel 1) al tazón con la harina: Propionato, Leche y Azúcar.
• Levadura fresca: desmenuzar sobre los secos (Vel 1).
• Líquido total: {hielo} g hielo picado + {agua} g agua helada.
• Margarina Astra y Sal: DE ÚLTIMO, al pasar a Velocidad 2.

PASO A PASO
Paso 1 — Homogeneización de polvos secos (Vel 1, 2 min): harina crema del norte ({kg:Harina} kg), propionato ({g:Propionato} g), leche en polvo ({g:Leche} g), azúcar ({g:Azúcar} g) y levadura desmenuzada ({g:Levadura} g). Encender Vel 1 por 2 min para mezclar uniformemente los secos.
Paso 2 — Pre-hidratación y control de temperatura (Vel 1, 3–4 min): pesar {g:Líquido Total} g de líquido total divididos en {hielo} g de hielo picado y {agua} g de agua helada (temp ≤ 4 °C). Agregar el hielo picado directo sobre los secos y verter el agua helada en hilo continuo mientras gira en Vel 1, hasta que la harina absorba el 100% de la humedad libre.
Paso 3 — Incorporación de grasa y sal (regla de oro de las últimas): una vez la masa tome consistencia firme y no quede harina suelta, incorporar de últimas {g:Margarina} g de margarina Astra y {g:Sal} g de sal refinada. La sal y la grasa no entran al inicio para no inhibir la levadura ni impermeabilizar las proteínas antes de que absorban el agua.
Paso 4 — Desarrollo de gluten y membrana (Vel 2, 8–10 min): pasar a Vel 2 y amasar hasta desarrollar el gluten al 100%, logrando una membrana/pantalla transparente elástica perfecta (Punto de Tela) que estire sin agrietarse. Temperatura final de masa: 23–25 °C máx.
Paso 5 — Pesaje y división mecánica: {division}

REGLAS OBLIGATORIAS (bodega, horno y control de moho)
• Boleado apretado con tensión: bolear con presión (palma en copa) para una "piel" exterior lisa y muy tensa. Colocar en lata y dar un solo toque suave en el centro (prohibido aplastar duro, para garantizar crecimiento vertical).
• Leudo en cámara Inoxforni: 34 °C y 80% HR por 55–65 min, hasta duplicar volumen.
• Horneado: 170–175 °C por 12–13 min (inyectar 2–3 segundos de vapor al entrar). Al salir, el centro debe marcar 93–96 °C. Dar un golpe firme a la lata contra la mesa para evitar encogimiento.
• REGLA DEL TERMÓMETRO (cero moho): PROHIBIDO embolsar por tiempo o reloj. Clavar el termómetro de punzón en el centro del pan y SOLO EMBOLSAR cuando marque menos de 26 °C. Si entra caliente a la bolsa, la condensación crea moho verde en 4 días.`,
  ings: [
    ["Harina Crema del Norte", 100], ["Propionato de Calcio", 0.5],
    ["Leche en Polvo", 5], ["Azúcar Blanco", 8], ["Levadura Fresca", 2],
    ["Líquido Total (Hielo + Agua)", 57], ["Margarina Industrial (Astra)", 10],
    ["Sal Refinada", 2],
  ].map(([name, pct]) => ({ name, pct })),
};

const CIMPA = {
  id: "formula-cimpa",
  name: "Pan Burger",
  wfinal: 80, merma: 15, round: 5, units: 200,
  instr: `FORMULACIÓN DEFINITIVA ESTANDARIZADA: ajustada para {unidades} panes de {peso} g en crudo ({final} g horneados), hidratación {hidratacion}% sobre Harina Crema del Norte, con aditivos CIMPA.

PUNTO DE ADICIÓN EN LA AMASADORA
• En seco (Vel 1) con la harina: Gluten, Fécula, Dimodan, Propionato, Leche y Azúcar.
• Levadura fresca: desmenuzar sobre los secos (Vel 1).
• Glicerina: disolver dentro del agua helada.
• Líquido total: {hielo} g hielo picado seco + {agua} g agua con glicerina.
• Margarina Astra y Sal: DE ÚLTIMO, al iniciar Velocidad 2.

PASO A PASO
Paso 1 — Mezclado en seco (Vel 1, 2 min): harina ({kg:Harina} kg), gluten ({g:Gluten} g), fécula ({g:Fécula} g), Dimodan ({g:Dimodan} g), propionato ({g:Propionato} g), leche ({g:Leche} g), azúcar ({g:Azúcar} g) y levadura desmenuzada ({g:Levadura} g). Encender Vel 1 por 2 min para homogeneizar los polvos.
Paso 2 — Pre-hidratación y control de temperatura (Vel 1, 3–4 min): disolver {g:Glicerina} g de glicerina en {agua} g de agua helada. Agregar {hielo} g de hielo picado directo sobre los secos y verter el agua helada con glicerina en hilo continuo mientras gira en Vel 1, hasta que la harina absorba toda la humedad.
Paso 3 — Incorporación de grasa y sal (regla de oro de las últimas): con la masa ya con cuerpo y pre-estructura (sin polvo libre), agregar {g:Margarina} g de margarina Astra y {g:Sal} g de sal refinada. La sal y la margarina van de últimas para no frenar la levadura ni impermeabilizar las proteínas antes de absorber el agua.
Paso 4 — Desarrollo de gluten y membrana (Vel 2, 8–10 min): amasar vigorosamente hasta una membrana/pantalla transparente elástica perfecta (Punto de Tela 100%) que estire sin romperse. Temperatura final de masa: 23–25 °C máx.
Paso 5 — División mecánica: {division}

REGLAS OBLIGATORIAS (bodega, horno y control de moho)
• Boleado apretado con tensión: bolear con fuerza (palma en copa) para una "piel" exterior lisa y muy tensa. Colocar en lata y dar un solo toque suave en el centro (sin aplastar).
• Leudo en cámara Inoxforni: 34 °C y 80% HR por 55–65 min, hasta duplicar volumen.
• Horneado: 170–175 °C por 12–13 min (dar 2–3 segundos de vapor al entrar). Al salir, el centro debe marcar 93–96 °C. Dar un golpe firme a la lata contra la mesa para evitar arrugamiento.
• REGLA DEL TERMÓMETRO (cero moho): PROHIBIDO embolsar por reloj. Clavar el termómetro de punzón en el centro del pan y SOLO EMBOLSAR cuando marque menos de 26 °C. Si entra caliente, la condensación crea moho verde en 4 días.`,
  ings: [
    ["Harina Crema del Norte", 100], ["Gluten Vital (CIMPA)", 1.5],
    ["Fécula de Papa (CIMPA)", 1], ["Dimodan HP SG (CIMPA)", 0.5],
    ["Propionato de Calcio", 0.5], ["Leche en Polvo", 5],
    ["Azúcar Blanco", 8], ["Levadura Fresca", 2],
    ["Glicerina USP (CIMPA)", 0.6], ["Líquido Total (Hielo + Agua)", 57],
    ["Margarina Industrial (Astra)", 10], ["Sal Refinada", 2],
  ].map(([name, pct]) => ({ name, pct })),
};

const SEED = [BASE, CIMPA];
const clone = (r) => ({ ...r, ings: r.ings.map(i => ({ ...i })) });

const fmt = (v, d = 0) =>
  (isFinite(v) ? v : 0).toLocaleString("es-CO", { minimumFractionDigits: d, maximumFractionDigits: d });
const num = (v) => { const x = parseFloat(v); return isFinite(x) ? x : 0; };
const uid = () => "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

function loadRecipes() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const r = raw ? JSON.parse(raw) : null;
    if (Array.isArray(r) && r.length) {
      // Migracion de la receta base: renombrar a "Formula base" y subir Agua 52% -> 57%
      // (solo si seguia en el default viejo, para no pisar un valor que el usuario haya cambiado)
      let out = r.map(x => {
        const isBase = x.id === "pan-perro-1" || x.id === "formula-base" || x.name === "Pan Perro #1";
        if (!isBase) return x;
        const ings = (x.ings || []).map(i => (i.name === "Agua" && num(i.pct) === 52) ? { ...i, pct: 57 } : i);
        return { ...x, id: "formula-base", name: "Fórmula base", ings };
      });
      // Agregar "Formula CIMPA" una sola vez (si el usuario la borra, no vuelve)
      let addedFlag = null;
      try { addedFlag = localStorage.getItem("calcpan_cimpa_v1"); } catch { /* ignore */ }
      if (!addedFlag && !out.some(x => x.id === "formula-cimpa")) out = [...out, clone(CIMPA)];
      try { localStorage.setItem("calcpan_cimpa_v1", "1"); } catch { /* ignore */ }
      // rev2: actualizar la CIMPA existente al orden + instrucciones definitivas (una sola vez)
      let rev2 = null;
      try { rev2 = localStorage.getItem("calcpan_cimpa_rev2"); } catch { /* ignore */ }
      if (!rev2) {
        out = out.map(x => x.id === "formula-cimpa"
          ? { ...x, ings: CIMPA.ings.map(i => ({ ...i })), instr: CIMPA.instr }
          : x);
        try { localStorage.setItem("calcpan_cimpa_rev2", "1"); } catch { /* ignore */ }
      }
      // rev2 base: actualizar la Formula base a la ficha oficial (orden + instrucciones), una sola vez
      let baseRev = null;
      try { baseRev = localStorage.getItem("calcpan_base_rev2"); } catch { /* ignore */ }
      if (!baseRev) {
        out = out.map(x => x.id === "formula-base"
          ? { ...x, ings: BASE.ings.map(i => ({ ...i })), instr: BASE.instr }
          : x);
        try { localStorage.setItem("calcpan_base_rev2", "1"); } catch { /* ignore */ }
      }
      // Correccion de hidratacion rev2: Liquido Total = 58% en ambas formulas (una sola vez).
      // Reemplaza la rev1 (60,3% / 60,2%); tambien refresca las instrucciones con la hidratacion nueva.
      let waterRev = null;
      try { waterRev = localStorage.getItem("calcpan_water_rev2"); } catch { /* ignore */ }
      if (!waterRev) {
        out = out.map(x => {
          if (x.id !== "formula-base" && x.id !== "formula-cimpa") return x;
          const seed = x.id === "formula-cimpa" ? CIMPA : BASE;
          return {
            ...x,
            instr: seed.instr,
            ings: (x.ings || []).map(i => String(i.name).startsWith("Líquido Total") ? { ...i, pct: 58 } : i),
          };
        });
        try { localStorage.setItem("calcpan_water_rev2", "1"); } catch { /* ignore */ }
      }
      // Correccion de hidratacion rev3: Liquido Total = 57% en ambas formulas (una sola vez).
      // Reemplaza la rev2 (58%); tambien refresca las instrucciones con la hidratacion nueva.
      let waterRev3 = null;
      try { waterRev3 = localStorage.getItem("calcpan_water_rev3"); } catch { /* ignore */ }
      if (!waterRev3) {
        out = out.map(x => {
          if (x.id !== "formula-base" && x.id !== "formula-cimpa") return x;
          const seed = x.id === "formula-cimpa" ? CIMPA : BASE;
          return {
            ...x,
            instr: seed.instr,
            ings: (x.ings || []).map(i => String(i.name).startsWith("Líquido Total") ? { ...i, pct: 57 } : i),
          };
        });
        try { localStorage.setItem("calcpan_water_rev3", "1"); } catch { /* ignore */ }
      }
      // Pan Burger: la ex "Formula CIMPA" queda fija (nombre, lote 200 u y fórmula), una sola vez.
      // Si alguien la habia borrado, vuelve a aparecer.
      let burgerRev = null;
      try { burgerRev = localStorage.getItem("calcpan_burger_v1"); } catch { /* ignore */ }
      if (!burgerRev) {
        const fixed = clone(CIMPA);
        out = out.some(x => x.id === "formula-cimpa")
          ? out.map(x => x.id === "formula-cimpa" ? { ...fixed, instr: x.instr || fixed.instr } : x)
          : [...out, fixed];
        try { localStorage.setItem("calcpan_burger_v1", "1"); } catch { /* ignore */ }
      }
      // Instrucciones vivas: reemplazar los textos con numeros fijos por la version con marcadores (una sola vez)
      let instrTpl = null;
      try { instrTpl = localStorage.getItem("calcpan_instr_tpl_v1"); } catch { /* ignore */ }
      if (!instrTpl) {
        out = out.map(x => x.id === "formula-base" ? { ...x, instr: BASE.instr }
          : x.id === "formula-cimpa" ? { ...x, instr: CIMPA.instr } : x);
        try { localStorage.setItem("calcpan_instr_tpl_v1", "1"); } catch { /* ignore */ }
      }
      // Restaurar la Formula base si se habia borrado (una sola vez; si se vuelve a borrar, no vuelve)
      let baseRestore = null;
      try { baseRestore = localStorage.getItem("calcpan_base_restore_v1"); } catch { /* ignore */ }
      if (!baseRestore) {
        if (!out.some(x => x.id === "formula-base")) out = [clone(BASE), ...out];
        try { localStorage.setItem("calcpan_base_restore_v1", "1"); } catch { /* ignore */ }
      }
      return out;
    }
  } catch { /* ignore */ }
  return SEED.map(clone);
}
function saveRecipes(list) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

// ── Instrucciones vivas: los marcadores {..} se reemplazan con los numeros de la formula ──
// {unidades} {peso} (a bolear) {final} (horneado) {hidratacion} {g:Ingrediente} {kg:Ingrediente}
// {hielo} {agua} (mitades del Liquido Total) {division} (bloques para divisora de 30)
const DIVISORA = 30;
const normName = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
function renderInstr(text, rec, R) {
  if (!text || !R) return text || "";
  const gramsOf = (name) => {
    const k = normName(name);
    const i = rec.ings.findIndex(x => normName(x.name).startsWith(k));
    return i >= 0 ? R.grams[i] : null;
  };
  const liq = gramsOf("Líquido Total") ?? gramsOf("Agua") ?? 0;
  const liqIng = rec.ings.find(x => normName(x.name).startsWith("liquido total")) || rec.ings.find(x => normName(x.name).startsWith("agua"));
  const hielo = Math.floor(liq / 2);
  const w = fmt(R.w, R.r > 0 ? 0 : 1);
  const division = () => {
    const full = Math.floor(R.units / DIVISORA), rest = R.units % DIVISORA;
    const bloque = fmt(Math.round(DIVISORA * R.w));
    const parts = [];
    if (full) parts.push(`${full} ${full === 1 ? "bloque" : "bloques"} de ${bloque} g`);
    if (rest) parts.push(`1 bloque de ${fmt(Math.round(rest * R.w))} g (${rest} testos)`);
    return `pesar ${parts.join(" + ") || "0 bloques"}. Pasar cada bloque por la divisora de ${DIVISORA} partes → testos de ${w} g crudo (${fmt(R.units)} panes en total).`;
  };
  const simple = {
    unidades: () => fmt(R.units),
    peso: () => w,
    final: () => fmt(num(rec.wfinal), num(rec.wfinal) % 1 ? 1 : 0),
    hidratacion: () => fmt(num(liqIng?.pct), 1),
    hielo: () => fmt(hielo),
    agua: () => fmt(liq - hielo),
    division,
  };
  return text.replace(/\{(g|kg):([^}]+)\}|\{([a-z]+)\}/gi, (m, unit, name, key) => {
    if (unit) {
      const g = gramsOf(name);
      if (g == null) return m;
      return unit.toLowerCase() === "kg" ? fmt(g / 1000, 2) : fmt(g);
    }
    const f = simple[key.toLowerCase()];
    return f ? f() : m;
  });
}

function compute(rec, drive, driverUnits, driverFlour) {
  const SUM = rec.ings.reduce((a, x) => a + num(x.pct), 0) || 1;
  const raw = num(rec.wfinal) * (1 + num(rec.merma) / 100);
  const r = num(rec.round);
  const w = r > 0 ? Math.ceil(raw / r) * r : raw;
  let flour, units;
  if (drive === "units") {
    units = Math.round(num(driverUnits));
    flour = w > 0 ? (units * w * 100) / SUM : 0;
  } else {
    flour = num(driverFlour);
    units = w > 0 ? Math.floor((flour * SUM / 100) / w) : 0;
  }
  const total = flour * SUM / 100;
  const grams = rec.ings.map(x => Math.round(flour * num(x.pct) / 100));
  const left = total - units * w;
  return { SUM, raw, w, r, flour, units, total, grams, left };
}

// ── estilos Don Telmo ─────────────────────────────────────────────
const C = { navy: "var(--app-primary, #1B3A5C)", navyD: "var(--app-primary-dark, #122845)", gold: "#D4721A", line: "#E0D8CE", cream: "#FDFAF6", ink: "#3a2f29" };
const inp = { padding: "8px 10px", border: `1.5px solid ${C.line}`, borderRadius: "8px", fontSize: "14px", outline: "none", width: "100%", textAlign: "right", fontWeight: 700, color: C.ink, background: "#fff", fontFamily: "'Poppins', sans-serif", boxSizing: "border-box" };
const inpDrive = { ...inp, borderColor: C.gold, background: "#FBEFE3" };
const lbl = { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#8a7a6e", fontWeight: 600 };
const sect = { fontFamily: "Georgia, serif", fontSize: 11, fontWeight: 700, letterSpacing: "2px", color: C.navy, textTransform: "uppercase", margin: "4px 0 10px", paddingBottom: 6, borderBottom: `1.5px solid ${C.gold}` };
const btn = { border: `1.5px solid ${C.line}`, background: "#fff", color: C.ink, font: "inherit", fontWeight: 700, fontSize: 12, padding: "7px 12px", borderRadius: 8, cursor: "pointer" };
const btnGold = { ...btn, background: C.gold, borderColor: C.gold, color: "#fff" };

// Impresion: solo se imprime la calculadora, tal cual se ve (sin botones), en paginas completas.
// Las instrucciones salen solo si estan desplegadas ("Ver instrucciones").
const CHECK_COLS = 6;
const PRINT_CSS = `
.calcpan-printonly { display: none; }
@media print {
  .calcpan-printonly { display: table-cell !important; }
  @page { size: letter portrait; margin: 10mm; }
  html, body { height: auto !important; overflow: visible !important; background: #fff !important; }
  body > *:not(.calcpan-print-root) { display: none !important; }
  .calcpan-print-root { position: static !important; background: #fff !important; padding: 0 !important; display: block !important; }
  .calcpan-card { width: 100% !important; max-width: none !important; max-height: none !important; overflow: visible !important; box-shadow: none !important; border-radius: 0 !important; }
  .calcpan-body { overflow: visible !important; }
  .calcpan-noprint { display: none !important; }
  .calcpan-print-root * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .calcpan-print-root tr { break-inside: avoid; }
}`;

// Input numerico que, mientras se edita, muestra lo que el usuario escribe:
// al borrar queda vacio (no "0") y se quitan los ceros a la izquierda ("05" -> "5").
function NumInput({ value, onChange, ...props }) {
  const [draft, setDraft] = useState(null);
  return (
    <input
      {...props}
      type="number"
      value={draft ?? value}
      onFocus={e => { setDraft(String(value ?? "")); e.target.select(); }}
      onBlur={() => setDraft(null)}
      onChange={e => {
        const v = e.target.value.replace(/^0+(?=\d)/, "");
        setDraft(v);
        onChange(v);
      }}
    />
  );
}

export function CalculadoraPan({ onClose }) {
  const [recipes, setRecipes] = useState(() => (typeof window !== "undefined" ? loadRecipes() : SEED));
  const [selId, setSelId] = useState(() => (typeof window !== "undefined" ? (loadRecipes()[0]?.id) : SEED[0].id));
  const [edit, setEdit] = useState(false);
  const [drive, setDrive] = useState("units");
  const [driverUnits, setDriverUnits] = useState(320);
  const [driverFlour, setDriverFlour] = useState(0);
  const [showInstr, setShowInstr] = useState(false);
  const [toast, setToast] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);

  const sel = recipes.find(r => r.id === selId) || recipes[0];

  useEffect(() => { saveRecipes(recipes); }, [recipes]);

  // Al cambiar de receta: arrancar en modo unidades con las unidades guardadas
  useEffect(() => {
    if (!sel) return;
    setDrive("units");
    setDriverUnits(sel.units || 320);
    setDriverFlour(0);
    setEdit(false);
    setShowInstr(false);
  }, [selId]); // eslint-disable-line react-hooks/exhaustive-deps

  const R = useMemo(() => sel ? compute(sel, drive, driverUnits, driverFlour) : null, [sel, drive, driverUnits, driverFlour]);

  if (!sel || !R) return null;

  // ── mutadores de receta ─────────────────────────────────────────
  const patchRecipe = (patch) => setRecipes(rs => rs.map(r => r.id === selId ? { ...r, ...patch } : r));
  const patchIng = (i, patch) => setRecipes(rs => rs.map(r => r.id === selId ? { ...r, ings: r.ings.map((x, j) => j === i ? { ...x, ...patch } : x) } : r));
  const addIng = () => setRecipes(rs => rs.map(r => r.id === selId ? { ...r, ings: [...r.ings, { name: "Nuevo", pct: 0 }] } : r));
  const delIng = (i) => setRecipes(rs => rs.map(r => r.id === selId ? { ...r, ings: r.ings.filter((_, j) => j !== i) } : r));

  const setUnits = (v) => { setDrive("units"); setDriverUnits(v); patchRecipe({ units: Math.round(num(v)) }); };
  const setGram = (i, v) => { const pct = num(sel.ings[i].pct) || 100; setDrive("flour"); setDriverFlour(num(v) * 100 / pct); };
  const setTotal = (v) => { setDrive("flour"); setDriverFlour(num(v) * 100 / R.SUM); };

  const newRecipe = () => {
    const r = { id: uid(), name: "Nueva receta", wfinal: 80, merma: 15, round: 5, units: 100, instr: "", ings: [{ name: "Harina", pct: 100 }] };
    setRecipes(rs => [...rs, r]); setSelId(r.id); setEdit(true);
  };
  const dupRecipe = () => {
    const r = { ...sel, id: uid(), name: sel.name + " (copia)", ings: sel.ings.map(x => ({ ...x })) };
    setRecipes(rs => [...rs, r]); setSelId(r.id);
  };
  const printRecipe = () => { setConfirmDel(false); setTimeout(() => window.print(), 50); };
  const delRecipe = () => {
    setConfirmDel(false);
    setRecipes(rs => {
      const next = rs.filter(r => r.id !== selId);
      if (!next.length) { const s = SEED.map(r => ({ ...r, ings: r.ings.map(i => ({ ...i })) })); setSelId(s[0].id); return s; }
      setSelId(next[0].id); return next;
    });
  };

  const copyRecipe = async () => {
    const txt = `${sel.name}\n${fmt(R.units)} unidades × ${fmt(R.w, R.r > 0 ? 0 : 1)} g\nMasa total: ${fmt(Math.round(R.total))} g\n\n` +
      sel.ings.map((x, i) => `${x.name}: ${fmt(R.grams[i])} g (${fmt(num(x.pct), num(x.pct) % 1 ? 1 : 0)}%)`).join("\n") +
      (sel.instr && sel.instr.trim() ? `\n\n— Instrucciones —\n${renderInstr(sel.instr, sel, R)}` : "");
    try { await navigator.clipboard.writeText(txt); setToast("Receta copiada"); }
    catch { setToast("No se pudo copiar"); }
    setTimeout(() => setToast(""), 2500);
  };

  const kpi = (label, val) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, background: C.cream, border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 12px" }}>
      <span style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "#9a8a7e", fontWeight: 700 }}>{label}</span>
      <strong style={{ fontFamily: "'Poppins',sans-serif", fontSize: 20, fontWeight: 700, color: C.navy }}>{val}</strong>
    </div>
  );

  return createPortal(
    <div className="calcpan-print-root" style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(10,15,25,0.88)", display: "flex", alignItems: "center", justifyContent: "center", padding: 14 }}>
      <style>{PRINT_CSS}</style>
      <div className="calcpan-card" style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 680, maxHeight: "92vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 30px 80px rgba(0,0,0,0.5)", fontFamily: "'Poppins',sans-serif" }}>
        {/* Header */}
        <div style={{ background: `linear-gradient(135deg, ${C.navy}, ${C.navyD})`, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div>
            <div style={{ color: C.gold, fontSize: 10, fontWeight: 700, letterSpacing: 3, fontFamily: "Georgia,serif" }}>DON TELMO® · 1958 · COMPANY</div>
            <div style={{ color: "#fff", fontFamily: "Georgia,serif", fontSize: 18, fontWeight: 700, marginTop: 3 }}>🍞 Calculadora de Masas</div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 2 }}>Porcentaje panadero · harina = 100%</div>
          </div>
          <button className="calcpan-noprint" onClick={onClose} title="Cerrar" style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, color: "#fff", width: 36, height: 36, cursor: "pointer", fontSize: 20, flexShrink: 0 }}>×</button>
        </div>

        {/* Selector de receta */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", padding: "12px 20px", background: C.cream, borderBottom: `1.5px solid ${C.line}`, flexShrink: 0 }}>
          <select value={selId} onChange={e => { setSelId(e.target.value); setConfirmDel(false); }} style={{ ...inp, textAlign: "left", width: "auto", flex: 1, minWidth: 140, fontWeight: 700 }}>
            {recipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <button className="calcpan-noprint" style={btn} onClick={printRecipe}>🖨️ Imprimir</button>
          <button className="calcpan-noprint" style={btn} onClick={newRecipe}>+ Nueva</button>
          <button className="calcpan-noprint" style={btn} onClick={dupRecipe}>Duplicar</button>
          <button className="calcpan-noprint" style={{ ...btn, color: "#c0392b", borderColor: "#e8c5bf" }} onClick={() => setConfirmDel(true)}>Borrar</button>
          <button className="calcpan-noprint" style={edit ? btnGold : btn} onClick={() => setEdit(e => !e)}>{edit ? "Listo ✓" : "✏️ Editar fórmula"}</button>
        </div>
        {confirmDel && (
          <div className="calcpan-noprint" role="alertdialog" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "12px 20px", background: "#FDECEA", borderBottom: "1.5px solid #e8c5bf", flexShrink: 0 }}>
            <span style={{ flex: 1, minWidth: 180, fontSize: 13, fontWeight: 600, color: "#8e2b20" }}>
              ⚠️ ¿Seguro que querés borrar «{sel?.name}»? No se puede deshacer.
            </span>
            <button style={btn} onClick={() => setConfirmDel(false)}>Cancelar</button>
            <button style={{ ...btn, background: "#c0392b", borderColor: "#c0392b", color: "#fff" }} onClick={delRecipe}>Sí, borrar</button>
          </div>
        )}

        {/* Body */}
        <div className="calcpan-body" style={{ overflowY: "auto", flex: 1, padding: "16px 20px 24px", background: "#fff" }}>
          {edit && (
            <div style={{ gridColumn: "1/-1" }}>
              <label style={{ ...lbl, marginBottom: 12 }}>Nombre de la receta
                <input style={{ ...inp, textAlign: "left" }} value={sel.name} onChange={e => patchRecipe({ name: e.target.value })} />
              </label>
            </div>
          )}

          <div style={sect}>Lote</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
            <label style={lbl}>Unidades
              <NumInput inputMode="numeric" min="0" step="1" style={drive === "units" ? inpDrive : inp} value={R.units} onChange={v => setUnits(v)} />
            </label>
            <label style={lbl}>Peso final por pan (g)
              <NumInput inputMode="decimal" min="0" step="1" style={inp} value={sel.wfinal} onChange={v => patchRecipe({ wfinal: v })} />
            </label>
            <label style={lbl}>Merma (%)
              <NumInput inputMode="decimal" min="0" step="0.5" style={inp} value={sel.merma} onChange={v => patchRecipe({ merma: v })} />
            </label>
            <label style={lbl}>Redondear peso a (g)
              <NumInput inputMode="numeric" min="0" step="1" style={inp} value={sel.round} onChange={v => patchRecipe({ round: v })} />
            </label>
          </div>
          <div style={{ fontFamily: "'Poppins',sans-serif", fontSize: 12, color: "#8a7a6e", background: "#FBEFE3", borderRadius: 8, padding: "8px 10px", marginBottom: 18 }}>
            {fmt(num(sel.wfinal))} g + {fmt(num(sel.merma), 1)}% merma = {fmt(R.raw, 1)} g → <b style={{ color: C.gold }}>{fmt(R.w, R.r > 0 ? 0 : 1)} g a bolear</b>
          </div>

          <div style={sect}>Fórmula</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 14 }}>
            {kpi("Unidades", fmt(R.units))}
            {kpi("Peso a bolear", fmt(R.w, R.r > 0 ? 0 : 1) + " g")}
            {kpi("Masa total", fmt(Math.round(R.total)) + " g")}
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontVariantNumeric: "tabular-nums" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#9a8a7e", padding: "6px 4px", borderBottom: `1px solid ${C.line}` }}>Ingrediente</th>
                  <th style={{ textAlign: "right", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#9a8a7e", padding: "6px 4px", borderBottom: `1px solid ${C.line}`, width: 70 }}>%</th>
                  <th style={{ textAlign: "right", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#9a8a7e", padding: "6px 4px", borderBottom: `1px solid ${C.line}`, width: 130 }}>Gramos</th>
                  {edit && <th style={{ width: 30, borderBottom: `1px solid ${C.line}` }} />}
                  {Array.from({ length: CHECK_COLS }, (_, k) => (
                    <th key={`chk-h-${k}`} className="calcpan-printonly" style={{ textAlign: "center", fontSize: 11, color: "#9a8a7e", padding: "6px 2px", borderBottom: `1px solid ${C.line}`, width: 28 }}>{k + 1}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sel.ings.map((x, i) => (
                  <tr key={i}>
                    <td style={{ padding: "6px 4px", borderBottom: `1px solid #f0ebe5`, fontWeight: 600, color: C.ink }}>
                      {edit
                        ? <input style={{ ...inp, textAlign: "left", padding: "6px 8px" }} value={x.name} onChange={e => patchIng(i, { name: e.target.value })} />
                        : x.name}
                    </td>
                    <td style={{ padding: "6px 4px", borderBottom: `1px solid #f0ebe5`, textAlign: "right", fontFamily: "'Poppins',sans-serif", color: "#8a7a6e" }}>
                      {edit
                        ? <NumInput step="0.1" min="0" style={{ ...inp, padding: "6px 8px" }} value={x.pct} onChange={v => patchIng(i, { pct: v })} />
                        : fmt(num(x.pct), num(x.pct) % 1 ? 1 : 0)}
                    </td>
                    <td style={{ padding: "6px 4px", borderBottom: `1px solid #f0ebe5` }}>
                      <NumInput inputMode="numeric" min="0" step="1" style={{ ...inp, padding: "7px 8px" }} value={R.grams[i]} onChange={v => setGram(i, v)} />
                    </td>
                    {edit && (
                      <td style={{ padding: "6px 0", borderBottom: `1px solid #f0ebe5`, textAlign: "center" }}>
                        <button onClick={() => delIng(i)} title="Quitar" style={{ background: "none", border: "none", color: "#c0392b", cursor: "pointer", fontSize: 16 }}>×</button>
                      </td>
                    )}
                    {Array.from({ length: CHECK_COLS }, (_, k) => (
                      <td key={`chk-${k}`} className="calcpan-printonly" style={{ padding: "6px 2px", borderBottom: `1px solid #f0ebe5`, textAlign: "center" }}>
                        <span style={{ display: "inline-block", width: 16, height: 16, border: `1.5px solid ${C.ink}`, borderRadius: 3 }} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td style={{ padding: "8px 4px", fontWeight: 700, color: C.navy, borderTop: `2px solid ${C.ink}` }}>Masa total</td>
                  <td style={{ padding: "8px 4px", textAlign: "right", fontWeight: 700, color: "#8a7a6e", borderTop: `2px solid ${C.ink}` }}>{fmt(R.SUM, 1)}%</td>
                  <td style={{ padding: "6px 4px", borderTop: `2px solid ${C.ink}` }}>
                    <NumInput inputMode="numeric" min="0" step="1" style={{ ...inp, padding: "7px 8px" }} value={Math.round(R.total)} onChange={v => setTotal(v)} />
                  </td>
                  {edit && <td style={{ borderTop: `2px solid ${C.ink}` }} />}
                  {Array.from({ length: CHECK_COLS }, (_, k) => (
                    <td key={`chk-f-${k}`} className="calcpan-printonly" style={{ borderTop: `2px solid ${C.ink}` }} />
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>

          {edit && <button style={{ ...btn, marginTop: 10 }} onClick={addIng}>+ Agregar ingrediente</button>}

          <p style={{ fontSize: 12, color: "#9a8a7e", margin: "14px 0 0" }}>
            Ejemplo: si solo tenés 5.000 g de harina, escribilo en Harina y vas a ver cuántos panes salen.
          </p>
          {drive === "flour" && R.left >= 1 && (
            <p style={{ fontSize: 13, color: C.gold, fontWeight: 600, margin: "6px 0 0" }}>
              Salen {fmt(R.units)} panes de {fmt(R.w, R.r > 0 ? 0 : 1)} g y sobran {fmt(Math.round(R.left))} g de masa.
            </p>
          )}

          {(edit || (sel.instr && sel.instr.trim())) && (
            <div className={!edit && !showInstr ? "calcpan-noprint" : undefined} style={{ marginTop: 18 }}>
              <div style={sect}>Instrucciones / método</div>
              {edit ? (<>
                <textarea
                  value={sel.instr || ""}
                  onChange={e => patchRecipe({ instr: e.target.value })}
                  rows={12}
                  placeholder="Paso a paso, reglas de bodega, empaque, etc."
                  style={{ ...inp, textAlign: "left", fontFamily: "'Poppins',sans-serif", fontWeight: 400, fontSize: 13, lineHeight: 1.5, resize: "vertical", minHeight: 160 }}
                />
                <p style={{ fontSize: 11, color: "#8a7a6e", margin: "6px 0 0", lineHeight: 1.5 }}>
                  Números automáticos: <b>{"{unidades}"}</b>, <b>{"{peso}"}</b> (a bolear), <b>{"{final}"}</b>, <b>{"{hidratacion}"}</b>, <b>{"{g:Sal}"}</b> (gramos de un ingrediente), <b>{"{kg:Harina}"}</b>, <b>{"{hielo}"}</b> / <b>{"{agua}"}</b> (mitades del líquido) y <b>{"{division}"}</b> (bloques para la divisora). Se actualizan solos al cambiar la fórmula.
                </p>
              </>) : (
                <>
                  <button className="calcpan-noprint" style={btn} onClick={() => setShowInstr(s => !s)}>
                    {showInstr ? "▲ Ocultar instrucciones" : "📋 Ver instrucciones"}
                  </button>
                  {showInstr && (
                    <div style={{ marginTop: 10, whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.55, color: C.ink, background: C.cream, border: `1px solid ${C.line}`, borderRadius: 10, padding: "12px 14px" }}>
                      {renderInstr(sel.instr, sel, R)}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div className="calcpan-noprint" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 18 }}>
            <button style={btnGold} onClick={copyRecipe}>Copiar receta</button>
            {toast && <span style={{ fontSize: 13, color: C.navy, fontWeight: 600 }}>{toast}</span>}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
