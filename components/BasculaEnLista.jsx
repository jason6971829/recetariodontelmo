"use client";
import { useState, useEffect, useRef } from "react";
import { useBascula, BasculaStatus, tolFor } from "@/components/PesajeBascula";

// Pesaje dentro de la misma lista de ingredientes de la receta (sin abrir otra pantalla):
// al lado de cada ingrediente se ve la meta y lo que marca la báscula.
const C = { navy: "#1B3A5C", gold: "#D4721A", line: "#E0D8CE", ink: "#3a2f29", ok: "#1e8e4e", bad: "#c0392b", grey: "#8a7a6e" };
const fmt = (v) => Math.round(v).toLocaleString("es-CO");
const HIST_KEY = "calcpan_pesajes_v1";
// La SAT CS30 marca de a 5 g: todo se pesa en ella y la meta se aproxima al múltiplo de 5 más cercano
const STEP = 5;
export const metaPesa = (g) => Math.max(STEP, Math.round(g / STEP) * STEP);

// rows: [{ code, name, main, sub, grams (número o null), manual (texto si no se pesa) }]
export function BasculaEnLista({ title, rows }) {
  const b = useBascula();
  const weighable = (r) => r.grams != null && r.grams > 0;
  const firstPending = (res, from = 0) => {
    for (let k = 0; k < rows.length; k++) {
      const i = (from + k) % rows.length;
      if (weighable(rows[i]) && !res[i]) return i;
    }
    return -1;
  };
  const [res, setRes] = useState({}); // i -> { actual, how }
  const [cur, setCur] = useState(() => firstPending({}));
  const [base, setBase] = useState(0);
  const wasOk = useRef(false);

  const row = cur >= 0 ? rows[cur] : null;
  const target = row ? metaPesa(row.grams) : 0;
  const tol = tolFor(target);
  const g = b.scaleG - base;
  const diff = g - target;
  const inRange = !!row && b.stable && g > 0 && Math.abs(diff) <= tol;

  useEffect(() => {
    if (inRange && !wasOk.current) {
      try { navigator.vibrate?.(120); } catch { /* */ }
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        const ctx = BasculaEnLista.ctx || (BasculaEnLista.ctx = new Ctx());
        const o = ctx.createOscillator(), gn = ctx.createGain();
        o.frequency.value = 880; gn.gain.value = 0.15; o.connect(gn); gn.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.15);
      } catch { /* */ }
    }
    wasOk.current = inRange;
  }, [inRange]);

  const select = (i) => { setCur(i); setBase(b.scaleG); };
  const mark = (i, entry) => setRes(r => ({ ...r, [i]: entry }));
  const commit = (how) => {
    if (cur < 0) return;
    const next = { ...res, [cur]: { actual: g, how } };
    setRes(next);
    setBase(b.scaleG); // el siguiente arranca desde acá (mismo tazón)
    setCur(firstPending(next, cur + 1));
  };

  const total = rows.length;
  const doneCount = Object.keys(res).length;
  const allDone = doneCount >= total;
  const saved = useRef(false);
  useEffect(() => {
    if (!allDone || saved.current) return;
    saved.current = true;
    try {
      const h = JSON.parse(localStorage.getItem(HIST_KEY) || "[]");
      h.unshift({ at: new Date().toISOString(), title, items: rows.map((r, i) => ({ name: r.name, meta: r.manual || r.grams, real: res[i]?.actual ?? null, how: res[i]?.how })) });
      localStorage.setItem(HIST_KEY, JSON.stringify(h.slice(0, 60)));
    } catch { /* */ }
  }, [allDone]); // eslint-disable-line react-hooks/exhaustive-deps

  let color = C.grey, msg = "";
  if (row && b.live) {
    if (!b.stable) msg = b.moving ? "esperá que se quede quieta…" : "";
    else if (inRange) { color = C.ok; msg = "✅ listo"; }
    else if (diff < 0) { color = C.gold; msg = `faltan ${fmt(-diff)} g`; }
    else { color = C.bad; msg = `sacá ${fmt(diff)} g`; }
  }

  const btn = { border: `1.5px solid ${C.line}`, background: "#fff", color: C.ink, borderRadius: 8, padding: "8px 10px", fontSize: 13, fontWeight: 700, cursor: "pointer" };
  const dim = (off) => (off ? { opacity: 0.4, cursor: "not-allowed" } : null);
  const chk = (on) => ({ ...btn, padding: "5px 8px", fontSize: 12, background: on ? C.ok : "#fff", color: on ? "#fff" : C.ink, borderColor: on ? C.ok : C.line, whiteSpace: "nowrap" });

  return (
    <div>
      {/* barra de la báscula: queda pegada arriba mientras se baja por la lista */}
      <div style={{ position: "sticky", top: 0, zIndex: 3, background: "#fff", border: `2px solid ${row ? color : C.line}`, borderRadius: 10, padding: "6px 10px 10px", marginBottom: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
        <BasculaStatus b={b} compact />
        {row ? (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.grey }}>PESANDO</span>
              <span style={{ fontWeight: 800, color: C.navy, fontSize: 14, flex: 1, minWidth: 0 }}>{row.name}</span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 2 }}>
              <span style={{ fontSize: 34, fontWeight: 800, color, lineHeight: 1, opacity: b.live && !b.moving ? 1 : 0.45 }}>{b.live ? fmt(g) : "—"}</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: C.grey }}>/ {fmt(target)} g{target !== row.grams && <span style={{ fontSize: 11 }}> (receta {fmt(row.grams)} g)</span>}</span>
              <span style={{ marginLeft: "auto", fontSize: 14, fontWeight: 800, color }}>{msg}</span>
            </div>
            <div style={{ position: "relative", height: 10, background: "#f0ebe5", borderRadius: 5, overflow: "hidden", marginTop: 6 }}>
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.max(0, Math.min(1.15, target ? g / target : 0)) / 1.15 * 100}%`, background: color, transition: "width .25s" }} />
              <div style={{ position: "absolute", top: 0, bottom: 0, left: `${100 / 1.15}%`, width: 2, background: C.ink }} />
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              <button style={{ ...btn, flex: 2, background: inRange ? C.ok : "#d9d2c9", borderColor: inRange ? C.ok : "#d9d2c9", color: "#fff", ...dim(!inRange) }} disabled={!inRange} onClick={() => commit("scale")}>✓ Listo</button>
              <button style={{ ...btn, flex: 1, ...dim(!b.stable) }} disabled={!b.stable} onClick={() => setBase(b.scaleG)} title="Al cambiar de recipiente: pone en cero lo que hay en la pesa">⓪ Cero</button>
              <button style={{ ...btn, flex: 1, ...dim(!b.stable || inRange) }} disabled={!b.stable || inRange} onClick={() => commit("aceptado")}>Aceptar así</button>
            </div>
            {b.conn === "sim" && (
              <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "#6b46c1", fontWeight: 700 }}>Simular:</span>
                {[-50, -5, 5, 50, 500].map(d => <button key={d} style={{ ...btn, padding: "3px 7px", fontSize: 11 }} onClick={() => b.setSimG(x => Math.max(0, x + d))}>{d > 0 ? "+" : ""}{d}</button>)}
                <button style={{ ...btn, padding: "3px 7px", fontSize: 11 }} onClick={() => b.setSimG(base + target)}>= meta</button>
              </div>
            )}
          </>
        ) : (
          <div style={{ fontWeight: 800, color: allDone ? C.ok : C.navy, fontSize: 14, marginTop: 4 }}>
            {allDone ? "✅ Todo listo" : "Lo que falta va en litros o unidades: medilo o contalo y marcalo en la lista."}
          </div>
        )}
        <div style={{ fontSize: 11, color: C.grey, marginTop: 6 }}>{doneCount} de {total} listos · la pesa marca de a 5 g, las metas van aproximadas · tocá un ingrediente para pesarlo · otro recipiente: ⓪ Cero</div>
      </div>

      {rows.map((r, i) => {
        const done = res[i];
        const isCur = i === cur;
        const w = weighable(r);
        let right;
        if (isCur) {
          right = <span style={{ fontWeight: 800, color, fontSize: 15 }}>{b.live ? `${fmt(g)} g` : "— g"}</span>;
        } else if (done && done.actual != null) {
          const d = done.actual - metaPesa(r.grams);
          const bad = Math.abs(d) > tolFor(metaPesa(r.grams));
          right = <span style={{ fontWeight: 800, color: bad ? C.bad : C.ok, fontSize: 14 }}>{fmt(done.actual)} g {bad ? `(${d > 0 ? "+" : ""}${fmt(d)})` : "✓"}</span>;
        } else if (!w) {
          right = <button style={chk(!!done)} onClick={(e) => { e.stopPropagation(); done ? setRes(x => { const y = { ...x }; delete y[i]; return y; }) : mark(i, { actual: null, how: "manual" }); }}>{done ? "✓ medido" : "☐ medido"}</button>;
        } else {
          right = <span style={{ color: C.grey, fontSize: 13, fontWeight: 700 }}>—</span>;
        }
        return (
          <div key={i} onClick={w ? () => select(i) : undefined}
            style={{ background: isCur ? "#FFF8F2" : done ? "#EEF8F1" : i % 2 === 0 ? "#F7F3EE" : "#fff", border: `1.5px solid ${isCur ? color : "transparent"}`, padding: "7px 10px", borderRadius: 6, marginBottom: 3, fontSize: 13, color: "#333", lineHeight: 1.35, display: "flex", alignItems: "center", gap: 8, cursor: w ? "pointer" : "default" }}>
            {r.code && <span style={{ background: C.gold, color: "#fff", borderRadius: 4, padding: "2px 7px", fontSize: 10, fontWeight: 700, flexShrink: 0, fontFamily: "monospace" }}>{r.code}</span>}
            <span style={{ flex: 1, minWidth: 0 }}>
              <b style={{ color: C.navy }}>{r.main}</b>{r.sub && <span style={{ color: C.grey, fontSize: 11 }}> · {r.sub}</span>} - {r.name}
            </span>
            <span style={{ flexShrink: 0, textAlign: "right" }}>{right}</span>
          </div>
        );
      })}
    </div>
  );
}
