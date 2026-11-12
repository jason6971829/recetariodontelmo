"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { BasculaEnLista } from "./BasculaEnLista";
import { useViewport } from "@/hooks/useViewport";

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
  name: "Fórmula CIMPA",
  wfinal: 80, merma: 6, round: 5, units: 300,
  instr: `FORMULACIÓN DEFINITIVA ESTANDARIZADA: ajustada para {unidades} panes de {peso} g en crudo ({final} g horneados), hidratación {hidratacion}% sobre Harina Crema del Norte, con aditivos CIMPA.

PUNTO DE ADICIÓN EN LA AMASADORA
• En seco (Vel 1) con la harina: Gluten, Fécula, Dimodan, Propionato, Leche y Azúcar.
• Levadura fresca: desmenuzar sobre los secos (Vel 1).
• Glicerina y Glucosa líquida: disolver dentro del agua helada.
• Líquido total: {hielo} g hielo picado seco + {agua} g agua con glicerina y glucosa.
• Margarina Astra y Sal: DE ÚLTIMO, al iniciar Velocidad 2.

PASO A PASO
Paso 1 — Mezclado en seco (Vel 1, 2 min): harina ({kg:Harina} kg), gluten ({g:Gluten} g), fécula ({g:Fécula} g), Dimodan ({g:Dimodan} g), propionato ({g:Propionato} g), leche ({g:Leche} g), azúcar ({g:Azúcar} g) y levadura desmenuzada ({g:Levadura} g). Encender Vel 1 por 2 min para homogeneizar los polvos.
Paso 2 — Pre-hidratación y control de temperatura (Vel 1, 3–4 min): disolver {g:Glicerina} g de glicerina y {g:Glucosa} g de glucosa líquida en {agua} g de agua helada (antes de prender la amasadora). Agregar {hielo} g de hielo picado directo sobre los secos y verter el agua helada con glicerina y glucosa en hilo continuo mientras gira en Vel 1, hasta que la harina absorba toda la humedad.
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
    ["Azúcar Blanco", 6], ["Levadura Fresca", 2.8],
    ["Glicerina USP (CIMPA)", 0.6], ["Glucosa Líquida (CIMPA)", 2],
    ["Líquido Total (Hielo + Agua)", 58.5],
    ["Margarina Industrial (Astra)", 10], ["Sal Refinada", 2],
  ].map(([name, pct]) => ({ name, pct })),
};

// La Formula base ya no se ofrece (generaba confusion); queda BASE solo para las migraciones viejas.
// Panes del dia a dia: cada uno tiene su lote (unidades, peso, merma) pero usan la formula de
// "Formula CIMPA" (baseId): cambiar un porcentaje o las instrucciones cambia todos los panes.
const PRESETS = [
  { id: "pan-burger",      name: "Pan Burger",      pan: "Pan burger",      units: 300, wfinal: 80, merma: 6, round: 5, biga: true, baseId: "formula-cimpa" },
  { id: "pan-burger-mini", name: "Pan Burger Mini", pan: "Pan burger mini", units: 60,  wfinal: 50, merma: 6, round: 5, biga: true, baseId: "formula-cimpa" },
  { id: "pan-sandwich",    name: "Pan Sandwich",    pan: "Pan sandwich",    units: 32,  wfinal: 90, merma: 6, round: 5, biga: true, baseId: "formula-cimpa" },
  { id: "pan-perro",       name: "Pan Perro",       pan: "Pan perro",       units: 160, wfinal: 85, merma: 6, round: 5, biga: true, baseId: "formula-cimpa" },
];
const SEED = [...PRESETS, CIMPA];
const clone = (r) => ({ ...r, ...(r.ings ? { ings: r.ings.map(i => ({ ...i })) } : {}) });
// Une un pan con su formula base (si tiene): ings e instrucciones salen de la base
function resolveRecipe(rec, list) {
  if (!rec) return rec;
  const base = rec.baseId ? list.find(r => r.id === rec.baseId) : null;
  return base ? { ...rec, ings: base.ings || [], instr: base.instr } : { ...rec, ings: rec.ings || [] };
}

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
      // Volver al nombre "Formula CIMPA" (el pan a producir ahora va en su propio campo), una sola vez
      let cimpaName = null;
      try { cimpaName = localStorage.getItem("calcpan_cimpa_name_v2"); } catch { /* ignore */ }
      if (!cimpaName) {
        out = out.map(x => x.id === "formula-cimpa" && x.name === "Pan Burger" ? { ...x, name: CIMPA.name } : x);
        try { localStorage.setItem("calcpan_cimpa_name_v2", "1"); } catch { /* ignore */ }
      }
      // CIMPA rev3: merma 6% (85 g a bolear) y Liquido Total 58,5%, una sola vez (respeta las unidades)
      let cimpaRev3 = null;
      try { cimpaRev3 = localStorage.getItem("calcpan_cimpa_rev3"); } catch { /* ignore */ }
      if (!cimpaRev3) {
        out = out.map(x => x.id !== "formula-cimpa" ? x : {
          ...x,
          merma: CIMPA.merma,
          ings: (x.ings || []).map(i => String(i.name).startsWith("Líquido Total") ? { ...i, pct: 58.5 } : i),
        });
        try { localStorage.setItem("calcpan_cimpa_rev3", "1"); } catch { /* ignore */ }
      }
      // Quitar la Formula base (una sola vez). Si no queda ninguna formula, vuelve la CIMPA.
      let baseRemoved = null;
      try { baseRemoved = localStorage.getItem("calcpan_base_removed_v1"); } catch { /* ignore */ }
      if (!baseRemoved) {
        out = out.filter(x => x.id !== "formula-base");
        if (!out.length) out = SEED.map(clone);
        try { localStorage.setItem("calcpan_base_removed_v1", "1"); } catch { /* ignore */ }
      }
      // CIMPA rev4: azucar 8% -> 6% + Glucosa Liquida 2%; lote 300 u / 80 g / 6% (una sola vez, conserva el pan a producir)
      let cimpaRev4 = null;
      try { cimpaRev4 = localStorage.getItem("calcpan_cimpa_rev4"); } catch { /* ignore */ }
      if (!cimpaRev4) {
        out = out.map(x => x.id !== "formula-cimpa" ? x : {
          ...x,
          units: CIMPA.units, wfinal: CIMPA.wfinal, merma: CIMPA.merma, round: CIMPA.round,
          ings: CIMPA.ings.map(i => ({ ...i })),
          instr: CIMPA.instr,
        });
        try { localStorage.setItem("calcpan_cimpa_rev4", "1"); } catch { /* ignore */ }
      }
      // CIMPA rev5: Levadura Fresca 2% -> 2,8% (una sola vez, no toca lo demas)
      let cimpaRev5 = null;
      try { cimpaRev5 = localStorage.getItem("calcpan_cimpa_rev5"); } catch { /* ignore */ }
      if (!cimpaRev5) {
        out = out.map(x => x.id !== "formula-cimpa" ? x : {
          ...x,
          ings: (x.ings || []).map(i => String(i.name).startsWith("Levadura") ? { ...i, pct: 2.8 } : i),
        });
        try { localStorage.setItem("calcpan_cimpa_rev5", "1"); } catch { /* ignore */ }
      }
      // Panes del dia a dia (Burger, Burger Mini, Sandwich, Perro) sobre la Formula CIMPA, una sola vez
      let presets = null;
      try { presets = localStorage.getItem("calcpan_presets_v1"); } catch { /* ignore */ }
      if (!presets) {
        if (!out.some(x => x.id === "formula-cimpa")) out = [...out, clone(CIMPA)];
        const missing = PRESETS.filter(pr => !out.some(x => x.id === pr.id)).map(clone);
        out = [...missing, ...out];
        try { localStorage.setItem("calcpan_presets_v1", "1"); } catch { /* ignore */ }
      }
      // Guardar ya el resultado: las marcas de migracion quedan puestas y, si el componente
      // se vuelve a montar antes del autoguardado, no se pierde lo migrado.
      saveRecipes(out);
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
// Capacidad de la mojadora: una receta de Pan Burger (300 u x 85 g). Si una tanda pasa de esto, se avisa.
const MOJADORA_MAX = 25500;
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

// ── Biga (prefermento del dia anterior) ──
// Harina biga = 30% de la harina de la receta · agua = 50% de la harina biga · levadura = 1% de la harina biga.
// En la mojadora se descuenta lo que ya trae la biga (harina, liquido y levadura); el resto queda igual.
const BIGA = { flour: 0.30, water: 0.50, yeast: 0.01 };
const findIng = (rec, ...prefixes) => rec.ings.findIndex(x => prefixes.some(p => normName(x.name).startsWith(p)));
function bigaFromFlour(flour) {
  const harina = Math.round(flour * BIGA.flour);
  const agua = Math.round(harina * BIGA.water);
  const levadura = Math.round(harina * BIGA.yeast);
  return { harina, agua, levadura, total: harina + agua + levadura };
}
function recipeFlour(rec, R) {
  const iH = findIng(rec, "harina");
  return iH >= 0 ? R.grams[iH] : Math.round(R.flour);
}
function computeBiga(rec, R) {
  const b = bigaFromFlour(recipeFlour(rec, R));
  const idx = { iH: findIng(rec, "harina"), iL: findIng(rec, "liquido total", "agua"), iY: findIng(rec, "levadura") };
  const grams = R.grams.slice();
  const warn = [];
  const take = (i, g, label) => {
    if (i < 0) { warn.push(`La fórmula no tiene ${label}: no se pudo descontar.`); return; }
    grams[i] -= g;
    if (grams[i] < 0) { warn.push(`La biga lleva más ${label} de lo que tiene la fórmula.`); grams[i] = 0; }
  };
  take(idx.iH, b.harina, "harina");
  take(idx.iL, b.agua, "líquido");
  take(idx.iY, b.levadura, "levadura");
  return { ...b, grams, idx, warn };
}
const reducedRow = (biga, i) => !!biga && (i === biga.idx.iH || i === biga.idx.iL || i === biga.idx.iY);
const bigaInstrHead = (b) =>
  `CON BIGA DEL DÍA ANTERIOR: incorporar ${fmt(b.total)} g de biga madura entera al inicio, junto con los secos. ` +
  `La harina, el líquido y la levadura de esta receta ya vienen descontados (la biga trae ${fmt(b.harina)} g de harina, ${fmt(b.agua)} g de agua y ${fmt(b.levadura)} g de levadura).\n\n`;

// Plan del dia (consolidado multi-lote de biga), guardado aparte de las formulas
const PLAN_KEY = "calcpan_plan_v1";
function loadPlan() {
  try { const p = JSON.parse(localStorage.getItem(PLAN_KEY) || "null"); return Array.isArray(p) ? p : null; } catch { return null; }
}
function savePlan(p) {
  try { localStorage.setItem(PLAN_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

// ── estilos Don Telmo ─────────────────────────────────────────────
// Rediseño Don Telmo (tokens del handoff): navy #0E2240, naranja #D9731A, crema #F6F3EE, Manrope / Newsreader
const C = { navy: "#0E2240", navyD: "#091831", navy7: "#16325A", gold: "#D9731A", gold7: "#B85E10", gold1: "#FBEBDD", line: "#E7E1D7", soft: "#F0ECE5", cream: "#F6F3EE", row: "#FAF8F4", ink: "#14213D", muted: "#8A847A", muted2: "#A39D92", green: "#1F9D6B", red: "#C8423B" };
const SANS = "var(--dt-sans, Manrope, system-ui, sans-serif)", SERIF = "var(--dt-serif, Newsreader, Georgia, serif)";
const inp = { height: 44, padding: "0 12px", border: `1.5px solid ${C.line}`, borderRadius: 11, fontSize: 16, outline: "none", width: "100%", minWidth: 0, textAlign: "right", fontWeight: 800, color: C.navy, background: "#fff", fontFamily: SANS, boxSizing: "border-box" };
const inpDrive = { ...inp, borderColor: "#F1C9A3", background: "#FFF6EE" };
const lbl = { display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, color: "#6E6A63", fontWeight: 700, minWidth: 0 };
const sect = { fontFamily: SANS, fontSize: 11, fontWeight: 800, letterSpacing: ".2em", color: C.navy, textTransform: "uppercase", margin: "4px 0 10px", paddingBottom: 8, borderBottom: `1.5px solid ${C.gold}` };
const btn = { height: 36, border: `1.5px solid ${C.line}`, background: "#fff", color: C.navy, fontFamily: SANS, fontWeight: 700, fontSize: 12.5, padding: "0 13px", borderRadius: 999, cursor: "pointer", whiteSpace: "nowrap", flex: "none" };
const btnGold = { ...btn, background: C.gold, borderColor: C.gold, color: "#fff" };

// Impresion: solo se imprime la calculadora, tal cual se ve (sin botones), en paginas completas.
// Las instrucciones salen solo si estan desplegadas ("Ver instrucciones").
// Columnas de check al imprimir (una por hoja: se marca lo que se va pesando)
const CHECK_COLS = 1;
const PRINT_CSS = `
.calcpan-printonly { display: none; }
.calcpan-sheet { display: none; }
@media print {
  .calcpan-sheet { display: block !important; break-before: page; page-break-before: always; }
  .calcpan-printonly { display: table-cell !important; }
  .calcpan-panname { font-size: 18px !important; font-weight: 700 !important; }
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
  const ref = useRef(null);
  // Si el valor cambia desde afuera (ej. se eligio otro pan) y no se esta escribiendo aca, mostrar el nuevo
  useEffect(() => {
    if (typeof document !== "undefined" && ref.current !== document.activeElement) setDraft(null);
  }, [value]);
  return (
    <input
      {...props}
      ref={ref}
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

// isAdmin: solo el admin puede editar, crear, duplicar o borrar fórmulas.
// Los demás usan la calculadora (unidades, lote, biga, pesar, imprimir) pero no tocan los porcentajes.
export function CalculadoraPan({ onClose, isAdmin = false }) {
  const [recipes, setRecipes] = useState(() => (typeof window !== "undefined" ? loadRecipes() : SEED));
  const [selId, setSelId] = useState(() => recipes[0]?.id ?? SEED[0].id);
  const [editRaw, setEdit] = useState(false);
  const edit = editRaw && isAdmin; // solo el admin edita la fórmula
  const [drive, setDrive] = useState("units");
  const [driverUnits, setDriverUnits] = useState(320);
  const [driverFlour, setDriverFlour] = useState(0);
  const [toast, setToast] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const [view, setView] = useState("calc"); // "calc" | "plan" (biga consolidada)
  const [plan, setPlan] = useState(() => (typeof window !== "undefined" ? loadPlan() : null));
  const [pesar, setPesar] = useState(false); // pesaje guiado con la bascula
  const vp = useViewport();
  const mobile = vp.mobile;

  // Las formulas madre que usan otros panes (ej. Formula CIMPA) no se muestran: se editan desde cualquiera de sus panes
  const visible = recipes.filter(r => !recipes.some(x => x.baseId === r.id));
  const selRaw = visible.find(r => r.id === selId) || visible[0] || recipes[0];
  const sel = resolveRecipe(selRaw, recipes);
  const baseRec = selRaw?.baseId ? recipes.find(r => r.id === selRaw.baseId) : null;

  useEffect(() => { saveRecipes(recipes); }, [recipes]);
  useEffect(() => { if (plan) savePlan(plan); }, [plan]);

  // Al cambiar de receta: arrancar en modo unidades con las unidades guardadas
  useEffect(() => {
    if (!sel) return;
    setDrive("units");
    setDriverUnits(sel.units || 320);
    setDriverFlour(0);
    setEdit(false);
  }, [selRaw?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const R = useMemo(() => sel ? compute(sel, drive, driverUnits, driverFlour) : null, [sel, drive, driverUnits, driverFlour]);

  if (!sel || !R) return null;

  // Biga de esta receta (si esta activada): G son los gramos a pesar en la mojadora
  const biga = sel.biga ? computeBiga(sel, R) : null;
  const G = biga ? biga.grams : R.grams;
  const RI = biga ? { ...R, grams: G } : R;
  const showInstr = !!sel.instrOpen; // queda guardado por pan: si esta abierto, tambien sale en la impresion completa
  const setShowInstr = () => patchRecipe({ instrOpen: !sel.instrOpen });
  // Lista para el pesaje guiado: biga primero, el liquido se parte en agua (con glicerina y glucosa) y hielo
  const pesajeItems = () => {
    const items = [];
    if (biga) items.push({ name: "Biga madura (de la tina)", grams: biga.total });
    sel.ings.forEach((x, i) => {
      const g = G[i];
      if (!g) return;
      const n = normName(x.name);
      if (n.startsWith("liquido total")) {
        const hielo = Math.floor(g / 2);
        items.push({ name: "Agua helada", grams: g - hielo, note: "Echala sobre la glicerina y la glucosa (mismo recipiente)" });
        items.push({ name: "Hielo picado", grams: hielo, note: "En otro recipiente: ponelo vacío y tocá «Cero aquí»" });
      } else {
        items.push({ name: x.name, grams: g, note: reducedRow(biga, i) ? "Restante: ya descontada la biga" : "" });
      }
    });
    return items;
  };
  const instrText = (sel.instr && sel.instr.trim()) ? (biga ? bigaInstrHead(biga) : "") + renderInstr(sel.instr, sel, RI) : "";

  // Consolidado: cada lote = receta + unidades; la biga se calcula sobre la harina sumada
  const planRows = (plan && plan.length ? plan : visible.map(r => ({ id: "l-" + r.id, recipeId: r.id, units: r.units || 100, pan: "", active: true })))
    // un lote guardado con una formula madre oculta pasa al primer pan que la usa
    .map(l => visible.some(r => r.id === l.recipeId) ? l : { ...l, recipeId: recipes.find(x => x.baseId === l.recipeId)?.id ?? l.recipeId })
    .map(l => ({ ...l, rec: resolveRecipe(recipes.find(r => r.id === l.recipeId), recipes) }))
    .filter(l => l.rec)
    .map(l => {
      const LR = compute(l.rec, "units", l.units, 0);
      const flour = recipeFlour(l.rec, LR);
      const tandas = Math.max(1, Math.round(num(l.tandas) || 1));
      return { ...l, tandas, LR, flour, part: bigaFromFlour(flour) };
    });
  // Solo cuentan (biga y hojas impresas) los lotes marcados en "Hacer"; los demas guardan sus unidades
  const activeRows = planRows.filter(l => l.active !== false);
  const planFlour = activeRows.reduce((a, l) => a + l.flour * l.tandas, 0);
  const planTandas = activeRows.reduce((a, l) => a + l.tandas, 0);
  const planBiga = bigaFromFlour(planFlour);
  const setPlanRows = (fn) => setPlan(() => fn(planRows.map(({ id, recipeId, units, pan, active, tandas }) => ({ id, recipeId, units, pan, active: active !== false, tandas }))));
  const toggleLoteInstr = (l) => setRecipes(rs => rs.map(r => r.id === l.recipeId ? { ...r, instrOpen: !l.rec.instrOpen } : r));
  const patchLote = (id, patch) => setPlanRows(rows => rows.map(l => l.id === id ? { ...l, ...patch } : l));
  const addLote = () => setPlanRows(rows => [...rows, { id: uid(), recipeId: sel.id, units: sel.units || 100, pan: "", active: true }]);
  const delLote = (id) => setPlanRows(rows => rows.filter(l => l.id !== id));

  // ── mutadores de receta ─────────────────────────────────────────
  const patchRecipe = (patch) => setRecipes(rs => rs.map(r => r.id === selId ? { ...r, ...patch } : r));
  const formulaId = baseRec ? baseRec.id : sel.id;
  const patchFormula = (fn) => setRecipes(rs => rs.map(r => r.id === formulaId ? { ...r, ...fn(r) } : r));
  const patchIng = (i, patch) => patchFormula(r => ({ ings: (r.ings || []).map((x, j) => j === i ? { ...x, ...patch } : x) }));
  const addIng = () => patchFormula(r => ({ ings: [...(r.ings || []), { name: "Nuevo", pct: 0 }] }));
  const delIng = (i) => patchFormula(r => ({ ings: (r.ings || []).filter((_, j) => j !== i) }));

  const setUnits = (v) => { setDrive("units"); setDriverUnits(v); patchRecipe({ units: Math.round(num(v)) }); };
  const setGram = (i, v) => { const pct = num(sel.ings[i].pct) || 100; setDrive("flour"); setDriverFlour(num(v) * 100 / pct); };
  const setTotal = (v) => { setDrive("flour"); setDriverFlour(num(v) * 100 / R.SUM); };

  const newRecipe = () => {
    const r = { id: uid(), name: "Nueva receta", wfinal: 80, merma: 15, round: 5, units: 100, instr: "", ings: [{ name: "Harina", pct: 100 }] };
    setRecipes(rs => [...rs, r]); setSelId(r.id); setEdit(true);
  };
  const dupRecipe = () => {
    const r = { ...clone(selRaw), id: uid(), name: sel.name + " (copia)" };
    setRecipes(rs => [...rs, r]); setSelId(r.id);
  };
  const printRecipe = () => { setConfirmDel(false); setTimeout(() => window.print(), 50); };

  const th = { fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#9a8a7e", padding: "6px 4px", borderBottom: `1px solid ${C.line}` };
  const td = { padding: "6px 4px", borderBottom: "1px solid #f0ebe5" };
  const box = <span style={{ display: "inline-block", width: 16, height: 16, border: `1.5px solid ${C.ink}`, borderRadius: 3 }} />;
  const renderSheet = (l, label, key) => {
    const rec = l.rec, LR = l.LR, b = computeBiga(rec, LR);
    const wTxt = fmt(LR.w, LR.r > 0 ? 0 : 1);
    const instr = rec.instrOpen && rec.instr && rec.instr.trim()
      ? bigaInstrHead(b) + renderInstr(rec.instr, rec, { ...LR, grams: b.grams }) : "";
    return (
      <div key={key} className="calcpan-sheet" style={{ fontFamily: "'Poppins',sans-serif", color: C.ink }}>
        <div style={{ background: `linear-gradient(135deg, ${C.navy}, ${C.navyD})`, color: "#fff", borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 10 }}>
          <div>
            <div style={{ color: C.gold, fontSize: 10, fontWeight: 700, letterSpacing: 3, fontFamily: "Georgia,serif" }}>DON TELMO® · 1958 · COMPANY</div>
            <div style={{ fontFamily: "Georgia,serif", fontSize: 22, fontWeight: 700, marginTop: 2 }}>{(l.pan && l.pan.trim()) || rec.name}</div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, opacity: 0.9, textAlign: "right" }}>{label}</div>
        </div>
        <div style={{ fontSize: 12, color: "#8a7a6e", margin: "10px 0" }}>
          {fmt(num(rec.wfinal))} g de peso final + {fmt(num(rec.merma), 1)}% merma → <b style={{ color: C.gold }}>{wTxt} g a bolear</b>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 12 }}>
          {kpi("Unidades", fmt(LR.units))}
          {kpi("Peso a bolear", wTxt + " g")}
          {kpi("Masa total", fmt(Math.round(LR.total)) + " g")}
          {kpi(`Boleadora (${DIVISORA})`, fmt(Math.round(DIVISORA * LR.w)) + " g")}
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontVariantNumeric: "tabular-nums" }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: "left" }}>Ingrediente (mojadora)</th>
              <th style={{ ...th, textAlign: "right", width: 50 }}>%</th>
              <th style={{ ...th, textAlign: "right", width: 90 }}>Gramos</th>
              {Array.from({ length: CHECK_COLS }, (_, k) => <th key={k} style={{ ...th, textAlign: "center", width: 26, padding: "6px 2px" }}>✓</th>)}
            </tr>
          </thead>
          <tbody>
            <tr style={{ background: "#F4F7FB" }}>
              <td style={{ ...td, fontWeight: 700, color: C.navy }}>🌙 Biga madura (de la tina)</td>
              <td style={{ ...td, textAlign: "right", color: "#8a7a6e" }}>—</td>
              <td style={{ ...td, textAlign: "right", fontWeight: 800, color: C.navy }}>{fmt(b.total)}</td>
              {Array.from({ length: CHECK_COLS }, (_, k) => <td key={k} style={{ ...td, textAlign: "center", padding: "6px 2px" }}>{box}</td>)}
            </tr>
            {rec.ings.map((x, i) => (
              <tr key={i}>
                <td style={{ ...td, fontWeight: 600 }}>
                  {x.name}
                  {reducedRow(b, i) && <div style={{ fontSize: 10, fontWeight: 600, color: C.navy }}>restante (ya descontada la biga)</div>}
                </td>
                <td style={{ ...td, textAlign: "right", color: "#8a7a6e" }}>{fmt(num(x.pct), num(x.pct) % 1 ? 1 : 0)}</td>
                <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{fmt(b.grams[i])}</td>
                {Array.from({ length: CHECK_COLS }, (_, k) => <td key={k} style={{ ...td, textAlign: "center", padding: "6px 2px" }}>{box}</td>)}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ padding: "8px 4px", fontWeight: 700, color: C.navy, borderTop: `2px solid ${C.ink}` }}>Masa total</td>
              <td style={{ padding: "8px 4px", textAlign: "right", fontWeight: 700, color: "#8a7a6e", borderTop: `2px solid ${C.ink}` }}>{fmt(LR.SUM, 1)}%</td>
              <td style={{ padding: "8px 4px", textAlign: "right", fontWeight: 800, borderTop: `2px solid ${C.ink}` }}>{fmt(Math.round(LR.total))}</td>
              <td colSpan={CHECK_COLS} style={{ borderTop: `2px solid ${C.ink}` }} />
            </tr>
          </tfoot>
        </table>
        {b.warn.map(w => <div key={w} style={{ fontSize: 12, color: "#c0392b", fontWeight: 600, marginTop: 4 }}>⚠️ {w}</div>)}
        {instr && (
          <div style={{ marginTop: 12 }}>
            <div style={sect}>Instrucciones / método</div>
            <div style={{ whiteSpace: "pre-wrap", fontSize: 12, lineHeight: 1.5, background: C.cream, border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 12px" }}>{instr}</div>
          </div>
        )}
      </div>
    );
  };
  const delRecipe = () => {
    setConfirmDel(false);
    setRecipes(rs => {
      const gone = rs.find(r => r.id === selId);
      const next = rs.filter(r => r.id !== selId).map(r => r.baseId === selId
        ? { ...r, baseId: undefined, ings: (gone?.ings || []).map(i => ({ ...i })), instr: gone?.instr || "" }
        : r);
      if (!next.length) { const s = SEED.map(clone); setSelId(s[0].id); return s; }
      setSelId(next[0].id); return next;
    });
  };

  const copyRecipe = async () => {
    const txt = `${sel.name}${sel.pan && sel.pan.trim() ? " — " + sel.pan.trim() : ""}\n${fmt(R.units)} unidades × ${fmt(R.w, R.r > 0 ? 0 : 1)} g\nMasa total: ${fmt(Math.round(R.total))} g\n\n` +
      (biga ? `— Biga (preparar el día anterior) —\nHarina: ${fmt(biga.harina)} g\nAgua: ${fmt(biga.agua)} g\nLevadura fresca: ${fmt(biga.levadura)} g\nBiga madura: ${fmt(biga.total)} g\n\n— Mojadora —\nBiga madura: ${fmt(biga.total)} g\n` : "") +
      sel.ings.map((x, i) => `${x.name}: ${fmt(G[i])} g${reducedRow(biga, i) ? " (descontada la biga)" : ` (${fmt(num(x.pct), num(x.pct) % 1 ? 1 : 0)}%)`}`).join("\n") +
      (instrText ? `\n\n— Instrucciones —\n${instrText}` : "");
    try { await navigator.clipboard.writeText(txt); setToast("Receta copiada"); }
    catch { setToast("No se pudo copiar"); }
    setTimeout(() => setToast(""), 2500);
  };

  const kpi = (label, val) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, background: "#fff", borderRadius: 10, padding: "8px 10px", minWidth: 0 }}>
      <span style={{ fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: "#6E6A63", fontWeight: 700 }}>{label}</span>
      <strong style={{ fontFamily: SANS, fontSize: 17, fontWeight: 800, color: C.navy, fontVariantNumeric: "tabular-nums" }}>{val}</strong>
    </div>
  );

  return createPortal(
    <div className="calcpan-print-root dt-scope" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(9,24,49,.55)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", animation: "dtFade .25s both", display: "flex", alignItems: mobile ? "flex-end" : "center", justifyContent: "center", padding: mobile ? 0 : 24 }}>
      <style>{PRINT_CSS}</style>
      <div className="calcpan-card" onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: mobile ? "24px 24px 0 0" : 24, width: "100%", maxWidth: 780, height: mobile ? "calc(var(--app-height, 100vh) * 0.95)" : undefined, maxHeight: mobile ? "calc(var(--app-height, 100vh) * 0.95)" : "min(calc(var(--app-height, 100vh) * 0.92), 1000px)", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 40px 80px -20px rgba(0,0,0,.5)", fontFamily: SANS, color: C.ink, animation: mobile ? "dtSheet .4s cubic-bezier(.2,.8,.2,1) both" : "dtPop .35s cubic-bezier(.2,.8,.2,1) both" }}>
        {/* Header */}
        <div style={{ background: `linear-gradient(160deg, ${C.navy7}, ${C.navy})`, color: "#fff", padding: `${mobile ? 14 : 20}px ${mobile ? 18 : 28}px`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".22em", color: "#F0A35E" }}>{view === "plan" ? "BIGA DEL DÍA ANTERIOR" : "PORCENTAJE PANADERO · HARINA = 100%"}</span>
            <span style={{ fontFamily: SERIF, fontSize: mobile ? 20 : 24, fontWeight: 600 }}>{view === "plan" ? "Biga consolidada" : "Calculadora de masas"}</span>
          </div>
          <button className="calcpan-noprint" onClick={onClose} aria-label="Cerrar" style={{ width: 42, height: 42, borderRadius: 12, border: 0, background: "rgba(255,255,255,.1)", color: "#fff", cursor: "pointer", flex: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        {/* Barra de la vista Biga consolidada */}
        {view === "plan" && (
          <div className="calcpan-noprint" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", padding: `12px ${mobile ? 18 : 28}px`, borderBottom: `1px solid ${C.soft}`, flexShrink: 0 }}>
            <button style={{ ...btn, height: 40, borderRadius: 12 }} onClick={() => setView("calc")}>← Volver a la fórmula</button>
            <button style={{ ...btnGold, height: 40, borderRadius: 12 }} onClick={printRecipe}>Imprimir</button>
          </div>
        )}
        {confirmDel && isAdmin && (
          <div className="calcpan-noprint" role="alertdialog" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: `12px ${mobile ? 18 : 28}px`, background: "#FDECEA", borderBottom: "1.5px solid #e8c5bf", flexShrink: 0 }}>
            <span style={{ flex: 1, minWidth: 180, fontSize: 13, fontWeight: 600, color: "#8e2b20" }}>
              ⚠️ ¿Seguro que querés borrar «{sel?.name}»? No se puede deshacer.
            </span>
            <button style={btn} onClick={() => setConfirmDel(false)}>Cancelar</button>
            <button style={{ ...btn, background: "#c0392b", borderColor: "#c0392b", color: "#fff" }} onClick={delRecipe}>Sí, borrar</button>
          </div>
        )}

        {/* Body */}
        <div className="calcpan-body" style={{ overflowY: "auto", flex: 1, padding: `${mobile ? 16 : 22}px ${mobile ? 18 : 28}px calc(24px + env(safe-area-inset-bottom))`, background: "#fff" }}>
          {view === "plan" ? (
            <div>
              <div style={sect}>Lotes del día siguiente</div>
              <p style={{ fontSize: 12, color: "#8a7a6e", margin: "0 0 10px" }}>
                Marcá en <b>Hacer</b> las recetas que vas a producir y poné las unidades. Solo las marcadas suman a la biga y se imprimen; las demás guardan sus unidades para otro día. <b>Tandas</b> = cuántas veces se hace esa receta en la mojadora (ej. 3 de Pan Burger). <b>📋</b> = imprimir también sus instrucciones.
              </p>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontVariantNumeric: "tabular-nums" }}>
                  <thead>
                    <tr>
                      <th className="calcpan-noprint" style={{ textAlign: "center", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#9a8a7e", padding: "6px 4px", borderBottom: `1px solid ${C.line}`, width: 44 }}>Hacer</th>
                      {["Receta", "Unidades", "Tandas", "Harina", "Biga madura"].map((h, k) => (
                        <th key={h} style={{ textAlign: k < 1 ? "left" : "right", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#9a8a7e", padding: "6px 4px", borderBottom: `1px solid ${C.line}` }}>{h}</th>
                      ))}
                      <th className="calcpan-noprint" title="Imprimir instrucciones" style={{ textAlign: "center", fontSize: 11, color: "#9a8a7e", padding: "6px 2px", borderBottom: `1px solid ${C.line}`, width: 34 }}>📋</th>
                      <th className="calcpan-noprint" style={{ width: 30, borderBottom: `1px solid ${C.line}` }} />
                    </tr>
                  </thead>
                  <tbody>
                    {planRows.map(l => (
                      <tr key={l.id} className={l.active === false ? "calcpan-noprint" : undefined} style={{ opacity: l.active === false ? 0.45 : 1 }}>
                        <td className="calcpan-noprint" style={{ padding: "6px 4px", borderBottom: "1px solid #f0ebe5", textAlign: "center" }}>
                          <input type="checkbox" aria-label="Hacer esta receta" checked={l.active !== false} onChange={e => patchLote(l.id, { active: e.target.checked })} style={{ width: 20, height: 20, accentColor: C.gold, cursor: "pointer" }} />
                        </td>
                        <td style={{ padding: "6px 4px", borderBottom: "1px solid #f0ebe5", minWidth: 130 }}>
                          <select value={l.recipeId} onChange={e => patchLote(l.id, { recipeId: e.target.value })} style={{ ...inp, textAlign: "left", padding: "6px 8px", fontSize: 13 }}>
                            {visible.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: "6px 4px", borderBottom: "1px solid #f0ebe5", width: 90 }}>
                          <NumInput inputMode="numeric" min="0" step="1" style={{ ...inp, padding: "6px 8px", fontSize: 13 }} value={l.units} onChange={v => patchLote(l.id, { units: Math.round(num(v)) })} />
                        </td>
                        <td style={{ padding: "6px 4px", borderBottom: "1px solid #f0ebe5", width: 70 }} title="Cuántas veces se hace esta receta en la mojadora">
                          <NumInput inputMode="numeric" min="1" step="1" style={{ ...inp, padding: "6px 8px", fontSize: 13 }} value={l.tandas} onChange={v => patchLote(l.id, { tandas: v === "" ? "" : Math.max(1, Math.round(num(v))) })} />
                        </td>
                        <td style={{ padding: "6px 4px", borderBottom: "1px solid #f0ebe5", textAlign: "right", fontWeight: 600, color: C.ink, whiteSpace: "nowrap" }}>{fmt(l.flour * l.tandas)} g</td>
                        <td style={{ padding: "6px 4px", borderBottom: "1px solid #f0ebe5", textAlign: "right", fontWeight: 700, color: C.gold, whiteSpace: "nowrap" }}>{l.active === false ? "—" : (
                          <>{fmt(l.part.total * l.tandas)} g{l.tandas > 1 && <div style={{ fontSize: 10, fontWeight: 600, color: "#8a7a6e" }}>{fmt(l.part.total)} g × {l.tandas}</div>}</>
                        )}</td>
                        <td className="calcpan-noprint" style={{ padding: "6px 2px", borderBottom: "1px solid #f0ebe5", textAlign: "center" }}>
                          <button onClick={() => toggleLoteInstr(l)} title={l.rec.instrOpen ? "Las instrucciones se imprimen" : "Las instrucciones no se imprimen"}
                            style={{ border: `1.5px solid ${l.rec.instrOpen ? C.gold : C.line}`, background: l.rec.instrOpen ? "#FBEFE3" : "#fff", borderRadius: 6, cursor: "pointer", padding: "3px 5px", fontSize: 13, opacity: l.rec.instrOpen ? 1 : 0.5 }}>📋</button>
                        </td>
                        <td className="calcpan-noprint" style={{ padding: "6px 0", borderBottom: "1px solid #f0ebe5", textAlign: "center" }}>
                          {planRows.length > 1 && <button onClick={() => delLote(l.id)} title="Quitar lote" style={{ background: "none", border: "none", color: "#c0392b", cursor: "pointer", fontSize: 16 }}>×</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td className="calcpan-noprint" style={{ borderTop: `2px solid ${C.ink}` }} />
                      <td colSpan={3} style={{ padding: "8px 4px", fontWeight: 700, color: C.navy, borderTop: `2px solid ${C.ink}` }}>Harina total ({activeRows.length} {activeRows.length === 1 ? "receta" : "recetas"}, {planTandas} {planTandas === 1 ? "tanda" : "tandas"})</td>
                      <td style={{ padding: "8px 4px", textAlign: "right", fontWeight: 800, color: C.navy, borderTop: `2px solid ${C.ink}`, whiteSpace: "nowrap" }}>{fmt(planFlour)} g</td>
                      <td style={{ borderTop: `2px solid ${C.ink}` }} />
                      <td className="calcpan-noprint" style={{ borderTop: `2px solid ${C.ink}` }} />
                      <td className="calcpan-noprint" style={{ borderTop: `2px solid ${C.ink}` }} />
                    </tr>
                  </tfoot>
                </table>
              </div>
              {activeRows.filter(l => l.LR.total > MOJADORA_MAX).map(l => (
                <div key={`max-${l.id}`} className="calcpan-noprint" style={{ fontSize: 12, fontWeight: 600, color: "#8e2b20", background: "#FDECEA", border: "1.5px solid #e8c5bf", borderRadius: 8, padding: "7px 10px", marginTop: 8, lineHeight: 1.45 }}>
                  ⚠️ {l.rec.name}: cada tanda pesa {fmt(Math.round(l.LR.total))} g y la mojadora aguanta {fmt(MOJADORA_MAX)} g. Bajá a {fmt(Math.floor(MOJADORA_MAX / l.LR.w))} unidades o menos por tanda y subí las tandas.
                </div>
              ))}
              <button className="calcpan-noprint" style={{ ...btn, marginTop: 10 }} onClick={addLote}>+ Agregar lote</button>

              <div style={{ ...sect, marginTop: 22 }}>Pesaje único de biga · preparar hoy en la tarde</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontVariantNumeric: "tabular-nums" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#9a8a7e", padding: "6px 4px", borderBottom: `1px solid ${C.line}` }}>Ingrediente</th>
                    <th style={{ textAlign: "right", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "#9a8a7e", padding: "6px 4px", borderBottom: `1px solid ${C.line}` }}>Gramos</th>
                    {Array.from({ length: CHECK_COLS }, (_, k) => (
                      <th key={`bc-h-${k}`} className="calcpan-printonly" style={{ textAlign: "center", fontSize: 11, color: "#9a8a7e", padding: "6px 2px", borderBottom: `1px solid ${C.line}`, width: 28 }}>✓</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[["Harina (30% de la harina total)", planBiga.harina], ["Agua (50% de la harina de biga)", planBiga.agua], ["Levadura fresca (1% de la harina de biga)", planBiga.levadura]].map(([n, g]) => (
                    <tr key={n}>
                      <td style={{ padding: "8px 4px", borderBottom: "1px solid #f0ebe5", fontWeight: 600, color: C.ink }}>{n}</td>
                      <td style={{ padding: "8px 4px", borderBottom: "1px solid #f0ebe5", textAlign: "right", fontWeight: 800, fontSize: 18, color: C.navy, whiteSpace: "nowrap" }}>{fmt(g)} g</td>
                      {Array.from({ length: CHECK_COLS }, (_, k) => (
                        <td key={`bc-${k}`} className="calcpan-printonly" style={{ padding: "6px 2px", borderBottom: "1px solid #f0ebe5", textAlign: "center" }}>
                          <span style={{ display: "inline-block", width: 16, height: 16, border: `1.5px solid ${C.ink}`, borderRadius: 3 }} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, border: `2px solid ${C.gold}`, background: "#FFF7EF", borderRadius: 10, padding: "10px 14px", marginTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: C.navy }}>Biga madura total (una tina)</div>
                <strong style={{ fontSize: 30, fontWeight: 800, color: C.gold, lineHeight: 1 }}>{fmt(planBiga.total)} g</strong>
              </div>
              <p style={{ fontSize: 12, color: "#8a7a6e", margin: "10px 0 0", lineHeight: 1.5 }}>
                Al día siguiente, cada lote toma de la tina la cantidad de la columna <b>Biga madura</b>. Cada hoja de receta impresa ya trae la mojadora con la biga descontada.
              </p>

              <div className="calcpan-noprint" style={{ marginTop: 16, padding: "12px 14px", border: `1.5px dashed ${C.line}`, borderRadius: 10, background: C.cream }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>🖨️ Imprimir producción completa</div>
                <div style={{ fontSize: 12, color: "#8a7a6e", margin: "4px 0 10px" }}>
                  Sale esta hoja con el total de biga + {planTandas} {planTandas === 1 ? "hoja de mojadora" : "hojas de mojadora"} (una por tanda, solo de las recetas marcadas en Hacer, con la biga descontada y cuadritos para marcar), en tamaño carta.
                  {" "}Instrucciones: {activeRows.filter(l => l.rec.instrOpen).map(l => (l.pan && l.pan.trim()) || l.rec.name).join(", ") || "ninguna (tocá 📋 en la receta que las necesite)"}.
                </div>
                <button style={{ ...btnGold, opacity: activeRows.length ? 1 : 0.5 }} disabled={!activeRows.length} onClick={printRecipe}>🖨️ Imprimir biga + {planTandas} {planTandas === 1 ? "hoja" : "hojas"}</button>
              </div>

              {activeRows.flatMap((l, k) => Array.from({ length: l.tandas }, (_, t) =>
                renderSheet(l, `Receta ${k + 1} de ${activeRows.length}${l.tandas > 1 ? ` · Tanda ${t + 1} de ${l.tandas}` : ""}`, `sheet-${l.id}-${t}`)))}
            </div>
          ) : (<>
          <div className="calcpan-noprint" style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <select value={selRaw.id} onChange={e => { setSelId(e.target.value); setConfirmDel(false); }} aria-label="Fórmula"
              style={{ flex: 1, minWidth: 0, height: 44, borderRadius: 12, border: `1.5px solid ${C.line}`, padding: "0 12px", fontSize: 16, fontWeight: 700, color: C.navy, background: "#fff", fontFamily: SANS }}>
              {visible.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <button onClick={() => { setConfirmDel(false); setEdit(false); setPesar(v => !v); }}
              style={{ flex: "none", height: 44, padding: "0 16px", borderRadius: 12, border: 0, background: pesar ? C.green : C.gold, color: "#fff", fontWeight: 800, fontSize: 13.5, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap", transition: "background .2s", fontFamily: SANS }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v17M7 20h10M5 7h14M5 7l-3 6a3 3 0 0 0 6 0zM19 7l-3 6a3 3 0 0 0 6 0z" /></svg>
              {pesar ? "Dejar de pesar" : "Pesar"}
            </button>
          </div>
          <div className="calcpan-noprint dt-noscroll" style={{ display: "flex", gap: 6, overflowX: "auto", margin: `0 -${mobile ? 18 : 28}px 16px`, padding: `0 ${mobile ? 18 : 28}px 2px` }}>
            {isAdmin && <button style={edit ? { ...btn, background: C.navy, borderColor: C.navy, color: "#fff" } : btn} onClick={() => setEdit(e => !e)}>{edit ? "Listo ✓" : "Editar fórmula"}</button>}
            <button style={btn} onClick={() => { setConfirmDel(false); setPesar(false); setView("plan"); }}>Biga consolidada</button>
            <button style={btn} onClick={printRecipe}>Imprimir</button>
            {isAdmin && <>
              <button style={btn} onClick={newRecipe}>+ Nueva</button>
              <button style={btn} onClick={dupRecipe}>Duplicar</button>
              <button style={{ ...btn, color: C.red }} onClick={() => setConfirmDel(true)}>Borrar</button>
            </>}
          </div>
          {edit && (
            <div style={{ gridColumn: "1/-1" }}>
              <label style={{ ...lbl, marginBottom: 12 }}>Nombre de la receta
                <input style={{ ...inp, textAlign: "left" }} value={sel.name} onChange={e => patchRecipe({ name: e.target.value })} />
              </label>
              {baseRec && (
                <p style={{ fontSize: 12, color: C.navy, background: "#F4F7FB", border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 10px", margin: "0 0 12px", lineHeight: 1.5 }}>
                  Fórmula compartida con <b>{recipes.filter(x => x.baseId === baseRec.id && x.id !== selRaw.id).map(x => x.name).join(", ") || "otros panes"}</b>: si cambiás porcentajes, ingredientes o instrucciones, cambian en todos. Las unidades, el peso y la merma son solo de este pan.
                </p>
              )}
            </div>
          )}

          <div style={{ ...sect, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <span>Lote</span>
            <input
              className="calcpan-panname"
              aria-label="Pan a producir"
              placeholder="Pan a producir (ej. Pan burger)"
              value={sel.pan || ""}
              onChange={e => patchRecipe({ pan: e.target.value })}
              style={{ ...inp, height: 36, borderRadius: 10, textAlign: "left", width: "min(60%, 260px)", flex: "none", fontSize: 16, fontWeight: 700, letterSpacing: 0, textTransform: "none" }}
            />
          </div>
          <div key={selRaw.id} style={{ display: "grid", gridTemplateColumns: vp.w < 560 ? "repeat(2, minmax(0,1fr))" : "repeat(4, minmax(0,1fr))", gap: 8, marginBottom: 10 }}>
            <label style={lbl}>Unidades
              <NumInput inputMode="numeric" min="0" step="1" style={drive === "units" ? inpDrive : inp} value={R.units} onChange={v => setUnits(v)} />
            </label>
            <label style={lbl}>Peso final por pan (g)
              <NumInput inputMode="decimal" min="0" step="1" style={inp} value={sel.wfinal} onChange={v => patchRecipe({ wfinal: v })} />
            </label>
            <label style={lbl}>Merma (%)
              <NumInput inputMode="decimal" min="0" step="0.5" style={inp} value={sel.merma} onChange={v => patchRecipe({ merma: v })} />
            </label>
            <label style={lbl}>Redondear a (g)
              <NumInput inputMode="numeric" min="0" step="1" style={inp} value={sel.round} onChange={v => patchRecipe({ round: v })} />
            </label>
          </div>
          <div style={{ fontSize: 12.5, color: C.muted, background: C.row, borderRadius: 10, padding: "8px 12px", marginBottom: 14 }}>
            {fmt(num(sel.wfinal))} g + {fmt(num(sel.merma), 1)}% merma = {fmt(R.raw, 1)} g → <b style={{ color: C.gold }}>{fmt(R.w, R.r > 0 ? 0 : 1)} g a bolear</b>
          </div>
          {R.total > MOJADORA_MAX && (() => {
            const t = Math.ceil(R.total / MOJADORA_MAX);
            return (
              <div className="calcpan-noprint" style={{ fontSize: 13, fontWeight: 600, color: "#8e2b20", background: "#FDECEA", border: "1.5px solid #e8c5bf", borderRadius: 8, padding: "8px 10px", marginBottom: 10, lineHeight: 1.45 }}>
                ⚠️ {fmt(Math.round(R.total))} g no entran en la mojadora (máx. {fmt(MOJADORA_MAX)} g). Hacelo en {t} tandas de unas {fmt(Math.ceil(R.units / t))} unidades.
              </div>
            );
          })()}
          {/* A bolear · Boleadora (un testo por hueco) · Masa total */}
          {(() => {
            const pad = mobile ? "10px" : "14px 16px", big = mobile ? 19 : 28;
            const card = (bg, fg, eyebrow, eyeColor, val, sub, subColor) => (
              <div style={{ padding: pad, borderRadius: 14, background: bg, color: fg, display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".12em", color: eyeColor }}>{eyebrow}</span>
                <span style={{ fontSize: big, fontWeight: 800, lineHeight: 1, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{val}<span style={{ fontSize: 12, opacity: .65 }}> g</span></span>
                {sub && <span style={{ fontSize: 10.5, color: subColor }}>{sub}</span>}
              </div>
            );
            return (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 8, marginBottom: 16 }}>
                {card(C.navy, "#fff", "A BOLEAR", "#F0A35E", fmt(R.w, R.r > 0 ? 0 : 1), null)}
                {card(C.gold1, C.gold7, "BOLEADORA", C.gold7, fmt(Math.round(DIVISORA * R.w)), `${DIVISORA} × ${fmt(R.w, R.r > 0 ? 0 : 1)} g`, C.gold7)}
                {card(C.cream, C.navy, "MASA TOTAL", "#6E6A63", fmt(Math.round(R.total)), `${fmt(R.units)} unidades`, "#6E6A63")}
              </div>
            );
          })()}

          {/* Biga del dia anterior */}
          <button type="button" role="switch" aria-checked={!!sel.biga} className={biga ? undefined : "calcpan-noprint"} onClick={() => patchRecipe({ biga: !sel.biga })}
            style={{ display: "flex", alignItems: "center", gap: 12, border: 0, background: "transparent", padding: 0, cursor: "pointer", textAlign: "left", minHeight: 40, marginBottom: biga ? 10 : 16, fontFamily: SANS }}>
            <span style={{ width: 44, height: 26, borderRadius: 999, background: sel.biga ? C.gold : "#D6D0C6", position: "relative", transition: "background .2s", flex: "none" }}>
              <span style={{ position: "absolute", top: 3, left: sel.biga ? 21 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 2px 4px rgba(0,0,0,.2)", transition: "left .25s cubic-bezier(.2,.8,.2,1)" }} />
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>Con biga del día anterior</span>
          </button>
          {biga && (
            <div style={{ border: "1.5px solid #D5DEEA", borderRadius: 16, padding: 12, marginBottom: 16, background: "#F4F7FB", animation: "dtUp .35s both" }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase", color: C.navy, marginBottom: 10 }}>Biga · preparar hoy en la tarde</div>
              <div style={{ display: "grid", gridTemplateColumns: vp.w < 560 ? "repeat(2, minmax(0,1fr))" : "repeat(4, minmax(0,1fr))", gap: 6 }}>
                {kpi("Harina (30%)", fmt(biga.harina) + " g")}
                {kpi("Agua (50%)", fmt(biga.agua) + " g")}
                {kpi("Levadura (1%)", fmt(biga.levadura) + " g")}
                {kpi("Biga madura", fmt(biga.total) + " g")}
              </div>
              <div style={{ fontSize: 12, color: "#55606F", marginTop: 10, lineHeight: 1.45 }}>
                Mañana se agrega la biga madura al inicio; las cantidades de abajo ya descuentan harina, líquido y levadura.
              </div>
              {biga.warn.map(w => <div key={w} style={{ fontSize: 12, color: "#c0392b", fontWeight: 600, marginTop: 4 }}>⚠️ {w}</div>)}
            </div>
          )}


          {pesar ? (
            <div className="calcpan-noprint">
              <BasculaEnLista title={`${(selRaw.pan && selRaw.pan.trim()) || sel.name} · ${fmt(R.units)} u`}
                rows={pesajeItems().map(it => ({ code: "", name: it.name, note: it.note || "", main: `${fmt(Math.max(5, Math.round(it.grams / 5) * 5))} g`, sub: "", grams: it.grams, manual: "" }))} />
            </div>
          ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontVariantNumeric: "tabular-nums" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".14em", color: C.muted2, padding: "0 4px 6px", borderBottom: `1.5px solid ${C.navy}` }}>Fórmula</th>
                  <th style={{ textAlign: "right", fontSize: 10.5, fontWeight: 800, letterSpacing: ".14em", color: C.muted2, padding: "0 4px 6px", borderBottom: `1.5px solid ${C.navy}`, width: 56 }}>%</th>
                  <th style={{ textAlign: "right", fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".14em", color: C.muted2, padding: "0 4px 6px", borderBottom: `1.5px solid ${C.navy}`, width: mobile ? 96 : 112 }}>Gramos</th>
                  {edit && <th style={{ width: 30, borderBottom: `1px solid ${C.line}` }} />}
                  {Array.from({ length: CHECK_COLS }, (_, k) => (
                    <th key={`chk-h-${k}`} className="calcpan-printonly" style={{ textAlign: "center", fontSize: 11, color: "#9a8a7e", padding: "6px 2px", borderBottom: `1px solid ${C.line}`, width: 28 }}>✓</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {biga && (
                  <tr style={{ background: "#F4F7FB" }}>
                    <td style={{ padding: "6px 4px", borderBottom: `1px solid ${C.soft}`, fontWeight: 700, color: C.navy, fontSize: mobile ? 13.5 : 14.5 }}>Biga madura (del día anterior)</td>
                    <td style={{ padding: "6px 4px", borderBottom: `1px solid #f0ebe5`, textAlign: "right", color: "#8a7a6e" }}>—</td>
                    <td style={{ padding: "6px 4px", borderBottom: `1px solid #f0ebe5` }}>
                      <div style={{ textAlign: "right", fontWeight: 800, color: C.navy, fontSize: mobile ? 13.5 : 14.5, padding: "0 10px", fontVariantNumeric: "tabular-nums" }}>{fmt(biga.total)}</div>
                    </td>
                    {edit && <td style={{ borderBottom: `1px solid #f0ebe5` }} />}
                    {Array.from({ length: CHECK_COLS }, (_, k) => (
                      <td key={`chk-b-${k}`} className="calcpan-printonly" style={{ padding: "6px 2px", borderBottom: `1px solid #f0ebe5`, textAlign: "center" }}>
                        <span style={{ display: "inline-block", width: 16, height: 16, border: `1.5px solid ${C.ink}`, borderRadius: 3 }} />
                      </td>
                    ))}
                  </tr>
                )}
                {sel.ings.map((x, i) => (
                  <tr key={i}>
                    <td style={{ padding: "6px 4px", borderBottom: `1px solid ${C.soft}`, fontWeight: 600, color: C.ink, fontSize: mobile ? 13.5 : 14.5, lineHeight: 1.25, height: mobile ? 38 : 46 }}>
                      {edit
                        ? <input style={{ ...inp, textAlign: "left", padding: "6px 8px" }} value={x.name} onChange={e => patchIng(i, { name: e.target.value })} />
                        : x.name}
                      {reducedRow(biga, i) && <div style={{ fontSize: 11, fontWeight: 600, color: C.gold }}>Restante · ya descontada la biga</div>}
                    </td>
                    <td style={{ padding: "6px 4px", borderBottom: `1px solid ${C.soft}`, textAlign: "right", fontSize: 13, color: C.muted }}>
                      {edit
                        ? <NumInput step="0.1" min="0" style={{ ...inp, padding: "6px 8px" }} value={x.pct} onChange={v => patchIng(i, { pct: v })} />
                        : fmt(num(x.pct), num(x.pct) % 1 ? 1 : 0)}
                    </td>
                    <td style={{ padding: "6px 4px", borderBottom: `1px solid #f0ebe5` }}>
                      {reducedRow(biga, i)
                        ? <div style={{ textAlign: "right", fontWeight: 800, color: C.navy, fontSize: mobile ? 13.5 : 14.5, padding: "0 10px", fontVariantNumeric: "tabular-nums" }}>{fmt(G[i])}</div>
                        : <NumInput inputMode="numeric" min="0" step="1" style={{ ...inp, height: 36, borderRadius: 10, borderColor: "transparent", background: C.row, fontSize: mobile ? 14 : 15, padding: "0 10px" }} value={R.grams[i]} onChange={v => setGram(i, v)} />}
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
                  <td style={{ padding: "8px 4px", fontFamily: SERIF, fontSize: 18, fontWeight: 600, color: C.navy, borderTop: `1.5px solid ${C.navy}` }}>Masa total</td>
                  <td style={{ padding: "8px 4px", textAlign: "right", fontSize: 13, fontWeight: 700, color: C.muted, borderTop: `1.5px solid ${C.navy}` }}>{fmt(R.SUM, 1)}%</td>
                  <td style={{ padding: "6px 4px", borderTop: `1.5px solid ${C.navy}` }}>
                    <NumInput inputMode="numeric" min="0" step="1" style={{ ...inp, height: 38, borderRadius: 10, color: C.gold, fontSize: 15 }} value={Math.round(R.total)} onChange={v => setTotal(v)} />
                  </td>
                  {edit && <td style={{ borderTop: `1.5px solid ${C.navy}` }} />}
                  {Array.from({ length: CHECK_COLS }, (_, k) => (
                    <td key={`chk-f-${k}`} className="calcpan-printonly" style={{ borderTop: `1.5px solid ${C.navy}` }} />
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
          )}

          {edit && <button style={{ ...btn, marginTop: 10 }} onClick={addIng}>+ Agregar ingrediente</button>}

          <p className="calcpan-noprint" style={{ fontSize: 12, color: C.muted2, margin: "12px 0 0" }}>
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
                  onChange={e => patchFormula(() => ({ instr: e.target.value }))}
                  rows={12}
                  placeholder="Paso a paso, reglas de bodega, empaque, etc."
                  style={{ ...inp, height: "auto", padding: "10px 12px", textAlign: "left", fontWeight: 400, fontSize: 14, lineHeight: 1.5, resize: "vertical", minHeight: 160 }}
                />
                <p style={{ fontSize: 11, color: "#8a7a6e", margin: "6px 0 0", lineHeight: 1.5 }}>
                  Números automáticos: <b>{"{unidades}"}</b>, <b>{"{peso}"}</b> (a bolear), <b>{"{final}"}</b>, <b>{"{hidratacion}"}</b>, <b>{"{g:Sal}"}</b> (gramos de un ingrediente), <b>{"{kg:Harina}"}</b>, <b>{"{hielo}"}</b> / <b>{"{agua}"}</b> (mitades del líquido) y <b>{"{division}"}</b> (bloques para la divisora). Se actualizan solos al cambiar la fórmula.
                </p>
              </>) : (
                <>
                  <button className="calcpan-noprint" style={{ ...btn, height: 42, borderRadius: 12, padding: "0 16px", fontSize: 13 }} onClick={setShowInstr}>
                    {showInstr ? "Ocultar instrucciones" : "Ver instrucciones"}
                  </button>
                  {showInstr && (
                    <div style={{ marginTop: 10, whiteSpace: "pre-wrap", fontSize: 13.5, lineHeight: 1.6, color: C.ink, background: C.row, borderRadius: 14, padding: "14px 16px" }}>
                      {instrText}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div className="calcpan-noprint" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 18 }}>
            <button style={{ ...btnGold, height: 42, borderRadius: 12, padding: "0 16px", fontSize: 13 }} onClick={copyRecipe}>Copiar receta</button>
            {toast && <span style={{ fontSize: 13, color: C.navy, fontWeight: 600 }}>{toast}</span>}
          </div>
          </>)}
        </div>
      </div>
    </div>,
    document.body
  );
}
