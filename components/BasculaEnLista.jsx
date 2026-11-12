"use client";
import { useState, useEffect, useRef } from "react";
import { useBascula, tolFor } from "@/components/PesajeBascula";

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
    if (!b.stable) msg = b.moving ? "⏳" : "";
    else if (inRange) { color = C.ok; msg = "✅ listo"; }
    else if (diff < 0) { color = C.gold; msg = `faltan ${fmt(-diff)}`; }
    else { color = C.bad; msg = `sacá ${fmt(diff)}`; }
  }
  if (row && b.live && !b.stable && b.moving) color = g > target + tol ? C.bad : C.gold;

  const btn = { border: `1.5px solid ${C.line}`, background: "#fff", color: C.ink, borderRadius: 7, padding: "6px 8px", fontSize: 12, fontWeight: 700, cursor: "pointer", lineHeight: 1.1 };
  const dim = (off) => (off ? { opacity: 0.4, cursor: "not-allowed" } : null);
  const chk = (on) => ({ ...btn, padding: "3px 7px", fontSize: 11, background: on ? C.ok : "#fff", color: on ? "#fff" : C.ink, borderColor: on ? C.ok : C.line, whiteSpace: "nowrap" });
  const dot = b.conn === "on" ? (b.stale ? C.bad : C.ok) : b.conn === "sim" ? "#6b46c1" : "#bbb";
  const dotTitle = b.conn === "on" ? (b.stale ? "Sin señal de la pesa" : "Pesa conectada") : b.conn === "sim" ? "Modo prueba (sin pesa)" : b.conn === "connecting" ? "Conectando…" : "Pesa sin conectar";

  return (
    <div>
      {/* recuadro de la báscula: compacto y pegado arriba mientras se baja por la lista */}
      <div style={{ position: "sticky", top: 0, zIndex: 3, background: "#fff", border: `2px solid ${row ? color : C.line}`, borderRadius: 10, padding: "7px 9px 8px", marginBottom: 6, boxShadow: "0 3px 10px rgba(0,0,0,0.08)" }}>
        {/* fila 1: estado · ingrediente · progreso */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          <span title={dotTitle} style={{ width: 9, height: 9, borderRadius: "50%", background: dot, flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 800, color: C.navy, flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {row ? row.name : allDone ? "✅ Todo listo" : "Falta medir o contar"}
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.grey, flexShrink: 0 }}>{doneCount}/{total}</span>
          {b.conn !== "on" && b.conn !== "connecting" && (
            <button style={{ ...btn, padding: "4px 8px", fontSize: 11, background: C.gold, borderColor: C.gold, color: "#fff" }} onClick={() => b.connect("auto")}>🔌 Conectar</button>
          )}
          {b.conn === "on" && <button title="Desconectar la pesa" style={{ ...btn, padding: "3px 7px", fontSize: 11, color: C.grey }} onClick={b.stop}>✕</button>}
          {b.conn !== "sim" && b.conn !== "on" && b.conn !== "connecting" && (
            <button title="Probar sin pesa" style={{ ...btn, padding: "4px 7px", fontSize: 11 }} onClick={b.startSim}>🧪</button>
          )}
        </div>
        {b.err && (
          <div style={{ marginTop: 5, padding: "5px 8px", background: "#FDECEA", color: "#8e2b20", fontSize: 11, fontWeight: 600, borderRadius: 6 }}>
            {b.err}{b.conn === "error" && <> · <button style={{ ...btn, padding: "2px 6px", fontSize: 10 }} onClick={() => b.connect(/android/i.test(navigator.userAgent) ? "serial" : "usb")}>otro modo</button></>}
          </div>
        )}

        {row && (
          <>
            {/* fila 2: peso en vivo / meta */}
            <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginTop: 3 }}>
              <span style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1, opacity: b.live ? (b.moving ? 0.7 : 1) : 0.4, fontVariantNumeric: "tabular-nums" }}>{b.live ? fmt(g) : "—"}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.grey }}>/ {fmt(target)} g</span>
              {target !== row.grams && <span style={{ fontSize: 10, color: C.grey }}>(receta {fmt(row.grams)})</span>}
              <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 800, color, whiteSpace: "nowrap" }}>{msg}</span>
            </div>
            <div style={{ position: "relative", height: 6, background: "#f0ebe5", borderRadius: 3, overflow: "hidden", marginTop: 5 }}>
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.max(0, Math.min(1.15, target ? g / target : 0)) / 1.15 * 100}%`, background: color, transition: "width .25s" }} />
              <div style={{ position: "absolute", top: 0, bottom: 0, left: `${100 / 1.15}%`, width: 2, background: C.ink }} />
            </div>
            {/* fila 3: botones */}
            <div style={{ display: "flex", gap: 5, marginTop: 6 }}>
              <button style={{ ...btn, flex: 2, background: inRange ? C.ok : "#d9d2c9", borderColor: inRange ? C.ok : "#d9d2c9", color: "#fff", ...dim(!inRange) }} disabled={!inRange} onClick={() => commit("scale")}>✓ Listo</button>
              <button style={{ ...btn, flex: 1, ...dim(!b.stable) }} disabled={!b.stable} onClick={() => setBase(b.scaleG)} title="Al cambiar de recipiente: pone en cero lo que hay en la pesa">⓪ Cero</button>
              <button style={{ ...btn, flex: 1, ...dim(!b.stable || inRange) }} disabled={!b.stable || inRange} onClick={() => commit("aceptado")}>Aceptar</button>
            </div>
            {b.conn === "sim" && (
              <div style={{ display: "flex", gap: 3, marginTop: 5, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 10, color: "#6b46c1", fontWeight: 700 }}>Simular:</span>
                {[-50, -5, 5, 50, 500].map(d => <button key={d} style={{ ...btn, padding: "2px 6px", fontSize: 10 }} onClick={() => b.setSimG(x => Math.max(0, x + d))}>{d > 0 ? "+" : ""}{d}</button>)}
                <button style={{ ...btn, padding: "2px 6px", fontSize: 10 }} onClick={() => b.setSimG(base + target)}>= meta</button>
              </div>
            )}
          </>
        )}
      </div>
      <div style={{ fontSize: 10, color: C.grey, margin: "0 2px 5px" }}>Tocá un ingrediente para pesarlo · metas de a 5 g · otro recipiente: ⓪ Cero</div>

      {rows.map((r, i) => {
        const done = res[i];
        const isCur = i === cur;
        const w = weighable(r);
        let right;
        if (isCur) {
          right = <span style={{ fontWeight: 800, color, fontSize: 13 }}>{b.live ? `${fmt(g)} g` : "—"}</span>;
        } else if (done && done.actual != null) {
          const d = done.actual - metaPesa(r.grams);
          const bad = Math.abs(d) > tolFor(metaPesa(r.grams));
          right = <span style={{ fontWeight: 800, color: bad ? C.bad : C.ok, fontSize: 12 }}>{fmt(done.actual)} g {bad ? `(${d > 0 ? "+" : ""}${fmt(d)})` : "✓"}</span>;
        } else if (!w) {
          right = <button style={chk(!!done)} onClick={(e) => { e.stopPropagation(); done ? setRes(x => { const y = { ...x }; delete y[i]; return y; }) : mark(i, { actual: null, how: "manual" }); }}>{done ? "✓ medido" : "☐ medido"}</button>;
        } else {
          right = <span style={{ color: "#c9bfb3", fontSize: 12, fontWeight: 700 }}>—</span>;
        }
        return (
          <div key={i} onClick={w ? () => select(i) : undefined}
            style={{ background: isCur ? "#FFF8F2" : done ? "#EEF8F1" : i % 2 === 0 ? "#F7F3EE" : "#fff", border: `1.5px solid ${isCur ? color : "transparent"}`, padding: "5px 8px", borderRadius: 6, marginBottom: 2, fontSize: 12, color: "#333", lineHeight: 1.3, display: "flex", alignItems: "center", gap: 6, cursor: w ? "pointer" : "default" }}>
            {r.code && <span style={{ background: C.gold, color: "#fff", borderRadius: 3, padding: "1px 5px", fontSize: 9, fontWeight: 700, flexShrink: 0, fontFamily: "monospace" }}>{r.code}</span>}
            <span style={{ flex: 1, minWidth: 0 }}>
              <b style={{ color: C.navy }}>{r.main}</b>{r.sub && <span style={{ color: C.grey, fontSize: 10 }}> · {r.sub}</span>} <span style={{ color: "#555" }}>{r.name}</span>
            </span>
            <span style={{ flexShrink: 0, textAlign: "right", minWidth: 54 }}>{right}</span>
          </div>
        );
      })}
    </div>
  );
}
