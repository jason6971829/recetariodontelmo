"use client";
// Órdenes de producción de panadería.
// Alguien pide la orden (qué panes, cuántas unidades, tandas, con o sin biga) y el panadero, en la
// pesa, elige con qué receta empieza: toca "Empezar a pesar" y entra directo al pesaje guiado.
// Cada línea guarda una copia de la fórmula (rec) del momento en que se pidió: así todos los
// equipos pesan lo mismo y sirve para cualquier pan, aunque mañana haya fórmulas distintas.
import { useState, useEffect, useCallback } from "react";
import { BasculaEnLista } from "./BasculaEnLista";
import { loadProdOrders, updateProdOrders } from "@/lib/storage";
import { loadUi, saveUi } from "@/lib/session";

const UI_KEY = "calcpan_orden_ui";
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); return isoDay(d); };
const dayLabel = (f) => {
  if (!f) return "";
  const today = isoDay(new Date());
  if (f === today) return "Hoy";
  if (f === tomorrow()) return "Mañana";
  const s = new Date(f + "T12:00:00").toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "short" });
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const timeLabel = (iso) => { try { return new Date(iso).toLocaleString("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }); } catch { return ""; } };
const doneOf = (line) => (line.hechas || []).length;
export function orderStatus(o) {
  if (o.cancelada) return "cancelada";
  const lines = o.lines || [];
  if (lines.length && lines.every(l => doneOf(l) >= l.tandas)) return "lista";
  if (lines.some(l => doneOf(l) > 0) || o.bigaLista) return "en curso";
  return "pendiente";
}
export const isOpenOrder = (o) => { const s = orderStatus(o); return s === "pendiente" || s === "en curso"; };
const STATUS = {
  pendiente: { bg: "#FBEBDD", fg: "#B85E10", label: "Pendiente" },
  "en curso": { bg: "#E6EEF8", fg: "#16325A", label: "En curso" },
  lista: { bg: "#E3F4EC", fg: "#166E4B", label: "Lista" },
  cancelada: { bg: "#F0ECE5", fg: "#8A847A", label: "Cancelada" },
};

// calc: funciones y estilos de la calculadora (compute, computeBiga, recipeFlour, bigaPrepFromFlour,
// buildPesaje, buildInstrText, resolveRecipe, kg, fmt, num, C, btn, btnGold, inp, sect, SANS, SERIF, DIVISORA)
export function OrdenProduccion({ calc, recipes, visible, currentUser, isAdmin, mobile, renderSheet, onCount }) {
  const { compute, computeBiga, recipeFlour, bigaPrepFromFlour, buildPesaje, buildInstrText, resolveRecipe, kg, fmt, num, C, btn, btnGold, inp, sect, SANS, SERIF, DIVISORA } = calc;
  const user = currentUser?.username || currentUser?.name || "—";
  const [orders, setOrders] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [screen, setScreenRaw] = useState(() => loadUi(UI_KEY)?.screen || { k: "list" });
  const setScreen = (s) => { setScreenRaw(s); saveUi(UI_KEY, { screen: s }); };
  const [confirm, setConfirm] = useState(null); // { text, yes, run }
  const [showInstr, setShowInstr] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const flash = (t) => { setToast(t); setTimeout(() => setToast(""), 2600); };

  const refresh = useCallback(async () => {
    const r = await loadProdOrders();
    if (r == null) { setErr("No se pudieron cargar las órdenes. Revisá la conexión."); return; }
    setErr(""); setOrders(r);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  // Se actualiza sola cada 20 s (menos mientras se pesa, para no interrumpir)
  useEffect(() => {
    if (screen.k === "pesar" || screen.k === "biga" || screen.k === "new") return;
    const t = setInterval(refresh, 20000);
    return () => clearInterval(t);
  }, [screen.k, refresh]);
  useEffect(() => { if (orders) onCount?.(orders.filter(isOpenOrder).length); }, [orders, onCount]);

  const mutate = async (fn, okMsg) => {
    setBusy(true);
    const r = await updateProdOrders(fn);
    setBusy(false);
    if (!r) { flash("No se pudo guardar. Revisá la conexión e intentá de nuevo."); return false; }
    setOrders(r); if (okMsg) flash(okMsg);
    return true;
  };
  const patchOrder = (id, fn, msg) => mutate(list => list.map(o => o.id === id ? fn(o) : o), msg);

  // ── cálculos de una línea y de la biga de la orden ──
  const lineCalc = (l) => {
    const LR = compute(l.rec, "units", l.units, 0);
    const b = l.biga ? computeBiga(l.rec, LR) : null;
    return { LR, b, flour: recipeFlour(l.rec, LR) };
  };
  const orderBiga = (o) => {
    const ls = (o.lines || []).filter(l => l.biga);
    if (!ls.length) return null;
    const flour = ls.reduce((a, l) => a + lineCalc(l).flour * l.tandas, 0);
    return bigaPrepFromFlour(flour);
  };

  const order = screen.id && orders ? orders.find(o => o.id === screen.id) : null;
  const line = order && screen.lineId ? (order.lines || []).find(l => l.id === screen.lineId) : null;
  // Si la orden o la línea ya no existe (la borraron en otro equipo), volver a la lista
  useEffect(() => {
    if (!orders) return;
    if ((screen.k === "order" || screen.k === "biga") && !order) setScreen({ k: "list" });
    if (screen.k === "pesar" && (!order || !line)) setScreen(order ? { k: "order", id: order.id } : { k: "list" });
  }, [orders]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── estilos ──
  const card = { background: "#fff", border: `1.5px solid ${C.line}`, borderRadius: 16, padding: mobile ? 14 : 16 };
  const pill = (s) => { const st = STATUS[s]; return <span style={{ display: "inline-flex", alignItems: "center", height: 24, padding: "0 10px", borderRadius: 999, background: st.bg, color: st.fg, fontSize: 11.5, fontWeight: 800, whiteSpace: "nowrap" }}>{st.label}</span>; };
  const tag = (txt, on) => <span style={{ display: "inline-flex", alignItems: "center", height: 22, padding: "0 8px", borderRadius: 999, background: on ? "#EAF0F8" : C.soft, color: on ? C.navy : C.muted, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>{txt}</span>;
  const bigBtn = { height: 48, borderRadius: 14, border: 0, background: C.gold, color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: SANS, padding: "0 18px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 };
  const back = (to, label) => <button className="calcpan-noprint" style={{ ...btn, height: 40, borderRadius: 12 }} onClick={() => setScreen(to)}>← {label}</button>;
  const lineName = (l) => (l.pan && l.pan.trim()) || l.rec?.name || "Pan";

  const scaleIcon = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v17M7 20h10M5 7h14M5 7l-3 6a3 3 0 0 0 6 0zM19 7l-3 6a3 3 0 0 0 6 0z" /></svg>;

  const toastNode = toast ? <div role="status" style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: "calc(24px + env(safe-area-inset-bottom, 0px))", zIndex: 10050, background: C.navy, color: "#fff", padding: "12px 20px", borderRadius: 999, fontSize: 14, fontWeight: 700, boxShadow: "0 16px 40px -12px rgba(0,0,0,.5)", maxWidth: "90vw" }}>{toast}</div> : null;
  const confirmNode = confirm ? (
    <div role="alertdialog" style={{ ...card, background: "#FDECEA", borderColor: "#e8c5bf", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
      <span style={{ flex: 1, minWidth: 180, fontSize: 13.5, fontWeight: 600, color: "#8e2b20" }}>{confirm.text}</span>
      <button style={btn} onClick={() => setConfirm(null)}>No</button>
      <button style={{ ...btn, background: "#c0392b", borderColor: "#c0392b", color: "#fff" }} onClick={() => { const r = confirm.run; setConfirm(null); r(); }}>{confirm.yes}</button>
    </div>
  ) : null;

  if (!orders) {
    return <div style={{ padding: 30, textAlign: "center", color: C.muted, fontSize: 14 }}>{err || "Cargando órdenes…"}{err && <div style={{ marginTop: 12 }}><button style={btn} onClick={refresh}>Reintentar</button></div>}</div>;
  }

  // ═════════════ PESAR UNA TANDA ═════════════
  if (screen.k === "pesar" && order && line) {
    const { LR, b } = lineCalc(line);
    const G = b ? b.grams : LR.grams;
    const n = Math.min(doneOf(line) + 1, line.tandas);
    const finished = doneOf(line) >= line.tandas;
    const rows = buildPesaje(line.rec, G, b);
    const instr = buildInstrText(line.rec, LR, b);
    const wTxt = fmt(LR.w, LR.r > 0 ? 0 : 1);
    const finish = async (result) => {
      const ok = await patchOrder(order.id, o => ({
        ...o, lines: o.lines.map(l => l.id !== line.id ? l : { ...l, hechas: [...(l.hechas || []), { at: new Date().toISOString(), by: user, pesos: result }] }),
      }), `${lineName(line)}: tanda ${n} lista ✓`);
      if (ok) { saveUi("dt_pesaje", null); setScreen({ k: "order", id: order.id }); }
    };
    return (
      <div className="calcpan-noprint" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>{back({ k: "order", id: order.id }, "Volver a la orden")}</div>
        <div style={{ ...card, background: `linear-gradient(160deg, ${C.navy7}, ${C.navy})`, borderColor: C.navy, color: "#fff" }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".18em", color: "#F0A35E" }}>ORDEN · {dayLabel(order.fecha).toUpperCase()}</div>
          <div style={{ fontFamily: SERIF, fontSize: mobile ? 22 : 26, fontWeight: 600, marginTop: 2 }}>{lineName(line)}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>Tanda {n} de {line.tandas}</span>
            <span style={{ opacity: .5 }}>·</span>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{fmt(LR.units)} unidades</span>
            <span style={{ opacity: .5 }}>·</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: b ? "#9CC3F0" : "#F0A35E" }}>{b ? "Con biga" : "Sin biga"}</span>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: mobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: 8 }}>
          {[["A bolear", wTxt + " g"], ["Boleadora", kg(DIVISORA * LR.w) + " KILO"], ["Masa total", kg(LR.total) + " KILO"], ["Biga madura", b ? kg(b.total) + " KILO" : "—"]].map(([k, v]) => (
            <div key={k} style={{ background: C.row, borderRadius: 12, padding: "8px 10px" }}>
              <div style={{ fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: C.muted, fontWeight: 700 }}>{k}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.navy, fontVariantNumeric: "tabular-nums" }}>{v}</div>
            </div>
          ))}
        </div>
        {b && !order.bigaLista && <div style={{ fontSize: 12.5, fontWeight: 600, color: "#8e5b10", background: "#FFF6E8", border: "1px solid #F3D9AE", borderRadius: 10, padding: "8px 12px" }}>⚠️ La biga de esta orden no está marcada como lista.</div>}
        {(b?.warn || []).map(w => <div key={w} style={{ fontSize: 12, color: "#c0392b", fontWeight: 600 }}>⚠️ {w}</div>)}
        {finished
          ? <div style={{ ...card, textAlign: "center", color: "#166E4B", fontWeight: 700 }}>Todas las tandas de este pan ya están listas.</div>
          : <BasculaEnLista key={`${order.id}-${line.id}-${n}`} title={`Orden ${order.id} · ${lineName(line)} · tanda ${n}`} rows={rows.map(it => ({ code: "", name: it.name, note: it.note || "", main: `${kg(Math.max(5, Math.round(it.grams / 5) * 5))} KILO`, sub: "", grams: it.grams, manual: "" }))}
              onFinish={busy ? undefined : finish} finishLabel={`Terminar tanda ${n} ✓`} />}
        {instr && (
          <div>
            <button style={{ ...btn, height: 42, borderRadius: 12, padding: "0 16px", fontSize: 13 }} onClick={() => setShowInstr(v => !v)}>{showInstr ? "Ocultar instrucciones" : "Ver instrucciones"}</button>
            {showInstr && <div style={{ marginTop: 10, whiteSpace: "pre-wrap", fontSize: 13.5, lineHeight: 1.6, color: C.ink, background: C.row, borderRadius: 14, padding: "14px 16px" }}>{instr}</div>}
          </div>
        )}
        {toastNode}
      </div>
    );
  }

  // ═════════════ PESAR LA BIGA DE LA ORDEN ═════════════
  if (screen.k === "biga" && order) {
    const bp = orderBiga(order);
    if (!bp) { setTimeout(() => setScreen({ k: "order", id: order.id }), 0); return null; }
    const rows = [["Harina (30% + 4%)", bp.harina], ["Agua", bp.agua], ["Levadura fresca", bp.levadura]];
    const finish = async () => {
      const ok = await patchOrder(order.id, o => ({ ...o, bigaLista: { at: new Date().toISOString(), by: user } }), "Biga lista ✓");
      if (ok) { saveUi("dt_pesaje", null); setScreen({ k: "order", id: order.id }); }
    };
    return (
      <div className="calcpan-noprint" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>{back({ k: "order", id: order.id }, "Volver a la orden")}</div>
        <div style={{ ...card, background: "#F4F7FB", borderColor: "#D6E2F0" }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".18em", color: C.gold }}>BIGA · PREPARAR LA TARDE ANTERIOR</div>
          <div style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 600, color: C.navy }}>Una tina: {kg(bp.total)} KILO</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Incluye +4 % por merma de fermentación y tina. Alcanza para todos los panes con biga de esta orden.</div>
        </div>
        <BasculaEnLista title={`Orden ${order.id} · biga`} rows={rows.map(([name, g]) => ({ code: "", name, note: "", main: `${kg(g)} KILO`, sub: "", grams: g, manual: "" }))}
          onFinish={busy ? undefined : finish} finishLabel="Biga lista ✓" />
        {toastNode}
      </div>
    );
  }

  // ═════════════ NUEVA ORDEN ═════════════
  if (screen.k === "new") {
    return <NuevaOrden {...{ calc, recipes, visible, mobile, user, busy, card, back, lineCalc }}
      onSave={async (o) => { const ok = await mutate(list => [o, ...list], "Orden enviada ✓"); if (ok) setScreen({ k: "order", id: o.id }); }} />;
  }

  // ═════════════ DETALLE DE UNA ORDEN ═════════════
  if (screen.k === "order" && order) {
    const st = orderStatus(order);
    const bp = orderBiga(order);
    const canManage = isAdmin || order.createdBy === user;
    const totalT = order.lines.reduce((a, l) => a + l.tandas, 0);
    const sheets = order.lines.flatMap((l, k) => {
      const { LR } = lineCalc(l);
      return Array.from({ length: l.tandas }, (_, t) => renderSheet({ rec: l.rec, LR, pan: lineName(l), biga: !!l.biga },
        `Receta ${k + 1} de ${order.lines.length}${l.tandas > 1 ? ` · Tanda ${t + 1} de ${l.tandas}` : ""}`, `osheet-${l.id}-${t}`));
    });
    return (
      <div>
        <div className="calcpan-noprint" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {back({ k: "list" }, "Órdenes")}
            <button style={{ ...btn, height: 40, borderRadius: 12 }} onClick={() => setTimeout(() => window.print(), 50)}>🖨️ Imprimir {totalT} {totalT === 1 ? "hoja" : "hojas"}</button>
            {canManage && st !== "cancelada" && st !== "lista" && (
              <button style={{ ...btn, height: 40, borderRadius: 12, color: C.red }} onClick={() => setConfirm({ text: "¿Cancelar esta orden? El panadero ya no la verá como pendiente.", yes: "Sí, cancelar", run: () => patchOrder(order.id, o => ({ ...o, cancelada: { at: new Date().toISOString(), by: user } }), "Orden cancelada") })}>Cancelar orden</button>
            )}
            {isAdmin && (st === "cancelada" || st === "lista") && (
              <button style={{ ...btn, height: 40, borderRadius: 12, color: C.red }} onClick={() => setConfirm({ text: "¿Borrar esta orden para siempre?", yes: "Sí, borrar", run: async () => { if (await mutate(list => list.filter(o => o.id !== order.id), "Orden borrada")) setScreen({ k: "list" }); } })}>Borrar</button>
            )}
          </div>
          {confirmNode}
          <div style={{ ...card, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontFamily: SERIF, fontSize: mobile ? 21 : 24, fontWeight: 600, color: C.navy }}>Producción · {dayLabel(order.fecha)}</span>
              <span style={{ marginLeft: "auto" }}>{pill(st)}</span>
            </div>
            <div style={{ fontSize: 12.5, color: C.muted }}>Pedida por <b style={{ color: C.ink }}>{order.createdBy}</b> · {timeLabel(order.createdAt)}</div>
            {order.nota && <div style={{ fontSize: 13.5, color: C.ink, background: C.row, borderRadius: 10, padding: "8px 12px", whiteSpace: "pre-wrap" }}>📝 {order.nota}</div>}
          </div>

          {bp && (
            <div style={{ ...card, background: order.bigaLista ? "#F2FAF6" : "#F4F7FB", borderColor: order.bigaLista ? "#B9E2CF" : "#D6E2F0", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".18em", color: C.gold }}>🌙 BIGA · PREPARAR LA TARDE ANTERIOR</span>
                {order.bigaLista && <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 800, color: "#166E4B" }}>✓ Lista · {order.bigaLista.by}</span>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: mobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: 8 }}>
                {[["Harina (30% + 4%)", bp.harina], ["Agua (50%)", bp.agua], ["Levadura (1%)", bp.levadura], ["Biga total", bp.total]].map(([k, v], i) => (
                  <div key={k} style={{ background: "#fff", borderRadius: 10, padding: "8px 10px" }}>
                    <div style={{ fontSize: 10, letterSpacing: ".06em", textTransform: "uppercase", color: C.muted, fontWeight: 700 }}>{k}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: i === 3 ? C.gold : C.navy, fontVariantNumeric: "tabular-nums" }}>{kg(v)} KILO</div>
                  </div>
                ))}
              </div>
              {st !== "cancelada" && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {!order.bigaLista
                    ? <>
                        <button style={{ ...bigBtn, height: 44, fontSize: 14 }} onClick={() => setScreen({ k: "biga", id: order.id })}>{scaleIcon} Pesar biga</button>
                        <button style={{ ...btn, height: 44, borderRadius: 12 }} disabled={busy} onClick={() => patchOrder(order.id, o => ({ ...o, bigaLista: { at: new Date().toISOString(), by: user } }), "Biga lista ✓")}>Ya está lista ✓</button>
                      </>
                    : <button style={{ ...btn, height: 36 }} disabled={busy} onClick={() => patchOrder(order.id, o => ({ ...o, bigaLista: null }))}>Desmarcar biga</button>}
                </div>
              )}
            </div>
          )}

          <div style={sect}>¿Con cuál empezás?</div>
          {order.lines.map((l) => {
            const { LR, b } = lineCalc(l);
            const done = doneOf(l);
            const complete = done >= l.tandas;
            return (
              <div key={l.id} style={{ ...card, display: "flex", flexDirection: mobile ? "column" : "row", alignItems: mobile ? "stretch" : "center", gap: 12, background: complete ? "#F7FBF9" : "#fff", borderColor: complete ? "#B9E2CF" : C.line }}>
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 5 }}>
                  <div style={{ fontSize: 17, fontWeight: 800, color: C.navy }}>{lineName(l)}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    {tag(`${fmt(l.units)} u × ${l.tandas} ${l.tandas === 1 ? "tanda" : "tandas"}`, true)}
                    {tag(`${fmt(LR.w, LR.r > 0 ? 0 : 1)} g a bolear`, false)}
                    {tag(l.biga ? "Con biga" : "Sin biga", !!l.biga)}
                    {l.rec?.name && l.pan && l.pan.trim() && l.pan.trim().toLowerCase() !== l.rec.name.trim().toLowerCase() && tag(`Fórmula: ${l.rec.name}`, false)}
                  </div>
                  <div style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 2 }}>
                    {Array.from({ length: l.tandas }, (_, t) => (
                      <span key={t} title={l.hechas?.[t] ? `Tanda ${t + 1}: ${l.hechas[t].by} · ${timeLabel(l.hechas[t].at)}` : `Tanda ${t + 1}`}
                        style={{ width: 22, height: 8, borderRadius: 999, background: t < done ? C.green : C.soft }} />
                    ))}
                    <span style={{ fontSize: 12, fontWeight: 700, color: complete ? "#166E4B" : C.muted, marginLeft: 6 }}>
                      {complete ? "✓ Lista" : `${done} de ${l.tandas} ${l.tandas === 1 ? "tanda" : "tandas"}`}
                    </span>
                    {isAdmin && done > 0 && <button title="Deshacer la última tanda" style={{ ...btn, height: 26, padding: "0 8px", fontSize: 11, marginLeft: 4 }} disabled={busy}
                      onClick={() => setConfirm({ text: `¿Deshacer la última tanda marcada de ${lineName(l)}?`, yes: "Sí, deshacer", run: () => patchOrder(order.id, o => ({ ...o, lines: o.lines.map(x => x.id !== l.id ? x : { ...x, hechas: (x.hechas || []).slice(0, -1) }) })) })}>↺</button>}
                  </div>
                  {(b?.warn || []).map(w => <div key={w} style={{ fontSize: 12, color: "#c0392b", fontWeight: 600 }}>⚠️ {w}</div>)}
                </div>
                {!complete && st !== "cancelada" && (
                  <button style={{ ...bigBtn, width: mobile ? "100%" : undefined }} onClick={() => { setShowInstr(false); setScreen({ k: "pesar", id: order.id, lineId: l.id }); }}>
                    {scaleIcon} {done > 0 ? `Pesar tanda ${done + 1}` : "Empezar a pesar"}
                  </button>
                )}
              </div>
            );
          })}
          {toastNode}
        </div>
        {/* Solo impresión: resumen de la orden + biga + una hoja por tanda */}
        <div className="op-print">
          <div style={{ fontFamily: "Georgia,serif", fontSize: 22, fontWeight: 700, color: C.navy }}>Orden de producción · {dayLabel(order.fecha)}</div>
          <div style={{ fontSize: 12, color: "#8a7a6e", margin: "4px 0 10px" }}>Pedida por {order.createdBy} · {timeLabel(order.createdAt)}{order.nota ? ` · ${order.nota}` : ""}</div>
          {order.lines.map(l => <div key={l.id} style={{ fontSize: 13, padding: "3px 0" }}>• {lineName(l)}: {fmt(l.units)} u × {l.tandas} {l.tandas === 1 ? "tanda" : "tandas"} · {l.biga ? "con biga" : "sin biga"}</div>)}
          {bp && <div style={{ marginTop: 10, fontSize: 13 }}><b>Biga (tarde anterior, incluye +4 %):</b> harina {kg(bp.harina)} · agua {kg(bp.agua)} · levadura {kg(bp.levadura)} · total {kg(bp.total)} KILO</div>}
        </div>
        {sheets}
        <style>{`.op-print{display:none}@media print{.op-print{display:block!important}}`}</style>
      </div>
    );
  }

  // ═════════════ LISTA DE ÓRDENES ═════════════
  const open = orders.filter(isOpenOrder).sort((a, b) => (a.fecha || "").localeCompare(b.fecha || "") || (a.createdAt || "").localeCompare(b.createdAt || ""));
  const closed = orders.filter(o => !isOpenOrder(o)).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")).slice(0, 15);
  const orderCard = (o) => {
    const st = orderStatus(o);
    const tot = o.lines.reduce((a, l) => a + l.tandas, 0), dn = o.lines.reduce((a, l) => a + Math.min(doneOf(l), l.tandas), 0);
    return (
      <button key={o.id} onClick={() => setScreen({ k: "order", id: o.id })}
        style={{ ...card, textAlign: "left", cursor: "pointer", fontFamily: SANS, display: "flex", flexDirection: "column", gap: 6, width: "100%", opacity: st === "cancelada" ? 0.6 : 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: C.navy }}>{dayLabel(o.fecha)}</span>
          <span style={{ fontSize: 12, color: C.muted }}>· {o.createdBy}</span>
          <span style={{ marginLeft: "auto" }}>{pill(st)}</span>
        </div>
        <div style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.45 }}>
          {o.lines.map(l => `${lineName(l)} ${fmt(l.units)} u${l.tandas > 1 ? ` ×${l.tandas}` : ""}`).join(" · ")}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
          <div style={{ flex: 1, height: 6, borderRadius: 999, background: C.soft, overflow: "hidden" }}>
            <div style={{ width: `${tot ? (dn / tot) * 100 : 0}%`, height: "100%", background: C.green, transition: "width .4s" }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.muted, whiteSpace: "nowrap" }}>{dn}/{tot} tandas</span>
          {o.lines.some(l => l.biga) && <span style={{ fontSize: 12, fontWeight: 700, color: o.bigaLista ? "#166E4B" : C.gold, whiteSpace: "nowrap" }}>{o.bigaLista ? "Biga ✓" : "Biga pendiente"}</span>}
        </div>
      </button>
    );
  };
  return (
    <div className="calcpan-noprint" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button style={{ ...bigBtn, height: 44, fontSize: 14 }} onClick={() => setScreen({ k: "new" })}>+ Nueva orden</button>
        <button style={{ ...btn, height: 44, borderRadius: 12 }} onClick={refresh}>↻ Actualizar</button>
      </div>
      {err && <div style={{ fontSize: 12.5, color: "#c0392b", fontWeight: 600 }}>{err}</div>}
      <div style={sect}>Por hacer</div>
      {open.length ? open.map(orderCard) : <div style={{ ...card, textAlign: "center", color: C.muted, fontSize: 14 }}>No hay órdenes pendientes.</div>}
      {closed.length > 0 && (
        <>
          <button style={{ ...btn, alignSelf: "flex-start", marginTop: 6 }} onClick={() => setShowDone(v => !v)}>{showDone ? "Ocultar terminadas" : `Ver terminadas y canceladas (${closed.length})`}</button>
          {showDone && closed.map(orderCard)}
        </>
      )}
      {toastNode}
    </div>
  );
}

// ── Formulario para pedir una orden ──
function NuevaOrden({ calc, recipes, visible, mobile, user, busy, card, back, lineCalc, onSave }) {
  const { resolveRecipe, kg, fmt, num, C, btn, inp, sect, SANS } = calc;
  const mkLine = (r) => ({ id: uid(), recipeId: r?.id || "", units: r?.units || 100, tandas: 1, biga: r ? r.biga !== false : true });
  const [fecha, setFecha] = useState(tomorrow);
  const [nota, setNota] = useState("");
  const [lines, setLines] = useState(() => (visible[0] ? [mkLine(visible[0])] : []));
  const patch = (id, p) => setLines(ls => ls.map(l => l.id === id ? { ...l, ...p } : l));
  const lbl = { display: "flex", flexDirection: "column", gap: 4, fontSize: 11, fontWeight: 800, letterSpacing: ".1em", color: C.muted, textTransform: "uppercase" };

  const snapshot = (l) => {
    const raw = recipes.find(r => r.id === l.recipeId);
    const rec = resolveRecipe(raw, recipes);
    if (!rec) return null;
    return { id: uid(), recipeId: raw.id, pan: (raw.pan && raw.pan.trim()) || raw.name, units: Math.max(1, Math.round(num(l.units))), tandas: Math.max(1, Math.round(num(l.tandas) || 1)), biga: !!l.biga, hechas: [],
      rec: { id: rec.id, name: rec.name, ings: (rec.ings || []).map(i => ({ name: i.name, pct: num(i.pct) })), instr: rec.instr || "", wfinal: rec.wfinal, merma: rec.merma, round: rec.round } };
  };
  const valid = lines.length > 0 && lines.every(l => l.recipeId && num(l.units) > 0) && !!fecha;
  const preview = lines.map(l => { const s = snapshot(l); return s ? { s, c: lineCalc(s) } : null; }).filter(Boolean);
  const totalMasa = preview.reduce((a, p) => a + p.c.LR.total * p.s.tandas, 0);

  const submit = () => {
    if (!valid || busy) return;
    const ls = lines.map(snapshot).filter(Boolean);
    onSave({ id: uid(), createdAt: new Date().toISOString(), createdBy: user, fecha, nota: nota.trim(), bigaLista: null, cancelada: null, lines: ls });
  };

  return (
    <div className="calcpan-noprint" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>{back({ k: "list" }, "Órdenes")}</div>
      <div style={sect}>Nueva orden de producción</div>
      <label style={{ ...lbl, maxWidth: 260 }}>Día de producción
        <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={{ ...inp, textAlign: "left" }} />
      </label>
      {lines.map((l, k) => {
        const rec = recipes.find(r => r.id === l.recipeId);
        return (
          <div key={l.id} style={{ ...card, display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "2fr 1fr 1fr auto auto", gap: 10, alignItems: "end" }}>
            <label style={{ ...lbl, gridColumn: mobile ? "1 / -1" : undefined }}>Pan {lines.length > 1 ? k + 1 : ""}
              <select value={l.recipeId} onChange={e => { const r = recipes.find(x => x.id === e.target.value); patch(l.id, { recipeId: e.target.value, units: r?.units || l.units, biga: r ? r.biga !== false : l.biga }); }}
                style={{ ...inp, textAlign: "left", fontSize: 15 }}>
                {visible.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </label>
            <label style={lbl}>Unidades
              <input inputMode="numeric" value={l.units} onChange={e => patch(l.id, { units: e.target.value.replace(/[^\d]/g, "") })} style={inp} />
            </label>
            <label style={lbl}>Tandas
              <input inputMode="numeric" value={l.tandas} onChange={e => patch(l.id, { tandas: e.target.value.replace(/[^\d]/g, "") })} style={inp} />
            </label>
            <label style={{ ...lbl, alignItems: "flex-start" }}>Biga
              <button type="button" onClick={() => patch(l.id, { biga: !l.biga })} aria-pressed={!!l.biga}
                style={{ height: 44, padding: "0 14px", borderRadius: 11, border: `1.5px solid ${l.biga ? C.navy : C.line}`, background: l.biga ? C.navy : "#fff", color: l.biga ? "#fff" : C.muted, fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: SANS, whiteSpace: "nowrap" }}>
                {l.biga ? "Con biga" : "Sin biga"}
              </button>
            </label>
            <button type="button" onClick={() => setLines(ls => ls.filter(x => x.id !== l.id))} title="Quitar" disabled={lines.length < 2}
              style={{ height: 44, width: 44, borderRadius: 11, border: `1.5px solid ${C.line}`, background: "#fff", color: lines.length < 2 ? C.muted2 : C.red, fontSize: 18, cursor: lines.length < 2 ? "default" : "pointer", justifySelf: mobile ? "end" : undefined }}>×</button>
            {rec && <div style={{ gridColumn: "1 / -1", fontSize: 12, color: C.muted }}>
              {(() => { const s = num(l.units) > 0 ? snapshot(l) : null; const c = s && lineCalc(s); return c ? `Masa ${kg(c.LR.total)} KILO por tanda · ${fmt(c.LR.w, c.LR.r > 0 ? 0 : 1)} g a bolear` : ""; })()}
            </div>}
          </div>
        );
      })}
      <button style={{ ...btn, alignSelf: "flex-start", height: 40, borderRadius: 12 }} onClick={() => setLines(ls => [...ls, mkLine(visible[0])])}>+ Agregar otro pan</button>
      <label style={lbl}>Nota para el panadero (opcional)
        <textarea value={nota} onChange={e => setNota(e.target.value)} rows={2} style={{ ...inp, height: "auto", padding: "10px 12px", textAlign: "left", fontWeight: 500, fontSize: 15, resize: "vertical" }} placeholder="Ej.: el pan perro sale primero" />
      </label>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 4 }}>
        <button disabled={!valid || busy} onClick={submit}
          style={{ height: 50, padding: "0 24px", borderRadius: 14, border: 0, background: valid ? C.navy : C.muted2, color: "#fff", fontWeight: 800, fontSize: 15, cursor: valid && !busy ? "pointer" : "not-allowed", fontFamily: SANS }}>
          {busy ? "Enviando…" : "Enviar orden"}
        </button>
        {totalMasa > 0 && <span style={{ fontSize: 13, color: C.muted }}>Masa total de la orden: <b style={{ color: C.navy }}>{kg(totalMasa)} KILO</b></span>}
      </div>
    </div>
  );
}
