"use client";
import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useBascula } from "@/components/PesajeBascula";
import { useViewport } from "@/hooks/useViewport";
import { parseNumber, fmtGaby, fmtNum } from "@/lib/scaleRecipe";
import { loadUi, saveUi } from "@/lib/session";
import { loadRegistros, addRegistro, updateRegistros, mermaDespiece, fmtFecha, uid } from "@/lib/bodega";

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

// ═════════════ PANEL: ÓRDENES, PRODUCCIONES Y MERMAS ═════════════
export function BodegaRegistros({ isAdmin, onClose, onOpenRecipe }) {
  const [list, setList] = useState(null);
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
    desp.forEach(d => { const k = d.entra?.name || d.name; const a = (m[k] = m[k] || { n: 0, entra: 0, merma: 0 }); a.n++; a.entra += d.entra?.kg || 0; a.merma += d.merma?.kg || 0; });
    return Object.entries(m).map(([name, a]) => ({ name, ...a, pct: a.entra > 0 ? (a.merma / a.entra) * 100 : 0 }));
  }, [desp]);
  // estabilidad de rendimiento por receta
  const porRec = useMemo(() => {
    const m = {};
    prods.forEach(p => { if (!(p.rinde?.plan > 0) || !(p.rinde?.real > 0)) return; const a = (m[p.name] = m[p.name] || { n: 0, difs: [] }); a.n++; a.difs.push(((p.rinde.real - p.rinde.plan) / p.rinde.plan) * 100); });
    return Object.entries(m).map(([name, a]) => ({ name, n: a.n, prom: a.difs.reduce((x, y) => x + y, 0) / a.n, min: Math.min(...a.difs), max: Math.max(...a.difs) }));
  }, [prods]);
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
        : ordenes.map(o => (
          <div key={o.id} style={card}>
            <span style={{ fontSize: 15, fontWeight: 800, color: C.navy }}>{o.name}</span>
            <span style={{ fontSize: 13.5, color: C.ink2 }}><strong>{fmtGaby(o.principal?.plan || 0)} {o.principal?.unit}</strong> de {o.principal?.name}{o.rinde?.plan > 0 ? ` · rinde ${fmtGaby(o.rinde.plan)} ${o.rinde.unit}` : ""}</span>
            <span style={small}>Pedida por {o.by || "—"} · {fmtFecha(o.at)}{o.nota ? ` · ${o.nota}` : ""}</span>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <button onClick={() => onOpenRecipe?.(o.recipeId)} style={btn(C.orange, "#fff", { height: 38, fontSize: 13 })}>Abrir receta y pesar</button>
              {delBtn(o.id)}
            </div>
          </div>
        )))}

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
          : desp.map(d => (
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
