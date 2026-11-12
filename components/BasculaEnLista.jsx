"use client";
import { useState, useEffect, useRef } from "react";
import { useBascula } from "@/components/PesajeBascula";
import { useViewport } from "@/hooks/useViewport";
import { loadUi, saveUi } from "@/lib/session";
import { touchActivity } from "@/lib/security";

// Panel de Pesaje (rediseño): se usa dentro de la Calculadora de Masas y de la receta, sin abrir otra pantalla.
// La lectura viene de la báscula real (useBascula: Web Serial en computador, WebUSB CH340 en Android).
const C = { navy: "#0E2240", orange: "#D9731A", orange700: "#B85E10", cream: "#F6F3EE", row: "#FAF8F4", line: "#E7E1D7", track: "#EFEAE2", ink2: "#3C3A36", muted: "#8A847A", muted2: "#A39D92", green: "#1F9D6B", green100: "#E7F5EE", red: "#C8423B" };
const fmt = (v) => Math.round(v).toLocaleString("es-CO");
const HIST_KEY = "calcpan_pesajes_v1";
// La SAT CS30 marca de a 5 g: la meta se aproxima al múltiplo de 5 más cercano
const STEP = 5;
export const metaPesa = (g) => Math.max(STEP, Math.round(g / STEP) * STEP);
// Tolerancia del diseño: máx(5 g, 1 % de la meta)
export const tolPesa = (t) => Math.max(5, t * 0.01);

const Check = ({ s = 12, w = 3.4 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
);

// rows: [{ code?, name, main (cantidad a mostrar), sub?, note?, grams (número o null), manual (texto si no se pesa) }]
export function BasculaEnLista({ title, rows }) {
  const b = useBascula();
  const { mobile: compact } = useViewport();
  const weighable = (r) => r.grams != null && r.grams > 0;
  const firstPending = (res, from = 0) => {
    for (let k = 0; k < rows.length; k++) {
      const i = (from + k) % rows.length;
      if (weighable(rows[i]) && res[i] == null) return i;
    }
    return -1;
  };
  // Progreso guardado: si la app se cierra o se recarga a mitad del pesaje, vuelve donde iba
  const sig = `${title}|${rows.map(r => `${r.name}:${r.grams ?? r.manual}`).join(",")}`;
  const [savedRef] = useState(() => ({ v: typeof window !== "undefined" ? loadUi("dt_pesaje") : null })); // copia tomada al abrir
  const saved0 = savedRef.v && savedRef.v.sig === sig ? savedRef.v : null;
  const [res, setRes] = useState(() => saved0?.res || {}); // i -> { actual, how }
  const [cur, setCur] = useState(() => (saved0 && saved0.cur != null ? saved0.cur : firstPending({})));
  const [base, setBase] = useState(() => saved0?.base || 0);
  // la receta puede terminar de cargar un instante después (ej. unidades): si ahí coincide lo guardado, se recupera
  useEffect(() => {
    const v = savedRef.v;
    if (v && v.sig === sig && Object.keys(res).length === 0 && Object.keys(v.res || {}).length > 0) {
      setRes(v.res); setCur(v.cur != null ? v.cur : firstPending(v.res)); setBase(v.base || 0);
      savedRef.v = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  useEffect(() => { saveUi("dt_pesaje", { sig, res, cur, base }); }, [sig, res, cur, base]);
  // al cerrar el pesaje a propósito se borra; si la app se cae, no pasa por acá y queda guardado
  useEffect(() => () => saveUi("dt_pesaje", null), []);

  // Pantalla siempre encendida mientras se pesa + la sesión no se cierra por inactividad
  useEffect(() => {
    let lock = null, alive = true;
    const req = async () => { try { if (alive && document.visibilityState === "visible" && navigator.wakeLock) lock = await navigator.wakeLock.request("screen"); } catch { /* */ } };
    req();
    const onVis = () => { if (document.visibilityState === "visible") req(); };
    document.addEventListener("visibilitychange", onVis);
    const keep = setInterval(() => { try { touchActivity(); } catch { /* */ } }, 60000);
    return () => { alive = false; document.removeEventListener("visibilitychange", onVis); clearInterval(keep); try { lock?.release(); } catch { /* */ } };
  }, []);
  const wasOk = useRef(false);

  const row = cur >= 0 ? rows[cur] : null;
  const t = row ? metaPesa(row.grams) : 0;
  const tol = tolPesa(t);
  const g = b.scaleG - base;
  const diff = g - t;
  const inRange = !!row && b.stable && g > 0 && Math.abs(diff) <= tol;
  const over = diff > tol;

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
  const commit = (how) => {
    if (cur < 0) return;
    const next = { ...res, [cur]: { actual: g, how } };
    setRes(next);
    setBase(b.scaleG); // el siguiente arranca desde acá (mismo tazón)
    setCur(firstPending(next, cur + 1));
  };
  const reset = () => { setRes({}); setBase(b.scaleG); setCur(firstPending({})); };

  const total = rows.length;
  const doneCount = Object.keys(res).length;
  const weighCount = rows.filter(weighable).length;
  const allDone = weighCount > 0 && cur < 0 && rows.every((r, i) => !weighable(r) || res[i] != null);
  const saved = useRef(false);
  useEffect(() => {
    if (!allDone) { saved.current = false; return; }
    if (saved.current) return;
    saved.current = true;
    try {
      const h = JSON.parse(localStorage.getItem(HIST_KEY) || "[]");
      h.unshift({ at: new Date().toISOString(), title, items: rows.map((r, i) => ({ name: r.name, meta: r.manual || r.grams, real: res[i]?.actual ?? null, how: res[i]?.how })) });
      localStorage.setItem(HIST_KEY, JSON.stringify(h.slice(0, 60)));
    } catch { /* */ }
  }, [allDone]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── valores de presentación (tal cual el prototipo PanelPesaje) ──
  const connected = b.live;
  const pad = compact ? 14 : 18, gap = compact ? 10 : 14;
  const readColor = !connected ? C.muted2 : inRange ? C.green : over ? C.red : C.orange;
  const max = t * 1.1 || 1;
  const pill = b.conn === "on"
    ? (b.stale ? { bg: "#FDECEA", fg: C.red, label: "Sin señal", anim: "none" } : { bg: C.green100, fg: C.green, label: "Pesa conectada", anim: "dtGlow 1.6s ease-in-out infinite" })
    : b.conn === "sim" ? { bg: "#EFEAFB", fg: "#6B46C1", label: "Modo prueba", anim: "none" }
    : b.conn === "connecting" ? { bg: "#F0ECE5", fg: C.muted, label: "Conectando…", anim: "none" }
    : { bg: "#F0ECE5", fg: C.muted, label: "Pesa desconectada", anim: "none" };
  const stateLabel = !connected ? "sin señal" : !b.stable && b.moving ? "⏳ midiendo…" : inRange ? "✓ en rango" : over ? `+${fmt(diff)} g de más` : `faltan ${fmt(-diff)} g`;
  const btnOutline = { height: compact ? 44 : 46, borderRadius: 12, border: `1.5px solid ${C.line}`, background: "#FFFFFF", color: C.navy, fontWeight: 700, fontSize: 13.5, cursor: "pointer", whiteSpace: "nowrap" };
  const isOn = b.conn === "on" || b.conn === "sim";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap, fontFamily: "var(--dt-sans)", color: "#14213D" }}>
      {allDone && (
        <div style={{ borderRadius: 18, background: C.green100, border: "1.5px solid #9AD8BC", padding: pad, display: "flex", alignItems: "center", gap: 14, animation: "dtPop .4s both" }}>
          <span style={{ width: 44, height: 44, borderRadius: "50%", background: C.green, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><Check s={22} w={2.6} /></span>
          <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: "#166E4B" }}>Pesaje completo</span>
            <span style={{ fontSize: 12.5, color: "#2F7A5A" }}>{doneCount} de {total} ingredientes listos</span>
          </span>
          <button onClick={reset} style={{ height: 40, padding: "0 14px", borderRadius: 11, border: "1.5px solid #9AD8BC", background: "#fff", color: "#166E4B", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Reiniciar</button>
        </div>
      )}

      {!allDone && (
        <div style={{ position: "sticky", top: 0, zIndex: 3, borderRadius: 18, background: "#FFFFFF", border: `1.5px solid ${inRange ? C.green : C.orange}`, boxShadow: "0 18px 36px -22px rgba(217,115,26,.55)", padding: pad, display: "flex", flexDirection: "column", gap: compact ? 10 : 12, transition: "border-color .3s" }}>
          {/* 1. estado */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 7, height: 28, padding: "0 11px", borderRadius: 999, background: pill.bg, color: pill.fg, fontSize: 12, fontWeight: 800 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: pill.fg, animation: pill.anim }} />{pill.label}
            </span>
            {row && <span style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>Paso {Math.min(doneCount + 1, total)} de {total}</span>}
            <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              {!isOn && b.conn !== "connecting" && (
                <button onClick={b.startSim} title="Probar sin pesa" style={{ height: 32, padding: "0 10px", borderRadius: 9, border: `1px solid ${C.line}`, background: "#fff", color: C.muted, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Probar</button>
              )}
              <button onClick={() => (isOn ? b.stop() : b.connect("auto"))}
                style={{ height: 32, padding: "0 12px", borderRadius: 9, border: `1px solid ${isOn ? C.line : C.orange}`, background: isOn ? "#fff" : C.orange, color: isOn ? "#6E6A63" : "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                {isOn ? "Desconectar" : "Conectar"}
              </button>
            </span>
          </div>
          {b.err && (
            <div style={{ padding: "7px 10px", background: "#FDECEA", color: "#8e2b20", fontSize: 12, fontWeight: 600, borderRadius: 10 }}>
              {b.err}{b.conn === "error" && <> · <button style={{ border: 0, background: "none", color: "#8e2b20", textDecoration: "underline", fontWeight: 700, cursor: "pointer", padding: 0, fontSize: 12 }} onClick={() => b.connect(/android/i.test(navigator.userAgent) ? "serial" : "usb")}>probar otro modo</button></>}
            </div>
          )}

          {row ? (
            <>
              {/* 2. pesando */}
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".2em", color: C.muted2 }}>PESANDO</span>
                <span style={{ fontSize: compact ? 16 : 19, fontWeight: 800, color: C.navy, lineHeight: 1.2 }}>{row.name}</span>
                {row.note && <span style={{ fontSize: 12, fontWeight: 600, color: C.orange700 }}>{row.note}</span>}
              </div>
              {/* 3. lectura */}
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 10, padding: "12px 14px", borderRadius: 14, background: C.cream }}>
                <span style={{ display: "flex", alignItems: "baseline", gap: 4, fontVariantNumeric: "tabular-nums", opacity: connected ? (b.moving ? 0.75 : 1) : 0.5 }}>
                  <span style={{ fontSize: compact ? 44 : 56, fontWeight: 800, lineHeight: 0.9, color: readColor, letterSpacing: "-.02em", transition: "color .25s" }}>{connected ? fmt(g) : "0"}</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: C.muted }}>g</span>
                </span>
                <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, textAlign: "right" }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.muted }}>meta <strong style={{ color: C.navy, fontSize: 14 }}>{fmt(t)} g</strong></span>
                  {t !== row.grams && <span style={{ fontSize: 10.5, color: C.muted2 }}>receta {fmt(row.grams)} g</span>}
                  <span style={{ fontSize: 14, fontWeight: 800, color: readColor }}>{stateLabel}</span>
                </span>
              </div>
              {/* 4. barra: escala = meta × 1,1; banda verde = ± tolerancia; línea navy en la meta */}
              <div style={{ position: "relative", height: 10, borderRadius: 999, background: C.track, overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 0, bottom: 0, left: `${((t - tol) / max) * 100}%`, width: `${((tol * 2) / max) * 100}%`, background: "rgba(31,157,107,.22)" }} />
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.max(0, Math.min(100, (g / max) * 100))}%`, borderRadius: 999, background: readColor, transition: "width .14s linear, background .25s" }} />
                <div style={{ position: "absolute", top: -2, bottom: -2, left: `${(t / max) * 100}%`, width: 2, background: C.navy }} />
              </div>
              {/* 5. botones */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.3fr", gap: 8 }}>
                <button style={{ ...btnOutline, opacity: b.stable ? 1 : 0.5 }} disabled={!b.stable} onClick={() => setBase(b.scaleG)} title="Al cambiar de recipiente: pone en cero lo que hay en la pesa">Cero</button>
                <button style={{ ...btnOutline, opacity: b.stable && !inRange ? 1 : 0.5 }} disabled={!b.stable || inRange} onClick={() => commit("aceptado")}>Aceptar así</button>
                <button disabled={!inRange} onClick={() => commit("scale")}
                  style={{ height: compact ? 44 : 46, borderRadius: 12, border: 0, background: inRange ? C.green : C.navy, color: "#fff", fontWeight: 800, fontSize: 14, cursor: inRange ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: inRange ? 1 : 0.4, transition: "all .25s" }}>
                  <Check s={16} w={2.8} />Listo
                </button>
              </div>
              {b.conn === "sim" && (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "#6B46C1", fontWeight: 700 }}>Simular:</span>
                  {[-50, -5, 5, 50, 500].map(d => <button key={d} style={{ height: 26, padding: "0 8px", borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }} onClick={() => b.setSimG(x => Math.max(0, x + d))}>{d > 0 ? "+" : ""}{d}</button>)}
                  <button style={{ height: 26, padding: "0 8px", borderRadius: 8, border: `1px solid ${C.line}`, background: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }} onClick={() => b.setSimG(base + t)}>= meta</button>
                </div>
              )}
              <span style={{ fontSize: 11.5, color: C.muted2, lineHeight: 1.45 }}>La pesa marca de a 5 g · toca un ingrediente para pesarlo · otro recipiente: pulsa Cero</span>
            </>
          ) : (
            <span style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>Lo que falta va en litros o unidades: márcalo en la lista cuando lo midas.</span>
          )}
        </div>
      )}

      {/* 7. progreso */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "2px 2px 0" }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: C.navy, whiteSpace: "nowrap" }}>{doneCount} de {total} listos</span>
        <div style={{ flex: 1, height: 4, borderRadius: 999, background: C.track, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${total ? (doneCount / total) * 100 : 0}%`, background: C.green, borderRadius: 999, transition: "width .4s" }} />
        </div>
      </div>

      {/* 8. lista de pasos */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {rows.map((r, i) => {
          const d = res[i];
          const unit = !weighable(r);
          const isCur = i === cur && !unit;
          const hecho = d != null;
          const tap = () => {
            if (unit) { setRes(x => { const y = { ...x }; if (y[i] != null) delete y[i]; else y[i] = { actual: null, how: "manual" }; return y; }); return; }
            if (hecho) setRes(x => { const y = { ...x }; delete y[i]; return y; });
            select(i);
          };
          let right, rightColor;
          if (unit) { right = hecho ? "medido" : "marcar"; rightColor = hecho ? C.green : C.muted; }
          else if (hecho) {
            const dv = d.actual - metaPesa(r.grams);
            const bad = Math.abs(dv) > tolPesa(metaPesa(r.grams));
            right = `${fmt(d.actual)} g${bad ? ` (${dv > 0 ? "+" : ""}${fmt(dv)})` : ""}`; rightColor = bad ? C.red : C.green;
          } else if (isCur) { right = connected ? `${fmt(g)} g` : "—"; rightColor = C.orange; }
          else { right = "—"; rightColor = "#C9C2B6"; }
          return (
            <div key={i} onClick={tap}
              style={{ display: "flex", alignItems: "center", gap: 10, minHeight: compact ? 42 : 48, padding: "6px 10px", borderRadius: 12, background: isCur ? "#FFF6EE" : hecho ? "#FFFFFF" : i % 2 ? "#FFFFFF" : C.row, border: `1.5px solid ${isCur ? C.orange : "transparent"}`, cursor: "pointer", transition: "all .2s", opacity: hecho && !unit ? 0.7 : 1 }}>
              <span style={{ width: 22, height: 22, borderRadius: unit ? 6 : "50%", flex: "none", display: "flex", alignItems: "center", justifyContent: "center", background: hecho ? C.green : isCur ? "#fff" : "transparent", border: `2px solid ${hecho ? C.green : isCur ? C.orange : "#D6D0C6"}`, color: "#fff" }}>
                {hecho && <Check />}
              </span>
              {r.code && <span style={{ fontFamily: "ui-monospace,Menlo,monospace", fontSize: 10.5, fontWeight: 700, color: C.orange700, background: "#FBEBDD", padding: "3px 7px", borderRadius: 6, flex: "none" }}>{r.code}</span>}
              <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
                <span style={{ fontSize: compact ? 13 : 14, color: C.ink2, lineHeight: 1.3 }}><strong style={{ color: C.navy, fontWeight: 800 }}>{r.main}</strong>{r.sub && <span style={{ fontSize: 11.5, color: C.muted }}> · {r.sub}</span>} · {r.name}</span>
                {r.note && <span style={{ fontSize: 11, fontWeight: 600, color: C.orange700 }}>{r.note}</span>}
              </span>
              <span style={{ fontSize: 13, fontWeight: 800, color: rightColor, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{right}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
