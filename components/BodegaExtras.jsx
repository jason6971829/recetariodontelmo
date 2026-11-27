"use client";
import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useBascula } from "@/components/PesajeBascula";
import { useViewport } from "@/hooks/useViewport";
import { parseNumber, parseQty, fmtGaby, fmtNum, defaultBaseIndex, GRAMS_PER } from "@/lib/scaleRecipe";
import { normalizeIngredient } from "@/lib/ingredients";
import { loadUi, saveUi } from "@/lib/session";
import { loadRegistros, addRegistro, updateRegistros, mermaDespiece, fmtFecha, uid, ingKey, useBodegaConfig, useInsumoCats, tipoDe, rangoPct } from "@/lib/bodega";

// Piezas de producción de bodega: lista de pedido, cierre de producción (rendimiento real),
// ficha de despiece con merma y el panel de órdenes / registros / mermas.
const C = { navy: "#0E2240", navy7: "#16325A", orange: "#D9731A", orange7: "#B85E10", orange1: "#FBEBDD", cream: "#F6F3EE", row: "#FAF8F4", line: "#E7E1D7", ink2: "#3C3A36", muted: "#8A847A", muted2: "#A39D92", green: "#1F9D6B", green1: "#E7F5EE", red: "#C8423B", red1: "#FDECEA", blue: "#3F5E8C", blue1: "#EAF0F8" };
const SERIF = "var(--dt-serif, Newsreader, Georgia, serif)";
const SANS = "var(--dt-sans, Manrope, system-ui, sans-serif)";
const btn = (bg, fg, extra = {}) => ({ height: 44, padding: "0 16px", borderRadius: 12, border: bg === "#fff" ? `1.5px solid ${C.line}` : 0, background: bg, color: fg, fontWeight: 800, fontSize: 13.5, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, whiteSpace: "nowrap", ...extra });
const inp = { height: 44, borderRadius: 11, border: `1.5px solid ${C.line}`, background: "#fff", padding: "0 12px", fontSize: 17, fontWeight: 800, color: C.navy, textAlign: "right", minWidth: 0, width: "100%", fontFamily: SANS };
const kg3 = (v) => fmtGaby(Math.round((Number(v) || 0) * 1000) / 1000);
const pct1 = (v) => `${fmtNum(v, 1)} %`;
const numIn = (v) => String(v).replace(/[^0-9.,]/g, "");

function Sheet({ title, sub, onClose, children, max = 560, z = 10030 }) {
  const { mobile } = useViewport();
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return createPortal(
    <div className="dt-scope" onClick={(e) => { e.stopPropagation(); onClose(); }} style={{ position: "fixed", inset: 0, zIndex: z, background: "rgba(9,24,49,.5)", display: "flex", alignItems: mobile ? "flex-end" : "center", justifyContent: "center", padding: mobile ? 0 : 20, fontFamily: SANS }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: max, maxHeight: mobile ? "calc(var(--app-height, 100vh) * .94)" : "min(calc(var(--app-height, 100vh) * .9), 900px)", background: "#fff", borderRadius: mobile ? "22px 22px 0 0" : 22, boxShadow: "0 30px 70px -20px rgba(0,0,0,.55)", display: "flex", flexDirection: "column", overflow: "hidden", color: "#14213D" }}>
        <div style={{ background: `linear-gradient(160deg, ${C.navy7}, ${C.navy})`, color: "#fff", padding: "16px 18px", display: "flex", alignItems: "flex-start", gap: 12, flex: "none" }}>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 600, lineHeight: 1.1 }}>{title}</span>
            {sub && <span style={{ fontSize: 12.5, color: "rgba(255,255,255,.7)" }}>{sub}</span>}
          </div>
          <button aria-label="Cerrar" onClick={onClose} style={{ width: 40, height: 40, borderRadius: 11, border: 0, background: "rgba(255,255,255,.12)", color: "#fff", fontSize: 18, cursor: "pointer", flex: "none" }}>✕</button>
        </div>
        <div style={{ overflowY: "auto", padding: `16px 18px calc(18px + env(safe-area-inset-bottom, 0px))`, display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>
      </div>
    </div>, document.body);
}

// ═════════════ LISTA DE PEDIDO ═════════════
// lines: [{ main: "141,000 KILO", name, code }]. Las preparaciones propias (S. …) no se piden: arrancan desmarcadas.
export function PedidoModal({ recipeName, rindeTxt, lines, onClose }) {
  const propia = (l) => /^s\.\s/i.test(String(l.name || "").trim());
  const [on, setOn] = useState(() => lines.map(l => !propia(l)));
  const [copied, setCopied] = useState(false);
  const text = useMemo(() => {
    const hoy = new Date().toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
    const sel = lines.filter((_, i) => on[i]);
    return [`PEDIDO DON TELMO · ${hoy}`, `Para: ${recipeName}${rindeTxt ? ` (${rindeTxt})` : ""}`, "", ...sel.map(l => `• ${l.main} — ${l.name}`)].join("\n");
  }, [lines, on, recipeName, rindeTxt]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { window.prompt("Copiá el pedido:", text); }
  };
  return (
    <Sheet title="Lista de pedido" sub={`${recipeName}${rindeTxt ? ` · ${rindeTxt}` : ""}`} onClose={onClose}>
      <span style={{ fontSize: 12.5, color: C.muted }}>Marcá lo que le vas a pedir a este proveedor. Las preparaciones propias (S. …) no se piden y arrancan sin marcar.</span>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {lines.map((l, i) => (
          <label key={i} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 42, padding: "5px 10px", borderRadius: 11, background: on[i] ? "#FFF6EE" : C.row, border: `1.5px solid ${on[i] ? C.orange : "transparent"}`, cursor: "pointer" }}>
            <input type="checkbox" checked={on[i]} onChange={() => setOn(v => v.map((x, k) => (k === i ? !x : x)))} style={{ width: 19, height: 19, accentColor: C.orange, flex: "none" }} />
            <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: C.ink2 }}><strong style={{ color: C.navy }}>{l.main}</strong> · {l.name}</span>
            {propia(l) && <span style={{ fontSize: 10, fontWeight: 800, color: C.blue, background: C.blue1, padding: "2px 6px", borderRadius: 6, flex: "none" }}>propia</span>}
          </label>
        ))}
      </div>
      <textarea readOnly value={text} rows={Math.min(10, text.split("\n").length + 1)} style={{ borderRadius: 12, border: `1.5px solid ${C.line}`, background: C.cream, padding: 12, fontSize: 13, fontFamily: "ui-monospace,Menlo,monospace", color: C.ink2, resize: "vertical" }} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={copy} style={btn(C.navy, "#fff", { flex: 1 })}>{copied ? "✓ Copiado" : "Copiar"}</button>
        <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer" style={btn("#1FA855", "#fff", { flex: 1, textDecoration: "none" })}>Enviar por WhatsApp</a>
      </div>
    </Sheet>
  );
}

// ═════════════ CIERRE DE PRODUCCIÓN ═════════════
// Al terminar de pesar: cuánto salió de verdad. Queda en el registro para ver qué recetas son estables.
export function CierreModal({ recipeName, planQty, unit, resumen, onSave, onClose }) {
  const [real, setReal] = useState(planQty > 0 ? fmtGaby(planQty) : "");
  const [nota, setNota] = useState("");
  const [busy, setBusy] = useState(false);
  const r = parseNumber(real);
  const dif = planQty > 0 && isFinite(r) ? ((r - planQty) / planQty) * 100 : null;
  return (
    <Sheet title="Cerrar producción" sub={recipeName} onClose={onClose} max={480}>
      {resumen && <div style={{ borderRadius: 12, background: C.cream, padding: 12, fontSize: 13, color: C.ink2, lineHeight: 1.5 }}>{resumen}</div>}
      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: C.navy }}>¿Cuánto salió? {planQty > 0 && <span style={{ fontWeight: 600, color: C.muted }}>(la receta dice {fmtGaby(planQty)} {unit})</span>}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input inputMode="decimal" value={real} onChange={e => setReal(numIn(e.target.value))} onFocus={e => e.target.select()} style={{ ...inp, height: 52, fontSize: 22, border: `2px solid ${C.orange}` }} />
          <span style={{ fontSize: 14, fontWeight: 800, color: C.navy }}>{unit}</span>
        </div>
      </label>
      {dif != null && Math.abs(dif) >= 0.05 && <span style={{ fontSize: 12.5, fontWeight: 700, color: Math.abs(dif) > 5 ? C.red : C.green }}>{dif > 0 ? "+" : ""}{fmtNum(dif, 1)} % frente a la receta</span>}
      <input value={nota} onChange={e => setNota(e.target.value)} placeholder="Nota (opcional): qué pasó, quién ayudó…" style={{ ...inp, textAlign: "left", fontSize: 14, fontWeight: 600 }} />
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onClose} style={btn("#fff", C.navy)}>Volver</button>
        <button disabled={busy || !(r > 0)} onClick={async () => { setBusy(true); const ok = await onSave(r, nota.trim()); if (!ok) setBusy(false); }} style={btn(C.green, "#fff", { flex: 1, opacity: busy || !(r > 0) ? 0.5 : 1 })}>{busy ? "Guardando…" : "Guardar producción"}</button>
      </div>
    </Sheet>
  );
}

// ═════════════ FICHA DE DESPIECE ═════════════
// despiece: { salidas: [{ code, name, unit: "KILO"|"UNIDAD", pct (del peso que entra), gU (gramos por unidad) }] }
export function DespiecePanel({ recipe, principal, despiece, currentUser }) {
  const b = useBascula();
  const salidas = despiece?.salidas || [];
  const [d0] = useState(() => { const v = typeof window !== "undefined" ? loadUi("dt_despiece") : null; return v && String(v.id) === String(recipe.id) ? v : null; });
  const [entra, setEntra] = useState(d0?.entra || "");
  const [vals, setVals] = useState(() => d0?.vals || salidas.map(() => ({ kg: "", und: "" })));
  const [base, setBase] = useState(0);
  const [nota, setNota] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => { saveUi("dt_despiece", { id: recipe.id, entra, vals }); }, [recipe.id, entra, vals]);

  const g = b.scaleG - base;
  const canAdd = b.stable && g > 0;
  const addTo = (cur) => fmtGaby((isFinite(parseNumber(cur)) ? parseNumber(cur) : 0) + g / 1000);
  const sumEntra = () => { if (canAdd) { setEntra(v => addTo(v)); setBase(b.scaleG); } };
  const sumSal = (i) => { if (canAdd) { setVals(v => v.map((x, k) => (k === i ? { ...x, kg: addTo(x.kg) } : x))); setBase(b.scaleG); } };
  const setVal = (i, f, v) => setVals(a => a.map((x, k) => (k === i ? { ...x, [f]: numIn(v) } : x)));

  const E = parseNumber(entra);
  const hasE = isFinite(E) && E > 0;
  const rows = salidas.map((s, i) => {
    const kg = parseNumber(vals[i]?.kg), und = parseNumber(vals[i]?.und);
    return { ...s, kg: isFinite(kg) ? kg : 0, und: isFinite(und) ? und : 0, espKg: hasE ? (E * (Number(s.pct) || 0)) / 100 : 0 };
  });
  const M = mermaDespiece(hasE ? E : 0, rows);
  const alguna = rows.some(r => r.kg > 0);
  const mermaColor = M.kg < -0.0005 ? C.red : M.pct > 5 ? C.red : M.pct > 2 ? C.orange7 : C.green;
  const isOn = b.conn === "on" || b.conn === "sim";

  const guardar = async () => {
    if (!hasE || !alguna) return;
    setBusy(true); setErr("");
    const k = M.saleKg > 0 ? E / M.saleKg : 1; // la merma se reparte entre lo que sale (para el costo / FBH)
    const reg = {
      id: uid(), kind: "despiece", at: new Date().toISOString(), by: currentUser?.username || "", recipeId: recipe.id, name: recipe.name, nota: nota.trim(),
      entra: { code: principal?.code || "", name: principal?.name || "", kg: Math.round(E * 1000) / 1000 },
      salidas: rows.map(r => ({ code: r.code || "", name: r.name, unit: r.unit, kg: Math.round(r.kg * 1000) / 1000, und: r.unit === "UNIDAD" ? r.und : null, pctEsp: Number(r.pct) || 0, pctReal: E > 0 ? Math.round((r.kg / E) * 1000) / 10 : 0, kgRepartido: Math.round(r.kg * k * 1000) / 1000 })),
      merma: { kg: M.kg, pct: Math.round(M.pct * 10) / 10 },
    };
    const ok = await addRegistro(reg);
    setBusy(false);
    if (!ok) { setErr("No se pudo guardar (revisá la conexión) y volvé a intentar."); return; }
    setSaved(reg); saveUi("dt_despiece", null);
  };
  const nuevo = () => { setSaved(null); setEntra(""); setVals(salidas.map(() => ({ kg: "", und: "" }))); setNota(""); };

  if (saved) {
    return (
      <div style={{ borderRadius: 16, background: C.green1, border: "1.5px solid #9AD8BC", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: "#166E4B" }}>✓ Despiece guardado</span>
        <span style={{ fontSize: 13, color: "#2F7A5A" }}>Entraron {kg3(saved.entra.kg)} KILO · salieron {kg3(saved.entra.kg - saved.merma.kg)} KILO · merma <strong>{kg3(saved.merma.kg)} KILO ({pct1(saved.merma.pct)})</strong></span>
        <div style={{ borderRadius: 12, background: "#fff", padding: 12, display: "flex", flexDirection: "column", gap: 5 }}>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".14em", color: C.muted }}>PARA REGISTRAR LA TRANSFORMACIÓN (MERMA YA REPARTIDA)</span>
          {saved.salidas.filter(s => s.kg > 0).map((s, i) => (
            <span key={i} style={{ fontSize: 13.5, color: C.ink2 }}><strong style={{ color: C.navy }}>{kg3(s.kgRepartido)} KILO</strong>{s.unit === "UNIDAD" && s.und > 0 ? ` → ${fmtNum(s.und, 0)} UNIDAD` : ""} · {s.name} <span style={{ color: C.muted2, fontSize: 11.5 }}>(pesó {kg3(s.kg)})</span></span>
          ))}
        </div>
        <button onClick={nuevo} style={btn("#fff", "#166E4B", { alignSelf: "flex-start", border: "1.5px solid #9AD8BC" })}>Hacer otro despiece</button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* pesa */}
      <div style={{ position: "sticky", top: 0, zIndex: 3, borderRadius: 16, background: "#fff", border: `1.5px solid ${C.orange}`, padding: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", boxShadow: "0 14px 30px -22px rgba(217,115,26,.6)" }}>
        <span style={{ display: "flex", alignItems: "baseline", gap: 4, fontVariantNumeric: "tabular-nums", opacity: b.live ? (b.moving ? 0.7 : 1) : 0.45 }}>
          <span style={{ fontSize: 34, fontWeight: 800, color: C.navy, lineHeight: 1 }}>{b.live ? kg3(g / 1000) : "0,000"}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.muted }}>KILO</span>
        </span>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: b.live ? C.green : C.muted }}>{b.conn === "sim" ? "modo prueba" : b.live ? "pesa conectada" : b.conn === "connecting" ? "conectando…" : "pesa desconectada"}</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
          {b.live && <button onClick={() => setBase(b.scaleG)} disabled={!b.stable} style={btn("#fff", C.navy, { height: 36, padding: "0 12px", fontSize: 12.5, opacity: b.stable ? 1 : 0.5 })}>Cero</button>}
          {!isOn && b.conn !== "connecting" && <button onClick={b.startSim} style={btn("#fff", C.muted, { height: 36, padding: "0 10px", fontSize: 12 })}>Probar</button>}
          <button onClick={() => (isOn ? b.stop() : b.connect("auto"))} style={btn(isOn ? "#fff" : C.orange, isOn ? C.muted : "#fff", { height: 36, padding: "0 12px", fontSize: 12.5 })}>{isOn ? "Desconectar" : "Conectar pesa"}</button>
        </span>
        {b.conn === "sim" && (
          <span style={{ display: "flex", gap: 4, flexWrap: "wrap", width: "100%" }}>
            {[-500, 100, 1000, 5000].map(d => <button key={d} onClick={() => b.setSimG(x => Math.max(0, x + d))} style={{ height: 26, padding: "0 8px", borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{d > 0 ? "+" : ""}{d}</button>)}
          </span>
        )}
        {b.err && <span style={{ width: "100%", fontSize: 12, fontWeight: 600, color: "#8e2b20" }}>{b.err}</span>}
      </div>

      {/* entra */}
      <div style={{ borderRadius: 14, background: "#FFF6EE", border: `1.5px solid ${C.orange}`, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".16em", color: C.orange7 }}>★ ENTRA · {String(principal?.name || "").toUpperCase()}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input inputMode="decimal" value={entra} placeholder="0,000" onChange={e => setEntra(numIn(e.target.value))} style={{ ...inp, height: 50, fontSize: 21, border: `2px solid ${C.orange}` }} />
          <span style={{ fontSize: 13, fontWeight: 800, color: C.navy }}>KILO</span>
          <button onClick={sumEntra} disabled={!canAdd} title="Suma lo que hay en la pesa" style={btn(C.navy, "#fff", { opacity: canAdd ? 1 : 0.4, padding: "0 12px" })}>+ pesa</button>
        </div>
        <span style={{ fontSize: 11.5, color: C.muted }}>Escribí el peso o sumalo con la pesa: cada «+ pesa» agrega lo que hay en la pesa (sirve para varias canastillas).</span>
      </div>

      {/* salidas */}
      <span style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 600, color: C.navy }}>Lo que sale</span>
      {rows.map((r, i) => {
        const und = r.unit === "UNIDAD";
        const espU = und && r.gU > 0 ? (r.espKg * 1000) / r.gU : 0;
        const gReal = und && r.und > 0 && r.kg > 0 ? (r.kg * 1000) / r.und : 0;
        return (
          <div key={i} style={{ borderRadius: 14, background: i % 2 ? "#fff" : C.row, border: `1px solid ${C.line}`, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              {r.code && <span style={{ fontFamily: "ui-monospace,Menlo,monospace", fontSize: 10.5, fontWeight: 700, color: C.orange7, background: C.orange1, padding: "3px 7px", borderRadius: 6 }}>{r.code}</span>}
              <span style={{ fontSize: 14.5, fontWeight: 800, color: C.navy }}>{r.name}</span>
              <span style={{ marginLeft: "auto", fontSize: 11.5, color: C.muted }}>
                se espera {pct1(Number(r.pct) || 0)}{hasE ? ` ≈ ${kg3(r.espKg)} KILO${und && espU > 0 ? ` · ${fmtNum(espU, 0)} und` : ""}` : ""}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6, flex: "1 1 150px", minWidth: 0 }}>
                <input inputMode="decimal" value={vals[i]?.kg || ""} placeholder="0,000" onChange={e => setVal(i, "kg", e.target.value)} style={inp} />
                <span style={{ fontSize: 12, fontWeight: 800, color: C.navy }}>KILO</span>
              </span>
              <button onClick={() => sumSal(i)} disabled={!canAdd} style={btn(C.navy, "#fff", { opacity: canAdd ? 1 : 0.4, padding: "0 12px" })}>+ pesa</button>
              {und && (
                <span style={{ display: "flex", alignItems: "center", gap: 6, flex: "1 1 110px", minWidth: 0 }}>
                  <input inputMode="numeric" value={vals[i]?.und || ""} placeholder="0" onChange={e => setVal(i, "und", e.target.value)} style={inp} />
                  <span style={{ fontSize: 12, fontWeight: 800, color: C.navy }}>UND</span>
                </span>
              )}
            </div>
            {(r.kg > 0 && hasE) && (
              <span style={{ fontSize: 11.5, fontWeight: 700, color: Math.abs((r.kg / E) * 100 - (Number(r.pct) || 0)) > 5 ? C.orange7 : C.green }}>
                real {pct1((r.kg / E) * 100)}{gReal > 0 ? ` · ${fmtNum(gReal, 0)} g por unidad${r.gU > 0 ? ` (estándar ${fmtNum(r.gU, 0)} g)` : ""}` : ""}
              </span>
            )}
          </div>
        );
      })}

      {/* merma */}
      <div style={{ borderRadius: 14, background: C.cream, padding: 14, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 150 }}>
          <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".16em", color: C.muted }}>MERMA (LO QUE ENTRÓ − LO QUE SALIÓ)</span>
          <span style={{ fontSize: 24, fontWeight: 800, color: hasE && alguna ? mermaColor : C.muted2, fontVariantNumeric: "tabular-nums" }}>{hasE && alguna ? `${kg3(M.kg)} KILO · ${pct1(M.pct)}` : "—"}</span>
          {hasE && alguna && M.kg < -0.0005 && <span style={{ fontSize: 12, fontWeight: 700, color: C.red }}>Sale más de lo que entró: revisá los pesos.</span>}
        </span>
        <span style={{ fontSize: 12, color: C.muted }}>sale {kg3(M.saleKg)} de {hasE ? kg3(E) : "0,000"} KILO</span>
      </div>
      <input value={nota} onChange={e => setNota(e.target.value)} placeholder="Nota (opcional): proveedor, lote, qué pasó…" style={{ ...inp, textAlign: "left", fontSize: 14, fontWeight: 600 }} />
      {err && <span style={{ fontSize: 12.5, fontWeight: 700, color: C.red }}>{err}</span>}
      <button onClick={guardar} disabled={busy || !hasE || !alguna} style={btn(C.green, "#fff", { height: 50, fontSize: 15, opacity: busy || !hasE || !alguna ? 0.45 : 1 })}>{busy ? "Guardando…" : "Guardar despiece"}</button>
      <span style={{ fontSize: 11.5, color: C.muted2, lineHeight: 1.45 }}>La merma queda en el reporte «Órdenes y mermas». Para el costo, se reparte entre lo que sale en proporción al peso.</span>
    </div>
  );
}

// ═════════════ FICHA DE REPARTO (lo que entra se cuenta por UNIDADES) ═════════════
// despiece: { unit: "UNIDAD", salidas: [{ code, name, unit: "UNIDAD"|"KILO", pct (de las unidades que entran), por (cantidad que sale por cada unidad que entra) }] }
export function RepartoPanel({ recipe, principal, despiece, currentUser }) {
  const b = useBascula();
  const salidas = despiece?.salidas || [];
  const hayKilos = salidas.some(s => s.unit !== "UNIDAD");
  const [d0] = useState(() => { const v = typeof window !== "undefined" ? loadUi("dt_despiece") : null; return v && String(v.id) === String(recipe.id) ? v : null; });
  const [entra, setEntra] = useState(d0?.entra || "");
  const [vals, setVals] = useState(() => d0?.vals || salidas.map(() => ""));
  const [base, setBase] = useState(0);
  const [nota, setNota] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => { saveUi("dt_despiece", { id: recipe.id, entra, vals }); }, [recipe.id, entra, vals]);
  const g = b.scaleG - base;
  const canAdd = b.stable && g > 0;
  const isOn = b.conn === "on" || b.conn === "sim";
  const setVal = (i, v) => setVals(a => a.map((x, k) => (k === i ? numIn(v) : x)));
  const sumKg = (i) => { if (canAdd) { setVals(a => a.map((x, k) => (k === i ? fmtGaby((isFinite(parseNumber(x)) ? parseNumber(x) : 0) + g / 1000) : x))); setBase(b.scaleG); } };
  const E = parseNumber(entra); const hasE = isFinite(E) && E > 0;
  const rows = salidas.map((s, i) => { const q = parseNumber(vals[i]); return { ...s, q: isFinite(q) ? q : 0, esp: hasE ? E * (Number(s.por) || 0) : 0 }; });
  const alguna = rows.some(r => r.q > 0);
  // la merma solo se puede sacar en unidades cuando todo lo que sale también va por unidades
  const soloUnd = !hayKilos;
  const saleU = rows.reduce((a, r) => a + (r.unit === "UNIDAD" ? r.q : 0), 0);
  const mermaU = soloUnd && hasE ? E - saleU : null;
  const mermaPct = mermaU != null && E > 0 ? (mermaU / E) * 100 : 0;
  const mColor = mermaU == null ? C.muted2 : mermaU < 0 ? C.red : mermaPct > 5 ? C.red : mermaPct > 2 ? C.orange7 : C.green;
  const uTxt = (u) => (u === "UNIDAD" ? "UND" : "KILO");
  const qTxt = (q, u) => (u === "UNIDAD" ? `${fmtNum(q, 2)} UNIDAD` : `${kg3(q)} KILO`);

  const guardar = async () => {
    if (!hasE || !alguna) return;
    setBusy(true); setErr("");
    const reg = { id: uid(), kind: "despiece", unit: "UNIDAD", at: new Date().toISOString(), by: currentUser?.username || "", recipeId: recipe.id, name: recipe.name, nota: nota.trim(),
      entra: { code: principal?.code || "", name: principal?.name || "", und: E },
      salidas: rows.map(r => ({ code: r.code || "", name: r.name, unit: r.unit, q: Math.round(r.q * 1000) / 1000, esp: Math.round(r.esp * 1000) / 1000 })),
      merma: mermaU != null ? { und: Math.round(mermaU * 100) / 100, pct: Math.round(mermaPct * 10) / 10 } : null };
    const ok = await addRegistro(reg);
    setBusy(false);
    if (!ok) { setErr("No se pudo guardar (revisá la conexión) y volvé a intentar."); return; }
    setSaved(reg); saveUi("dt_despiece", null);
  };
  const nuevo = () => { setSaved(null); setEntra(""); setVals(salidas.map(() => "")); setNota(""); };

  if (saved) {
    return (
      <div style={{ borderRadius: 16, background: C.green1, border: "1.5px solid #9AD8BC", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: "#166E4B" }}>✓ Reparto guardado</span>
        <span style={{ fontSize: 13, color: "#2F7A5A" }}>Entraron {fmtNum(saved.entra.und, 2)} UNIDAD de {saved.entra.name}{saved.merma ? <> · merma <strong>{fmtNum(saved.merma.und, 2)} UNIDAD ({pct1(saved.merma.pct)})</strong></> : null}</span>
        {saved.salidas.filter(s => s.q > 0).map((s, i) => <span key={i} style={{ fontSize: 13.5, color: C.ink2 }}>→ <strong style={{ color: C.navy }}>{qTxt(s.q, s.unit)}</strong> · {s.name}</span>)}
        <button onClick={nuevo} style={btn("#fff", "#166E4B", { alignSelf: "flex-start", border: "1.5px solid #9AD8BC" })}>Hacer otro reparto</button>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {hayKilos && (
        <div style={{ borderRadius: 16, background: "#fff", border: `1.5px solid ${C.orange}`, padding: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ display: "flex", alignItems: "baseline", gap: 4, fontVariantNumeric: "tabular-nums", opacity: b.live ? (b.moving ? 0.7 : 1) : 0.45 }}>
            <span style={{ fontSize: 30, fontWeight: 800, color: C.navy, lineHeight: 1 }}>{b.live ? kg3(g / 1000) : "0,000"}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.muted }}>KILO</span>
          </span>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: b.live ? C.green : C.muted }}>{b.conn === "sim" ? "modo prueba" : b.live ? "pesa conectada" : "pesa desconectada"}</span>
          <span style={{ marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
            {b.live && <button onClick={() => setBase(b.scaleG)} disabled={!b.stable} style={btn("#fff", C.navy, { height: 36, padding: "0 12px", fontSize: 12.5, opacity: b.stable ? 1 : 0.5 })}>Cero</button>}
            {!isOn && b.conn !== "connecting" && <button onClick={b.startSim} style={btn("#fff", C.muted, { height: 36, padding: "0 10px", fontSize: 12 })}>Probar</button>}
            <button onClick={() => (isOn ? b.stop() : b.connect("auto"))} style={btn(isOn ? "#fff" : C.orange, isOn ? C.muted : "#fff", { height: 36, padding: "0 12px", fontSize: 12.5 })}>{isOn ? "Desconectar" : "Conectar pesa"}</button>
          </span>
          {b.conn === "sim" && <span style={{ display: "flex", gap: 4, width: "100%" }}>{[-500, 100, 1000, 5000].map(d => <button key={d} onClick={() => b.setSimG(x => Math.max(0, x + d))} style={{ height: 26, padding: "0 8px", borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{d > 0 ? "+" : ""}{d}</button>)}</span>}
        </div>
      )}
      <div style={{ borderRadius: 14, background: "#FFF6EE", border: `1.5px solid ${C.orange}`, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".16em", color: C.orange7 }}>★ ENTRA · {String(principal?.name || "").toUpperCase()}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input inputMode="decimal" value={entra} placeholder="0" onChange={e => setEntra(numIn(e.target.value))} style={{ ...inp, height: 50, fontSize: 21, border: `2px solid ${C.orange}` }} />
          <span style={{ fontSize: 13, fontWeight: 800, color: C.navy }}>UNIDADES</span>
        </div>
        <span style={{ fontSize: 11.5, color: C.muted }}>Contá cuántas unidades vas a repartir.</span>
      </div>
      <span style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 600, color: C.navy }}>Lo que sale</span>
      {rows.map((r, i) => (
        <div key={i} style={{ borderRadius: 14, background: i % 2 ? "#fff" : C.row, border: `1px solid ${C.line}`, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            {r.code && <span style={{ fontFamily: "ui-monospace,Menlo,monospace", fontSize: 10.5, fontWeight: 700, color: C.orange7, background: C.orange1, padding: "3px 7px", borderRadius: 6 }}>{r.code}</span>}
            <span style={{ fontSize: 14.5, fontWeight: 800, color: C.navy }}>{r.name}</span>
            <span style={{ marginLeft: "auto", fontSize: 11.5, color: C.muted }}>se espera {hasE ? qTxt(r.esp, r.unit) : r.unit === "UNIDAD" ? pct1(Number(r.pct) || 0) : `${fmtNum((Number(r.por) || 0) * 1000, 0)} g por unidad`}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input inputMode="decimal" value={vals[i] || ""} placeholder={r.unit === "UNIDAD" ? "0" : "0,000"} onChange={e => setVal(i, e.target.value)} style={inp} />
            <span style={{ fontSize: 12, fontWeight: 800, color: C.navy }}>{uTxt(r.unit)}</span>
            {r.unit !== "UNIDAD" && <button onClick={() => sumKg(i)} disabled={!canAdd} style={btn(C.navy, "#fff", { opacity: canAdd ? 1 : 0.4, padding: "0 12px" })}>+ pesa</button>}
          </div>
        </div>
      ))}
      <div style={{ borderRadius: 14, background: C.cream, padding: 14, display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".16em", color: C.muted }}>{soloUnd ? "DIFERENCIA (LO QUE ENTRÓ − LO QUE SALIÓ)" : "CONTROL"}</span>
        {soloUnd
          ? <span style={{ fontSize: 24, fontWeight: 800, color: hasE && alguna ? mColor : C.muted2, fontVariantNumeric: "tabular-nums" }}>{hasE && alguna ? `${fmtNum(mermaU, 2)} UNIDAD · ${pct1(mermaPct)}` : "—"}</span>
          : <span style={{ fontSize: 13, color: C.ink2 }}>Como una parte sale en kilos y otra en unidades, no se calcula una merma única: queda guardado lo que salió de cada cosa frente a lo esperado.</span>}
        {soloUnd && hasE && alguna && mermaU < 0 && <span style={{ fontSize: 12, fontWeight: 700, color: C.red }}>Sale más de lo que entró: revisá las cantidades.</span>}
      </div>
      <input value={nota} onChange={e => setNota(e.target.value)} placeholder="Nota (opcional)…" style={{ ...inp, textAlign: "left", fontSize: 14, fontWeight: 600 }} />
      {err && <span style={{ fontSize: 12.5, fontWeight: 700, color: C.red }}>{err}</span>}
      <button onClick={guardar} disabled={busy || !hasE || !alguna} style={btn(C.green, "#fff", { height: 50, fontSize: 15, opacity: busy || !hasE || !alguna ? 0.45 : 1 })}>{busy ? "Guardando…" : "Guardar reparto"}</button>
    </div>
  );
}

// ═════════════ PANEL: ÓRDENES, PRODUCCIONES Y MERMAS ═════════════
// Insumos de varias órdenes sumados: cada receta se escala a lo que pide su orden y lo igual se suma
// (KILO y GRAMOS se suman en kilos; LITRO y ML en litros; lo demás por su unidad).
export function consolidarOrdenes(ordenes, recipes) {
  const acc = new Map(); const sin = [];
  (ordenes || []).forEach(o => {
    const rec = (recipes || []).find(r => String(r.id) === String(o.recipeId));
    if (!rec) { sin.push(o.name); return; }
    const ings = (rec.ingredients || []).map(normalizeIngredient);
    const parsed = ings.map(n => parseQty(n.text));
    // factor de la orden: lo pedido del principal / lo que dice la receta
    let bi = parsed.findIndex((p, i) => p && o.principal?.code && ings[i].code === o.principal.code);
    if (bi < 0) bi = parsed.findIndex(p => p && String(p.name).toUpperCase() === String(o.principal?.name || "").toUpperCase());
    const f = bi >= 0 && parsed[bi].qty > 0 && o.principal?.plan > 0 ? o.principal.plan / parsed[bi].qty : 1;
    parsed.forEach((p, i) => {
      if (!p) return;
      let unit = p.unitRaw || p.unit, qty = p.qty * f;
      if (p.unit === "KILO" || p.unit === "GR") { unit = "KILO"; qty = p.unit === "GR" ? qty / 1000 : qty; }
      else if (p.unit === "LITRO" || p.unit === "ML") { unit = "LITRO"; qty = p.unit === "ML" ? qty / 1000 : qty; }
      const key = ingKey(ings[i].code, p.name) + "|" + unit;
      const a = acc.get(key) || { code: ings[i].code, name: p.name, unit, qty: 0, de: [] };
      a.qty += qty; if (!a.de.includes(o.name)) a.de.push(o.name);
      acc.set(key, a);
    });
  });
  const lines = [...acc.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
  return { lines, sin };
}

// Hoja de pesaje de una orden: la receta escalada a lo que pide la orden, con su principal y tipos de pesaje
export function hojaDeOrden(o, recipes, cfgAll, cats) {
  const recipe = (recipes || []).find(r => String(r.id) === String(o.recipeId));
  if (!recipe) return null;
  const cfg = (cfgAll || {})[recipe.id] || {};
  const ings = (recipe.ingredients || []).map(normalizeIngredient);
  const parsed = ings.map(n => parseQty(n.text));
  const keys = ings.map((n, i) => ingKey(n.code, parsed[i]?.name || n.text));
  let bi = cfg.principal ? keys.findIndex((k, i) => k === cfg.principal && parsed[i]) : -1;
  if (bi < 0 && o.principal?.code) bi = parsed.findIndex((p, i) => p && ings[i].code === o.principal.code);
  if (bi < 0) bi = defaultBaseIndex(parsed);
  // el factor sale del insumo que la orden guardó como principal
  let oi = parsed.findIndex((p, i) => p && o.principal?.code && ings[i].code === o.principal.code);
  if (oi < 0) oi = parsed.findIndex(p => p && String(p.name).toUpperCase() === String(o.principal?.name || "").toUpperCase());
  const factor = oi >= 0 && parsed[oi].qty > 0 && o.principal?.plan > 0 ? o.principal.plan / parsed[oi].qty : 1;
  const tolPct = rangoPct(cfg);
  return {
    recipe, factor, tolPct, rinde: parseQty(recipe.portions), principalIdx: bi,
    rows: ings.map((n, i) => { const p = parsed[i]; return { code: n.code, name: p?.name || n.text, qty: p ? p.qty * factor : null, unit: p?.unit, unitRaw: p?.unitRaw, tipo: p ? (i === bi ? "principal" : GRAMS_PER[p.unit] ? tipoDe(cfg, keys[i], (cats || {})[n.code]) : "") : "" }; }),
  };
}

export function BodegaRegistros({ isAdmin, onClose, onOpenRecipe, recipes = [] }) {
  const [cfgAll] = useBodegaConfig(true);
  const insCats = useInsumoCats(true);
  const [list, setList] = useState(null);
  const [pedido, setPedido] = useState(false);
  const [tab, setTab] = useState("ordenes");
  const [busy, setBusy] = useState(false);
  const refresh = () => loadRegistros().then(r => setList(r || []));
  useEffect(() => { refresh(); }, []);
  const del = async (id) => {
    if (!window.confirm("¿Borrar este registro? No se puede deshacer.")) return;
    setBusy(true); const r = await updateRegistros(l => l.filter(x => x.id !== id)); setBusy(false);
    if (r) setList(r);
  };
  const L = list || [];
  const ordenes = L.filter(r => r.kind === "orden" && r.estado === "pendiente");
  const prods = L.filter(r => r.kind === "produccion");
  const desp = L.filter(r => r.kind === "despiece");
  // promedio de merma por producto
  const porProd = useMemo(() => {
    const m = {};
    desp.filter(d => d.unit !== "UNIDAD").forEach(d => { const k = d.entra?.name || d.name; const a = (m[k] = m[k] || { n: 0, entra: 0, merma: 0 }); a.n++; a.entra += d.entra?.kg || 0; a.merma += d.merma?.kg || 0; });
    return Object.entries(m).map(([name, a]) => ({ name, ...a, pct: a.entra > 0 ? (a.merma / a.entra) * 100 : 0 }));
  }, [desp]);
  // estabilidad de rendimiento por receta
  const porRec = useMemo(() => {
    const m = {};
    prods.forEach(p => { if (!(p.rinde?.plan > 0) || !(p.rinde?.real > 0)) return; const a = (m[p.name] = m[p.name] || { n: 0, difs: [] }); a.n++; a.difs.push(((p.rinde.real - p.rinde.plan) / p.rinde.plan) * 100); });
    return Object.entries(m).map(([name, a]) => ({ name, n: a.n, prom: a.difs.reduce((x, y) => x + y, 0) / a.n, min: Math.min(...a.difs), max: Math.max(...a.difs) }));
  }, [prods]);
  const cons = useMemo(() => consolidarOrdenes(ordenes, recipes), [list, recipes]); // eslint-disable-line react-hooks/exhaustive-deps
  const consLine = (l) => ({ main: `${fmtGaby(Math.round(l.qty * 1000) / 1000)} ${l.unit}`, name: titleCase(l.name), code: l.code });
  const hojas = useMemo(() => ordenes.map(o => hojaDeOrden(o, recipes, cfgAll, insCats)).filter(Boolean), [list, recipes, cfgAll, insCats]); // eslint-disable-line react-hooks/exhaustive-deps
  const tabs = [["ordenes", `Órdenes pendientes (${ordenes.length})`], ["prod", `Producciones (${prods.length})`], ["desp", `Despieces y mermas (${desp.length})`]];
  const card = { borderRadius: 14, border: `1px solid ${C.line}`, background: "#fff", padding: 12, display: "flex", flexDirection: "column", gap: 5 };
  const small = { fontSize: 12, color: C.muted };
  const delBtn = (id) => isAdmin && <button disabled={busy} onClick={() => del(id)} style={{ border: 0, background: "none", color: C.red, fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0, alignSelf: "flex-start" }}>Borrar</button>;
  return (
    <Sheet title="Órdenes y mermas" sub="Producción de bodega: lo que hay por hacer, lo que rindió y lo que se perdió" onClose={onClose} max={720} z={10020}>
      <div className="dt-noscroll" style={{ display: "flex", gap: 6, overflowX: "auto" }}>
        {tabs.map(([k, label]) => <button key={k} onClick={() => setTab(k)} style={{ flex: "none", height: 36, padding: "0 13px", borderRadius: 999, border: `1.5px solid ${tab === k ? C.navy : C.line}`, background: tab === k ? C.navy : "#fff", color: tab === k ? "#fff" : C.navy, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>{label}</button>)}
      </div>
      {list == null && <span style={small}>Cargando…</span>}

      {list != null && tab === "ordenes" && (ordenes.length === 0
        ? <span style={small}>No hay órdenes pendientes. Se crean desde una receta de bodega: Calcular → «Crear orden».</span>
        : <>
        {cons.lines.length > 0 && (
          <div style={{ ...card, background: "#FFFAF5", border: "1.5px solid #F1D9C2", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ flex: 1, minWidth: 180, display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".14em", color: C.orange7 }}>INSUMOS PARA {ordenes.length === 1 ? "LA ORDEN" : `LAS ${ordenes.length} ÓRDENES`}</span>
                <span style={{ fontSize: 12, color: C.muted }}>Lo que se repite entre recetas ya está sumado.</span>
              </span>
              <button onClick={() => setPedido(true)} style={btn(C.navy, "#fff", { height: 38, fontSize: 13 })}>Hacer pedido (copiar / WhatsApp)</button>
              {hojas.length > 0 && <button onClick={printHojaBodega} title="Una hoja de pesaje por cada orden, con las cantidades de la orden" style={btn(C.orange, "#fff", { height: 38, fontSize: 13 })}>Imprimir {hojas.length === 1 ? "la hoja" : `las ${hojas.length} hojas`} de pesaje</button>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {cons.lines.map((l, i) => { const c = consLine(l); return (
                <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "6px 8px", borderRadius: 9, background: i % 2 ? "transparent" : "#fff" }}>
                  <strong style={{ fontSize: 13.5, color: C.navy, minWidth: 118, textAlign: "right", fontVariantNumeric: "tabular-nums", flex: "none" }}>{c.main}</strong>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: C.ink2 }}>{c.name}{l.de.length > 1 && <span style={{ fontSize: 11, fontWeight: 700, color: C.blue }}> · suma de {l.de.length} recetas</span>}</span>
                  {l.code && <span style={{ fontFamily: "ui-monospace,Menlo,monospace", fontSize: 10.5, color: C.muted2, flex: "none" }}>{l.code}</span>}
                </div>
              ); })}
            </div>
            {cons.sin.length > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: C.red }}>No encontré la receta de: {cons.sin.join(", ")} (no está sumada).</span>}
          </div>
        )}
        {tab === "ordenes" && hojas.length > 0 && <BodegaPrintMulti sheets={hojas} />}
        {pedido && <PedidoModal recipeName={ordenes.length === 1 ? ordenes[0].name : `${ordenes.length} órdenes: ${ordenes.map(o => o.name).join(", ")}`} rindeTxt="" lines={cons.lines.map(consLine)} onClose={() => setPedido(false)} />}
        {ordenes.map(o => (
          <div key={o.id} style={card}>
            <span style={{ fontSize: 15, fontWeight: 800, color: C.navy }}>{o.name}</span>
            <span style={{ fontSize: 13.5, color: C.ink2 }}><strong>{fmtGaby(o.principal?.plan || 0)} {o.principal?.unit}</strong> de {o.principal?.name}{o.rinde?.plan > 0 ? ` · rinde ${fmtGaby(o.rinde.plan)} ${o.rinde.unit}` : ""}</span>
            <span style={small}>Pedida por {o.by || "—"} · {fmtFecha(o.at)}{o.nota ? ` · ${o.nota}` : ""}</span>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <button onClick={() => onOpenRecipe?.(o.recipeId)} style={btn(C.orange, "#fff", { height: 38, fontSize: 13 })}>Abrir receta y pesar</button>
              {delBtn(o.id)}
            </div>
          </div>
        ))}</>)}

      {list != null && tab === "prod" && (<>
        {porRec.length > 0 && (
          <div style={{ ...card, background: C.cream, border: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".14em", color: C.muted }}>RENDIMIENTO REAL FRENTE A LA RECETA</span>
            {porRec.map(r => <span key={r.name} style={{ fontSize: 13, color: C.ink2 }}><strong style={{ color: C.navy }}>{r.name}</strong> · {r.n} {r.n === 1 ? "vez" : "veces"} · promedio <strong style={{ color: Math.abs(r.prom) > 5 ? C.red : C.green }}>{r.prom > 0 ? "+" : ""}{fmtNum(r.prom, 1)} %</strong>{r.n > 1 ? ` (de ${fmtNum(r.min, 1)} % a ${fmtNum(r.max, 1)} %)` : ""}</span>)}
          </div>
        )}
        {prods.length === 0 ? <span style={small}>Todavía no hay producciones cerradas. Al terminar de pesar una receta de bodega aparece «Cerrar producción».</span>
          : prods.map(p => {
            const fuera = (p.items || []).filter(i => i.how === "aceptado");
            const dif = p.rinde?.plan > 0 && p.rinde?.real > 0 ? ((p.rinde.real - p.rinde.plan) / p.rinde.plan) * 100 : null;
            return (
              <div key={p.id} style={card}>
                <span style={{ fontSize: 15, fontWeight: 800, color: C.navy }}>{p.name}</span>
                <span style={{ fontSize: 13.5, color: C.ink2 }}>★ {p.principal?.name}: {p.principal?.plan != null && Math.abs((p.principal.plan || 0) - (p.principal.real || 0)) > 0.0005 ? <>planeado {fmtGaby(p.principal.plan)} → </> : null}<strong>{fmtGaby(p.principal?.real || 0)} {p.principal?.unit}</strong></span>
                <span style={{ fontSize: 13.5, color: C.ink2 }}>Salió <strong>{fmtGaby(p.rinde?.real || 0)} {p.rinde?.unit}</strong>{p.rinde?.plan > 0 ? ` (la receta decía ${fmtGaby(p.rinde.plan)})` : ""}{dif != null && <strong style={{ color: Math.abs(dif) > 5 ? C.red : C.green }}> {dif > 0 ? "+" : ""}{fmtNum(dif, 1)} %</strong>}</span>
                {fuera.length > 0 && <span style={{ fontSize: 12.5, fontWeight: 700, color: C.orange7 }}>Aceptados fuera de la meta: {fuera.map(i => `${i.name} (${kg3((i.real || 0) / 1000)} en vez de ${kg3((i.meta || 0) / 1000)})`).join(" · ")}</span>}
                <span style={small}>{p.by || "—"} · {fmtFecha(p.at)}{p.nota ? ` · ${p.nota}` : ""}</span>
                {delBtn(p.id)}
              </div>
            );
          })}
      </>)}

      {list != null && tab === "desp" && (<>
        {porProd.length > 0 && (
          <div style={{ ...card, background: C.cream, border: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".14em", color: C.muted }}>MERMA ACUMULADA POR PRODUCTO</span>
            {porProd.map(r => <span key={r.name} style={{ fontSize: 13, color: C.ink2 }}><strong style={{ color: C.navy }}>{r.name}</strong> · {r.n} {r.n === 1 ? "despiece" : "despieces"} · entraron {kg3(r.entra)} KILO · merma <strong style={{ color: r.pct > 5 ? C.red : C.green }}>{kg3(r.merma)} KILO ({pct1(r.pct)})</strong></span>)}
          </div>
        )}
        {desp.length === 0 ? <span style={small}>Todavía no hay despieces. Se hacen desde las fichas «T. DESPIECE …» de Recetas Bodega.</span>
          : desp.map(d => d.unit === "UNIDAD" ? (
            <div key={d.id} style={card}>
              <span style={{ fontSize: 15, fontWeight: 800, color: C.navy }}>{d.name}</span>
              <span style={{ fontSize: 13.5, color: C.ink2 }}>Entraron <strong>{fmtNum(d.entra?.und || 0, 2)} UNIDAD</strong> de {d.entra?.name}{d.merma ? <> · diferencia <strong style={{ color: d.merma.pct > 5 || d.merma.und < 0 ? C.red : C.green }}>{fmtNum(d.merma.und, 2)} UNIDAD ({pct1(d.merma.pct)})</strong></> : null}</span>
              {(d.salidas || []).filter(s => s.q > 0).map((s, i) => <span key={i} style={{ fontSize: 12.5, color: C.ink2 }}>→ {s.name}: {s.unit === "UNIDAD" ? `${fmtNum(s.q, 2)} UNIDAD` : `${kg3(s.q)} KILO`} <span style={{ color: C.muted2 }}>(se esperaba {s.unit === "UNIDAD" ? fmtNum(s.esp, 1) : kg3(s.esp)})</span></span>)}
              <span style={small}>{d.by || "—"} · {fmtFecha(d.at)}{d.nota ? ` · ${d.nota}` : ""}</span>
              {delBtn(d.id)}
            </div>
          ) : (
            <div key={d.id} style={card}>
              <span style={{ fontSize: 15, fontWeight: 800, color: C.navy }}>{d.name}</span>
              <span style={{ fontSize: 13.5, color: C.ink2 }}>Entraron <strong>{kg3(d.entra?.kg)} KILO</strong> de {d.entra?.name} · merma <strong style={{ color: (d.merma?.pct || 0) > 5 || (d.merma?.kg || 0) < 0 ? C.red : C.green }}>{kg3(d.merma?.kg)} KILO ({pct1(d.merma?.pct || 0)})</strong></span>
              {(d.salidas || []).filter(s => s.kg > 0).map((s, i) => <span key={i} style={{ fontSize: 12.5, color: C.ink2 }}>→ {s.name}: {kg3(s.kg)} KILO{s.und > 0 ? ` · ${fmtNum(s.und, 0)} und (${fmtNum((s.kg * 1000) / s.und, 0)} g c/u)` : ""} · {pct1(s.pctReal)} <span style={{ color: C.muted2 }}>(se esperaba {pct1(s.pctEsp)})</span></span>)}
              <span style={small}>{d.by || "—"} · {fmtFecha(d.at)}{d.nota ? ` · ${d.nota}` : ""}</span>
              {delBtn(d.id)}
            </div>
          ))}
      </>)}
    </Sheet>
  );
}

// ═════════════ HOJA DE PESAJE PARA IMPRESORA NORMAL (carta) ═════════════
// Diseño "hoja de pesaje (Carta)". Solo existe al imprimir: en pantalla no se ve.
// rows: [{ code, name, qty, unit ("KILO"|"GR"|"LITRO"|"ML"|"UNIDAD"|…), unitRaw, tipo: "principal"|"exacto"|"rango"|"" }]
const PRINT_CSS = `
.bodega-print-root { display: none; }
@media print {
  @page { size: letter portrait; margin: 11mm 12mm; }
  html, body { background: #fff !important; height: auto !important; overflow: visible !important; }
  body > *:not(.bodega-print-root) { display: none !important; }
  .bodega-print-root { display: block !important; position: static !important; }
  .bodega-print-root, .bodega-print-root * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
  .bodega-print-root .bp-keep { break-inside: avoid; page-break-inside: avoid; }
  .bodega-print-root .bp-box { break-inside: avoid; page-break-inside: avoid; }
}`;
// Área útil de una hoja carta con los márgenes de @page (11 mm arriba/abajo, 12 mm a los lados), en px CSS
const PAGE_W = 725, PAGE_H = 955;
// Imprime SIEMPRE en una sola hoja: si la receta es larga, la hoja completa se reduce hasta que quepa.
export function printHojaBodega() {
  const root = document.querySelector(".bodega-print-root");
  const boxes = root ? [...root.querySelectorAll(".bp-box")] : [];
  if (!root || !boxes.length) { window.print(); return; }
  // medir fuera de pantalla, al ancho real de la hoja
  root.style.cssText = `display:block;position:absolute;left:-10000px;top:0;width:${PAGE_W}px;visibility:hidden`;
  boxes.forEach((box, i) => {
    const sheet = box.querySelector(".bp-sheet");
    box.style.cssText = ""; sheet.style.transform = ""; sheet.style.transformOrigin = "top left";
    let sc = 1;
    for (let k = 0; k < 40; k++) {
      sheet.style.width = `${PAGE_W / sc}px`;
      if (sheet.offsetHeight * sc <= PAGE_H) break;
      sc *= 0.97;
    }
    const h = sheet.offsetHeight;
    const salto = i < boxes.length - 1 ? "break-after:page;page-break-after:always;" : "";
    if (sc < 1) { sheet.style.transform = `scale(${sc})`; box.style.cssText = `width:${PAGE_W}px;height:${Math.ceil(h * sc)}px;overflow:hidden;${salto}`; }
    else { sheet.style.width = ""; box.style.cssText = salto; }
  });
  root.style.cssText = "";
  const done = () => { window.removeEventListener("afterprint", done); boxes.forEach(box => { const sheet = box.querySelector(".bp-sheet"); box.style.cssText = ""; if (sheet) { sheet.style.transform = ""; sheet.style.width = ""; } }); };
  window.addEventListener("afterprint", done);
  setTimeout(() => window.print(), 60);
}
const P = { ink: "#16181d", mid: "#555b65", soft: "#5f6570", label: "#3f444c", line: "#d5d8dd", line2: "#e4e6ea", head: "#f3f4f6", accent: "#B4231F", accentSoft: "#B4231F12" };
const MONO = "'JetBrains Mono', ui-monospace, Menlo, monospace";
const nf = (v, d = 3) => Number(v).toLocaleString("es-CO", { maximumFractionDigits: d, minimumFractionDigits: 0 });
const k3 = (v) => Number(v).toLocaleString("es-CO", { maximumFractionDigits: 5, minimumFractionDigits: 3 });
// Cantidad para la hoja: lo grande arriba (lo que se lee en la pesa) y la equivalencia debajo
function qtyParts(qty, unit, unitRaw) {
  const U = String(unit || "").toUpperCase();
  if (U === "KILO" || U === "GR") {
    const g = U === "KILO" ? qty * 1000 : qty;
    if (g >= 10000) return { main: `${k3(g / 1000)} kg`, sub: `${nf(g, 0)} g`, box: "kg", g };
    return { main: `${nf(g, g < 10 ? 2 : 0)} g`, sub: `${k3(g / 1000)} kilo`, box: "g", g };
  }
  if (U === "LITRO" || U === "ML") {
    const ml = U === "LITRO" ? qty * 1000 : qty;
    if (ml >= 10000) return { main: `${k3(ml / 1000)} L`, sub: `${nf(ml, 0)} ml`, box: "L" };
    return { main: `${nf(ml, ml < 10 ? 2 : 0)} ml`, sub: `${k3(ml / 1000)} litro`, box: "ml" };
  }
  if (U === "UNIDAD") return { main: `${nf(qty, qty >= 50 ? 0 : 2)} unid.`, sub: "", box: "unid." };
  return { main: `${nf(qty, 3)} ${String(unitRaw || unit || "").toLowerCase()}`, sub: "", box: "" };
}
const titleCase = (t) => String(t || "").toLowerCase().replace(/(^|[\s(·/-])([a-záéíóúñ])/g, (m, a, b) => a + b.toUpperCase());

function HojaSheet({ recipe, rows, factor = 1, rinde, principalIdx = -1, tolPct = 5, despiece }) {
  const hoy = new Date().toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
  const lab = { fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", color: P.soft };
  const cap = { fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: P.label };
  const check = (sz = 24) => <span aria-hidden="true" style={{ flex: "none", display: "inline-block", width: sz, height: sz, border: `2px solid ${P.ink}`, borderRadius: 6, background: "#fff" }} />;
  const realBox = (unit, h = 38) => <div style={{ height: h, border: `1.5px solid ${P.ink}`, borderRadius: 8, background: "#fff", display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "0 10px", fontSize: 14, fontWeight: 600, color: P.soft }}>{unit}</div>;
  const prin = principalIdx >= 0 ? rows[principalIdx] : null;
  const rest = rows.filter((_, i) => i !== principalIdx);
  const nameLen = String(recipe.name || "").length;
  const h1 = nameLen <= 16 ? 46 : nameLen <= 24 ? 38 : nameLen <= 34 ? 30 : 25;
  const dense = rest.length > 9;            // muchas filas: un poco más compactas para que quepa en una hoja
  const rowPad = dense ? "8px 20px" : "14px 20px";
  const nEx = rest.filter(r => r.tipo === "exacto").length, nRg = rest.filter(r => r.tipo === "rango").length;
  const resumen = [`${rest.length} ${rest.length === 1 ? "insumo" : "insumos"}`, nRg === 0 && nEx > 0 && nEx === rest.length ? "todos de pesaje exacto" : null, nRg > 0 ? `${nRg} con rango ± ${tolPct} %` : null, nRg > 0 && nEx > 0 ? `${nEx} ${nEx === 1 ? "exacto" : "exactos"}` : null].filter(Boolean).join(" · ");
  const rindeP = rinde ? qtyParts(rinde.qty * factor, rinde.unit, rinde.unitRaw) : null;
  const prinP = prin ? qtyParts(prin.qty, prin.unit, prin.unitRaw) : null;
  const small = rest.some(r => { const q = qtyParts(r.qty, r.unit, r.unitRaw); return q.g != null && q.g < 5; });
  const grid = "44px minmax(0, 1fr) 150px 150px";
  const tipoTag = (r) => {
    if (r.tipo !== "rango") return null;
    const q = qtyParts(r.qty, r.unit, r.unitRaw);
    const rng = q.g != null ? ` · sirve de ${nf(q.g * (1 - tolPct / 100), 0)} a ${nf(q.g * (1 + tolPct / 100), 0)} g` : "";
    return <span style={{ fontSize: 11, fontWeight: 700, color: P.accent }}>rango ± {tolPct} %{rng}</span>;
  };
  const porUnd = despiece?.unit === "UNIDAD";
  const steps = porUnd
    ? [<><b>Cuente</b> las unidades que entran y anótelas.</>, <>Haga el reparto y <b>cuente o pese</b> cada cosa que sale.</>, <>Anote la <b>diferencia</b> y regístrelo en la app.</>]
    : despiece
    ? [<><b>Pese todo</b> lo que entra y anótelo.</>, <>Haga el despiece y <b>pese cada cosa</b> que sale; lo que va por unidades, cuéntelo.</>, <>La <b>merma</b> es lo que entró menos lo que salió. Regístrelo en la app.</>]
    : [<><b>Pese primero</b> el producto principal.</>, <>Si llegó más o menos, <b>anote el peso real</b> y recalcule en la app.</>, <>Pese cada insumo y <b>marque la casilla</b> al terminar.</>];

  return (
      <div className="bp-box"><div className="bp-sheet" style={{ background: "#fff", color: P.ink, fontFamily: "Inter, Manrope, system-ui, sans-serif", display: "flex", flexDirection: "column", gap: dense ? 16 : 22, fontVariantNumeric: "tabular-nums" }}>

        {/* Encabezado */}
        <div className="bp-keep" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24, paddingBottom: 20, borderBottom: `2px solid ${P.ink}` }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.14em" }}>DON TELMO®</span>
              <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#9aa0a8" }} />
              <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", color: P.mid }}>RECETAS BODEGA</span>
            </div>
            <h1 style={{ margin: 0, fontSize: h1, lineHeight: 1, fontWeight: 800, letterSpacing: "-0.02em" }}>{titleCase(recipe.name)}</h1>
            {recipe.subcategory && <div style={{ display: "flex", gap: 8 }}><span style={{ fontSize: 12, fontWeight: 600, padding: "5px 10px", borderRadius: 999, background: P.accentSoft, color: P.accent }}>{recipe.subcategory}</span></div>}
          </div>
          <div style={{ display: "flex", gap: 10, flex: "none" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "10px 14px", border: `1px solid ${P.line}`, borderRadius: 10, minWidth: 112 }}>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: P.soft }}>IMPRESO</span>
              <span style={{ fontSize: 17, fontWeight: 700 }}>{hoy}</span>
            </div>
            {Math.abs(factor - 1) > 1e-9 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "10px 14px", border: `1px solid ${P.line}`, borderRadius: 10, minWidth: 90 }}>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: P.soft }}>RECETA</span>
                <span style={{ fontSize: 17, fontWeight: 700 }}>× {nf(factor, 2)}</span>
              </div>
            )}
            {rindeP && !despiece && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "10px 14px", borderRadius: 10, minWidth: 112, background: P.ink, color: "#fff" }}>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: "#c9ccd2" }}>RINDE</span>
                <span style={{ fontSize: 17, fontWeight: 700, whiteSpace: "nowrap" }}>{rinde.unit === "KILO" ? `${k3(rinde.qty * factor)} kg` : rindeP.main}</span>
              </div>
            )}
          </div>
        </div>

        {/* Cómo usar */}
        <div className="bp-keep" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
          {steps.map((t, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ flex: "none", width: 26, height: 26, borderRadius: "50%", background: P.accent, color: "#fff", fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
              <span style={{ fontSize: 13, lineHeight: 1.4, color: "#2b2f36" }}>{t}</span>
            </div>
          ))}
        </div>

        {/* Producto principal */}
        {prin && (
          <div className="bp-keep" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={lab}>{despiece ? "LO QUE ENTRA" : "PRODUCTO PRINCIPAL"}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "18px 20px", border: `2px solid ${P.accent}`, borderRadius: 14, background: P.accentSoft }}>
              {check(28)}
              <div style={{ flex: "1 1 auto", display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.01em" }}>{titleCase(prin.name)}</span>
                {prin.code && <span style={{ fontFamily: MONO, fontSize: 12, color: P.mid }}>Cód. {prin.code}</span>}
              </div>
              {!despiece && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                  <span style={{ fontSize: 30, fontWeight: 800, lineHeight: 1, letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>{prinP.main}</span>
                  {prinP.sub && <span style={{ fontSize: 12, color: P.mid }}>{prinP.sub}</span>}
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 4, width: 150, flex: "none" }}>
                <span style={cap}>{porUnd ? "CANTIDAD" : "PESO REAL"}</span>
                {realBox(porUnd ? "unid." : despiece ? "kg" : prinP.box, 40)}
              </div>
            </div>
          </div>
        )}

        {/* Insumos */}
        {rest.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
              <span style={lab}>INSUMOS{prin && prinP ? ` · PARA ${prinP.main.toUpperCase()} DE PRINCIPAL` : ""}</span>
              <span style={{ fontSize: 12, color: P.soft }}>{resumen}</span>
            </div>
            <div style={{ border: `1px solid ${P.line}`, borderRadius: 14, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: grid, alignItems: "center", padding: "10px 20px", background: P.head, borderBottom: `1px solid ${P.line}`, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4a4f58" }}>
                <span>✓</span><span>INSUMO</span><span style={{ textAlign: "right", paddingRight: 24 }}>CANTIDAD</span><span>PESO REAL</span>
              </div>
              {rest.map((r, i) => {
                const q = r.qty != null ? qtyParts(r.qty, r.unit, r.unitRaw) : null;
                return (
                  <div key={i} className="bp-keep" style={{ display: "grid", gridTemplateColumns: grid, alignItems: "center", padding: rowPad, borderBottom: i === rest.length - 1 ? 0 : `1px solid ${P.line2}` }}>
                    {check(dense ? 20 : 24)}
                    <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                      <span style={{ fontSize: dense ? 14.5 : 16, fontWeight: 600 }}>{titleCase(r.name)}</span>
                      <span style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                        {r.code && <span style={{ fontFamily: MONO, fontSize: 12, color: P.soft }}>Cód. {r.code}</span>}
                        {tipoTag(r)}
                      </span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, paddingRight: 24 }}>
                      <span style={{ fontSize: dense ? 19 : 22, fontWeight: 800, lineHeight: 1, whiteSpace: "nowrap" }}>{q ? q.main : ""}</span>
                      {q?.sub && <span style={{ fontSize: 12, color: P.soft }}>{q.sub}</span>}
                    </div>
                    {realBox(q ? q.box : "", dense ? 32 : 38)}
                  </div>
                );
              })}
            </div>
            {small && <span style={{ fontSize: 12, color: "#4a4f58" }}>Cantidades menores a 5 g: usar balanza de precisión.</span>}
          </div>
        )}

        {/* Despiece: lo que sale */}
        {despiece?.salidas?.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={lab}>LO QUE SALE</span>
              <span style={{ fontSize: 12, color: P.soft }}>{despiece.salidas.length} {despiece.salidas.length === 1 ? "producto" : "productos"}{porUnd ? "" : " · el % es sobre el peso que entra"}</span>
            </div>
            <div style={{ border: `1px solid ${P.line}`, borderRadius: 14, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 130px 130px 110px", gap: 12, alignItems: "center", padding: "10px 20px", background: P.head, borderBottom: `1px solid ${P.line}`, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#4a4f58" }}>
                <span>PRODUCTO</span><span style={{ textAlign: "right" }}>SE ESPERA</span><span>PESO REAL</span><span>UNIDADES</span>
              </div>
              {despiece.salidas.map((s, i) => (
                <div key={i} className="bp-keep" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 130px 130px 110px", gap: 12, alignItems: "center", padding: "14px 20px", borderBottom: `1px solid ${P.line2}` }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                    <span style={{ fontSize: 16, fontWeight: 600 }}>{titleCase(s.name)}</span>
                    {s.code && <span style={{ fontFamily: MONO, fontSize: 12, color: P.soft }}>Cód. {s.code}</span>}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                    <span style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{porUnd && s.unit !== "UNIDAD" ? `${nf((Number(s.por) || 0) * 1000, 0)} g` : `${nf(Number(s.pct) || 0, 1)} %`}</span>
                    {porUnd && s.unit !== "UNIDAD" && <span style={{ fontSize: 12, color: P.soft }}>por cada unidad</span>}
                    {s.gU > 0 && <span style={{ fontSize: 12, color: P.soft }}>{nf(s.gU, 0)} g por unidad</span>}
                  </div>
                  {porUnd && s.unit === "UNIDAD" ? <span style={{ fontSize: 13, color: "#9aa0a8", textAlign: "center" }}>—</span> : realBox("kg")}
                  {s.unit === "UNIDAD" ? realBox("unid.") : <span style={{ fontSize: 13, color: "#9aa0a8", textAlign: "center" }}>—</span>}
                </div>
              ))}
              <div className="bp-keep" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 130px 130px 110px", gap: 12, alignItems: "center", padding: "14px 20px", background: P.accentSoft }}>
                <span style={{ fontSize: 16, fontWeight: 800 }}>{porUnd ? "Diferencia" : "Merma"} <span style={{ fontWeight: 500, fontSize: 12, color: P.mid }}>(entró − salió)</span></span>
                <span />{realBox(porUnd ? "unid." : "kg")}{realBox("%")}
              </div>
            </div>
          </div>
        )}

        {/* Preparación */}
        {recipe.preparation && !despiece && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={lab}>PREPARACIÓN</span>
            <div style={{ fontSize: 13, lineHeight: 1.55, color: "#2b2f36", whiteSpace: "pre-wrap", border: `1px solid ${P.line}`, borderRadius: 14, padding: "14px 20px" }}>{recipe.preparation}</div>
          </div>
        )}

        {/* Control */}
        <div className="bp-keep" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={lab}>CONTROL DE PRODUCCIÓN</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", border: `1px solid ${P.line}`, borderRadius: 14, overflow: "hidden" }}>
            {[["FECHA", <span key="f" style={{ fontSize: 14, color: "#9aa0a8" }}>___ / ___ / ______</span>],
              [porUnd ? "DIFERENCIA" : despiece ? "MERMA" : "RINDE REAL", <span key="r" style={{ fontSize: 13, color: P.soft, textAlign: "right" }}>{porUnd ? "unid." : despiece ? "kg" : rindeP ? rindeP.box || "" : ""}</span>],
              ["HECHO POR", <span key="h" style={{ fontSize: 12, color: P.soft }}>Nombre y firma</span>],
              ["REVISÓ", <span key="v" style={{ fontSize: 12, color: P.soft }}>Nombre y firma</span>]].map(([t, c], i) => (
              <div key={t} style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: 86, padding: "12px 14px", borderRight: i < 3 ? `1px solid ${P.line}` : 0 }}>
                <span style={cap}>{t}</span>{c}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: P.soft, paddingTop: 4 }}>
            <span>Recetario Don Telmo · Bodega</span><span>{recipe.name} · {hoy}</span>
          </div>
        </div>
      </div></div>
  );
}
const PrintRoot = ({ children }) => createPortal(
  <div className="bodega-print-root">
    <style>{PRINT_CSS}</style>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet" />
    {children}
  </div>, document.body);
// Una hoja (la receta abierta)
export function BodegaPrint(props) { return <PrintRoot><HojaSheet {...props} /></PrintRoot>; }
// Varias hojas, una por página (todas las órdenes pendientes)
export function BodegaPrintMulti({ sheets }) { return <PrintRoot>{sheets.map((sh, i) => <HojaSheet key={i} {...sh} />)}</PrintRoot>; }
