"use client";
import { useState, useEffect, useMemo } from "react";

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
  wfinal: 80, merma: 15, round: 5, units: 300, instr: "",
  ings: [
    ["Harina", 100], ["Azúcar", 8], ["Margarina", 10], ["Sal", 2],
    ["Levadura", 2], ["Leche en polvo", 5], ["Agua", 57], ["Propionato", 0.5],
  ].map(([name, pct]) => ({ name, pct })),
};

const CIMPA = {
  id: "formula-cimpa",
  name: "Fórmula CIMPA",
  wfinal: 80, merma: 15, round: 5, units: 300,
  instr: `AJUSTE DE AGUA AL 57,0%: hidratación 57,0% exacto sobre la Harina Crema del Norte — máxima suavidad elástica y retención de humedad sin comprometer la estructura.

PASO A PASO (bodega & divisora)
1. Mezclado seco (Vel 1, 2 min): harina, gluten, fécula, Dimodan, propionato, leche, azúcar y levadura desmenuzada. Girar 2 min para homogeneizar.
2. Hidratación y temperatura (Vel 1, 3 min): disolver la glicerina en el agua helada. Agregar el líquido total (50% hielo picado directo + 50% agua helada con glicerina) mientras gira en V1.
3. Desarrollo de tela (Vel 2, 8–10 min): agregar sal y margarina Astra. Pasar a V2 hasta membrana transparente elástica (Punto de Tela 100%). Temperatura final de masa: 23–25 °C.
4. División mecánica exacta: pesar 10 bloques de 2.850 g. Pasar cada bloque por la divisora de 30 partes → 30 testos de 95 g por bloque (300 panes de 95 g crudo, saliendo de 80 g cocidos).

REGLAS OBLIGATORIAS (mesa y empaque)
• Boleado apretado con tensión: bolear con fuerza (palma en copa) para una "piel" exterior lisa y tensa. Colocar en lata con un toque mínimo suave en el centro (no aplastar).
• Leudo en Inoxforni: 34 °C y 80% HR por 55–65 min. Horno a 175 °C por 12–13 min.
• REGLA DEL TERMÓMETRO (cero moho en sedes): PROHIBIDO embolsar por tiempo. Clavar el termómetro de punzón en el centro del pan y SOLO EMBOLSAR cuando marque menos de 26 °C. Si entra caliente, la condensación crea moho verde a los 4 días.`,
  ings: [
    ["Harina Crema del Norte", 100], ["Gluten Vital (CIMPA)", 1.5],
    ["Fécula de Papa (CIMPA)", 1], ["Dimodan HP SG (CIMPA)", 0.5],
    ["Propionato de Calcio", 0.5], ["Glicerina USP (CIMPA)", 0.6],
    ["Azúcar Blanco", 8], ["Margarina Industrial (Astra)", 10],
    ["Leche en Polvo", 5], ["Sal Refinada", 2], ["Levadura Fresca", 2],
    ["Líquido Total (Hielo + Agua Helada)", 57],
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
      return out;
    }
  } catch { /* ignore */ }
  return SEED.map(clone);
}
function saveRecipes(list) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); } catch { /* ignore */ }
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

export function CalculadoraPan({ onClose }) {
  const [recipes, setRecipes] = useState(() => (typeof window !== "undefined" ? loadRecipes() : SEED));
  const [selId, setSelId] = useState(() => (typeof window !== "undefined" ? (loadRecipes()[0]?.id) : SEED[0].id));
  const [edit, setEdit] = useState(false);
  const [drive, setDrive] = useState("units");
  const [driverUnits, setDriverUnits] = useState(320);
  const [driverFlour, setDriverFlour] = useState(0);
  const [showInstr, setShowInstr] = useState(false);
  const [toast, setToast] = useState("");

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
  const delRecipe = () => {
    setRecipes(rs => {
      const next = rs.filter(r => r.id !== selId);
      if (!next.length) { const s = SEED.map(r => ({ ...r, ings: r.ings.map(i => ({ ...i })) })); setSelId(s[0].id); return s; }
      setSelId(next[0].id); return next;
    });
  };

  const copyRecipe = async () => {
    const txt = `${sel.name}\n${fmt(R.units)} unidades × ${fmt(R.w, R.r > 0 ? 0 : 1)} g\nMasa total: ${fmt(Math.round(R.total))} g\n\n` +
      sel.ings.map((x, i) => `${x.name}: ${fmt(R.grams[i])} g (${fmt(num(x.pct), num(x.pct) % 1 ? 1 : 0)}%)`).join("\n") +
      (sel.instr && sel.instr.trim() ? `\n\n— Instrucciones —\n${sel.instr}` : "");
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

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(10,15,25,0.88)", display: "flex", alignItems: "center", justifyContent: "center", padding: 14 }}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 680, maxHeight: "92vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 30px 80px rgba(0,0,0,0.5)", fontFamily: "'Poppins',sans-serif" }}>
        {/* Header */}
        <div style={{ background: `linear-gradient(135deg, ${C.navy}, ${C.navyD})`, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div>
            <div style={{ color: C.gold, fontSize: 10, fontWeight: 700, letterSpacing: 3, fontFamily: "Georgia,serif" }}>DON TELMO® · 1958 · COMPANY</div>
            <div style={{ color: "#fff", fontFamily: "Georgia,serif", fontSize: 18, fontWeight: 700, marginTop: 3 }}>🍞 Calculadora de Masas</div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginTop: 2 }}>Porcentaje panadero · harina = 100%</div>
          </div>
          <button onClick={onClose} title="Cerrar" style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, color: "#fff", width: 36, height: 36, cursor: "pointer", fontSize: 20, flexShrink: 0 }}>×</button>
        </div>

        {/* Selector de receta */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", padding: "12px 20px", background: C.cream, borderBottom: `1.5px solid ${C.line}`, flexShrink: 0 }}>
          <select value={selId} onChange={e => setSelId(e.target.value)} style={{ ...inp, textAlign: "left", width: "auto", flex: 1, minWidth: 140, fontWeight: 700 }}>
            {recipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <button style={btn} onClick={newRecipe}>+ Nueva</button>
          <button style={btn} onClick={dupRecipe}>Duplicar</button>
          <button style={{ ...btn, color: "#c0392b", borderColor: "#e8c5bf" }} onClick={delRecipe}>Borrar</button>
          <button style={edit ? btnGold : btn} onClick={() => setEdit(e => !e)}>{edit ? "Listo ✓" : "✏️ Editar fórmula"}</button>
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", flex: 1, padding: "16px 20px 24px", background: "#fff" }}>
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
              <input type="number" inputMode="numeric" min="0" step="1" style={drive === "units" ? inpDrive : inp} value={R.units} onChange={e => setUnits(e.target.value)} />
            </label>
            <label style={lbl}>Peso final por pan (g)
              <input type="number" inputMode="decimal" min="0" step="1" style={inp} value={sel.wfinal} onChange={e => patchRecipe({ wfinal: e.target.value })} />
            </label>
            <label style={lbl}>Merma (%)
              <input type="number" inputMode="decimal" min="0" step="0.5" style={inp} value={sel.merma} onChange={e => patchRecipe({ merma: e.target.value })} />
            </label>
            <label style={lbl}>Redondear peso a (g)
              <input type="number" inputMode="numeric" min="0" step="1" style={inp} value={sel.round} onChange={e => patchRecipe({ round: e.target.value })} />
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
                        ? <input type="number" step="0.1" min="0" style={{ ...inp, padding: "6px 8px" }} value={x.pct} onChange={e => patchIng(i, { pct: e.target.value })} />
                        : fmt(num(x.pct), num(x.pct) % 1 ? 1 : 0)}
                    </td>
                    <td style={{ padding: "6px 4px", borderBottom: `1px solid #f0ebe5` }}>
                      <input type="number" inputMode="numeric" min="0" step="1" style={{ ...inp, padding: "7px 8px" }} value={R.grams[i]} onChange={e => setGram(i, e.target.value)} />
                    </td>
                    {edit && (
                      <td style={{ padding: "6px 0", borderBottom: `1px solid #f0ebe5`, textAlign: "center" }}>
                        <button onClick={() => delIng(i)} title="Quitar" style={{ background: "none", border: "none", color: "#c0392b", cursor: "pointer", fontSize: 16 }}>×</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td style={{ padding: "8px 4px", fontWeight: 700, color: C.navy, borderTop: `2px solid ${C.ink}` }}>Masa total</td>
                  <td style={{ padding: "8px 4px", textAlign: "right", fontWeight: 700, color: "#8a7a6e", borderTop: `2px solid ${C.ink}` }}>{fmt(R.SUM, 1)}%</td>
                  <td style={{ padding: "6px 4px", borderTop: `2px solid ${C.ink}` }}>
                    <input type="number" inputMode="numeric" min="0" step="1" style={{ ...inp, padding: "7px 8px" }} value={Math.round(R.total)} onChange={e => setTotal(e.target.value)} />
                  </td>
                  {edit && <td style={{ borderTop: `2px solid ${C.ink}` }} />}
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
            <div style={{ marginTop: 18 }}>
              <div style={sect}>Instrucciones / método</div>
              {edit ? (
                <textarea
                  value={sel.instr || ""}
                  onChange={e => patchRecipe({ instr: e.target.value })}
                  rows={12}
                  placeholder="Paso a paso, reglas de bodega, empaque, etc."
                  style={{ ...inp, textAlign: "left", fontFamily: "'Poppins',sans-serif", fontWeight: 400, fontSize: 13, lineHeight: 1.5, resize: "vertical", minHeight: 160 }}
                />
              ) : (
                <>
                  <button style={btn} onClick={() => setShowInstr(s => !s)}>
                    {showInstr ? "▲ Ocultar instrucciones" : "📋 Ver instrucciones"}
                  </button>
                  {showInstr && (
                    <div style={{ marginTop: 10, whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.55, color: C.ink, background: C.cream, border: `1px solid ${C.line}`, borderRadius: 10, padding: "12px 14px" }}>
                      {sel.instr}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 18 }}>
            <button style={btnGold} onClick={copyRecipe}>Copiar receta</button>
            {toast && <span style={{ fontSize: 13, color: C.navy, fontWeight: 600 }}>{toast}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
