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
// Cada tanda hecha queda en hechas[] con su número t (las viejas sin t cuentan en orden)
export const tandaDone = (l, t) => (l.hechas || []).some((h, k) => (h.t ?? k) === t);
const doneOf = (l) => Array.from({ length: l.tandas }, (_, t) => tandaDone(l, t)).filter(Boolean).length;
const nextTanda = (l, from = 0) => { for (let k = 0; k < l.tandas; k++) { const t = (from + k) % l.tandas; if (!tandaDone(l, t)) return t; } return -1; };
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
    if (screen.k === "pesar" || screen.k === "biga" || screen.k === "new" || screen.k === "edit") return;
    const t = setInterval(refresh, 20000);
    return () => clearInterval(t);
  }, [screen.k, refresh]);
  useEffect(() => { if (orders) onCount?.(orders.filter(isOpenOrder).length); }, [orders, onCount]);

  const mutate = async (fn, okMsg) => {
    setBusy(true);
    const r = await updateProdOrders(fn);
    setBusy(false);
    if (!r) { flash("No se pudo guardar. Revisá la conexión e intentá de nuevo."); return null; }
    setOrders(r); if (okMsg) flash(okMsg);
    return r;
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
  // confirm: { title, text, items?, warn?, yes, no?, danger?, run } → Gaby pregunta antes de hacerlo
  const confirmNode = confirm ? <GabyDialog C={C} SANS={SANS} SERIF={SERIF} mobile={mobile} {...confirm}
    onNo={() => setConfirm(null)} onYes={() => { const r = confirm.run; setConfirm(null); r(); }} /> : null;

  if (!orders) {
    return <div style={{ padding: 30, textAlign: "center", color: C.muted, fontSize: 14 }}>{err || "Cargando órdenes…"}{err && <div style={{ marginTop: 12 }}><button style={btn} onClick={refresh}>Reintentar</button></div>}</div>;
  }

  // ═════════════ PESAR UNA TANDA ═════════════
  if (screen.k === "pesar" && order && line) {
    const { LR, b } = lineCalc(line);
    const G = b ? b.grams : LR.grams;
    // tanda a pesar: la elegida (si sigue pendiente) o la primera pendiente
    const t = screen.t != null && screen.t < line.tandas && !tandaDone(line, screen.t) ? screen.t : nextTanda(line);
    const n = t + 1;
    const finished = t < 0;
    const rows = buildPesaje(line.rec, G, b);
    const instr = buildInstrText(line.rec, LR, b);
    const wTxt = fmt(LR.w, LR.r > 0 ? 0 : 1);
    const finish = async (result) => {
      const r = await patchOrder(order.id, o => ({
        ...o, lines: o.lines.map(l => l.id !== line.id || tandaDone(l, t) ? l : { ...l, hechas: [...(l.hechas || []), { t, at: new Date().toISOString(), by: user, pesos: result }] }),
      }));
      if (!r) return;
      saveUi("dt_pesaje", null);
      const nl = r.find(o => o.id === order.id)?.lines.find(l => l.id === line.id);
      const nx = nl ? nextTanda(nl, t + 1) : -1;
      if (nx >= 0) { flash(`Tanda ${n} lista ✓ · Sigue la tanda ${nx + 1}`); setScreen({ k: "pesar", id: order.id, lineId: line.id, t: nx }); }
      else { flash(`${lineName(line)}: ${line.tandas > 1 ? "todas las tandas listas" : "lista"} ✓`); setScreen({ k: "order", id: order.id }); }
    };
    const chips = line.tandas > 1 && (
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {Array.from({ length: line.tandas }, (_, k) => {
          const dn = tandaDone(line, k), cur = k === t;
          return (
            <button key={k} disabled={dn || cur} onClick={() => setScreen({ k: "pesar", id: order.id, lineId: line.id, t: k })}
              style={{ height: 38, padding: "0 14px", borderRadius: 999, fontFamily: SANS, fontWeight: 800, fontSize: 13, cursor: dn || cur ? "default" : "pointer",
                border: `1.5px solid ${dn ? "#9AD8BC" : cur ? C.gold : C.line}`, background: dn ? "#E3F4EC" : cur ? "#FBEBDD" : "#fff", color: dn ? "#166E4B" : cur ? C.gold7 || C.gold : C.muted }}>
              {dn ? `Tanda ${k + 1} ✓ hecha` : cur ? `Pesando tanda ${k + 1}` : `Tanda ${k + 1}`}
            </button>
          );
        })}
      </div>
    );
    return (
      <div className="calcpan-noprint" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>{back({ k: "order", id: order.id }, "Volver a la orden")}</div>
        <div style={{ ...card, background: `linear-gradient(160deg, ${C.navy7}, ${C.navy})`, borderColor: C.navy, color: "#fff" }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".18em", color: "#F0A35E" }}>ORDEN · {dayLabel(order.fecha).toUpperCase()}</div>
          <div style={{ fontFamily: SERIF, fontSize: mobile ? 22 : 26, fontWeight: 600, marginTop: 2 }}>{lineName(line)}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{finished ? `${line.tandas} de ${line.tandas} tandas listas` : `Tanda ${n} de ${line.tandas}`}</span>
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
        {chips}
        {b && !order.bigaLista && <div style={{ fontSize: 12.5, fontWeight: 600, color: "#8e5b10", background: "#FFF6E8", border: "1px solid #F3D9AE", borderRadius: 10, padding: "8px 12px" }}>⚠️ La biga de esta orden no está marcada como lista.</div>}
        {(b?.warn || []).map(w => <div key={w} style={{ fontSize: 12, color: "#c0392b", fontWeight: 600 }}>⚠️ {w}</div>)}
        {finished
          ? <div style={{ ...card, textAlign: "center", color: "#166E4B", fontWeight: 700 }}>✓ {line.tandas > 1 ? `Las ${line.tandas} tandas de este pan ya están hechas.` : "Este pan ya está hecho."}</div>
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
  // ═════════════ EDITAR ORDEN ═════════════
  if (screen.k === "edit" && order) {
    const save = (o) => {
      const items = diffOrder(order, o, { lineName, fmt, kg, orderBiga });
      if (!items.length) { flash("No cambiaste nada"); setScreen({ k: "order", id: order.id }); return; }
      const b0 = orderBiga(order), b1 = orderBiga(o);
      setConfirm({
        title: "Esto es lo que cambió en la orden",
        items,
        warn: order.bigaLista && (b0?.total || 0) !== (b1?.total || 0)
          ? `Ojo: la biga ya está pesada (${kg(b0?.total || 0)} KILO). Con estos cambios harían falta ${kg(b1?.total || 0)} KILO.` : "",
        yes: "Sí, guardar", no: "Seguir editando",
        run: async () => {
          // se relee la orden y se respetan las tandas que se hayan pesado mientras se editaba
          const r = await mutate(list => list.map(x => {
            if (x.id !== order.id) return x;
            const lines = o.lines.map(l => {
              const cur = (x.lines || []).find(y => y.id === l.id);
              return cur ? { ...l, hechas: cur.hechas || [] } : l;
            });
            return { ...x, fecha: o.fecha, nota: o.nota, lines, editada: { at: new Date().toISOString(), by: user } };
          }), "Orden actualizada ✓");
          if (r) setScreen({ k: "order", id: order.id });
        },
      });
    };
    return <>
      <NuevaOrden key={order.id} initial={order} {...{ calc, recipes, visible, mobile, user, busy, card, back, lineCalc }} onSave={save} />
      {confirmNode}{toastNode}
    </>;
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
              <>
                <button style={{ ...btn, height: 40, borderRadius: 12 }} onClick={() => setScreen({ k: "edit", id: order.id })}>✏️ Editar orden</button>
                <button style={{ ...btn, height: 40, borderRadius: 12, color: C.red }} onClick={() => setConfirm({
                  title: "¿Seguro que querés cancelar esta orden?",
                  text: `Es la producción de ${dayLabel(order.fecha).toLowerCase()}: ${order.lines.map(l => `${lineName(l)} ${fmt(l.units)} u${l.tandas > 1 ? ` ×${l.tandas}` : ""}`).join(", ")}. El panadero ya no la va a ver como pendiente.`,
                  warn: order.bigaLista ? "Ojo: la biga de esta orden ya está pesada." : (order.lines.some(l => doneOf(l) > 0) ? "Ojo: ya hay tandas pesadas en esta orden." : ""),
                  yes: "Sí, cancelar", no: "No, dejarla", danger: true,
                  run: () => patchOrder(order.id, o => ({ ...o, cancelada: { at: new Date().toISOString(), by: user } }), "Orden cancelada") })}>Cancelar orden</button>
              </>
            )}
            {isAdmin && (st === "cancelada" || st === "lista") && (
              <button style={{ ...btn, height: 40, borderRadius: 12, color: C.red }} onClick={() => setConfirm({ title: "¿Borro esta orden para siempre?", text: "Se quita de la lista y no se puede recuperar.", yes: "Sí, borrar", danger: true, run: async () => { if (await mutate(list => list.filter(o => o.id !== order.id), "Orden borrada")) setScreen({ k: "list" }); } })}>Borrar</button>
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
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 2 }}>
                    {Array.from({ length: l.tandas }, (_, t) => {
                      const h = (l.hechas || []).find((x, k) => (x.t ?? k) === t);
                      const can = !h && st !== "cancelada";
                      return (
                        <button key={t} disabled={!can} title={h ? `Hecha por ${h.by} · ${timeLabel(h.at)}` : `Pesar tanda ${t + 1}`}
                          onClick={() => { setShowInstr(false); setScreen({ k: "pesar", id: order.id, lineId: l.id, t }); }}
                          style={{ height: 30, padding: "0 12px", borderRadius: 999, fontFamily: SANS, fontWeight: 800, fontSize: 12, cursor: can ? "pointer" : "default",
                            border: `1.5px solid ${h ? "#9AD8BC" : C.line}`, background: h ? "#E3F4EC" : "#fff", color: h ? "#166E4B" : C.muted }}>
                          {h ? `Tanda ${t + 1} ✓ hecha` : `Tanda ${t + 1} pendiente`}
                        </button>
                      );
                    })}
                    {complete && <span style={{ fontSize: 12.5, fontWeight: 800, color: "#166E4B" }}>✓ Listo</span>}
                    {isAdmin && done > 0 && <button title="Deshacer la última tanda" style={{ ...btn, height: 30, padding: "0 10px", fontSize: 12 }} disabled={busy}
                      onClick={() => setConfirm({ title: "¿Deshago la última tanda?", text: `La última tanda marcada de ${lineName(l)} vuelve a quedar pendiente.`, yes: "Sí, deshacer", run: () => patchOrder(order.id, o => ({ ...o, lines: o.lines.map(x => x.id !== l.id ? x : { ...x, hechas: (x.hechas || []).slice(0, -1) }) })) })}>↺</button>}
                  </div>
                  {(b?.warn || []).map(w => <div key={w} style={{ fontSize: 12, color: "#c0392b", fontWeight: 600 }}>⚠️ {w}</div>)}
                </div>
                {!complete && st !== "cancelada" && (
                  <button style={{ ...bigBtn, width: mobile ? "100%" : undefined }} onClick={() => { setShowInstr(false); setScreen({ k: "pesar", id: order.id, lineId: l.id, t: nextTanda(l) }); }}>
                    {scaleIcon} {done > 0 ? `Pesar tanda ${nextTanda(l) + 1}` : "Empezar a pesar"}
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
// initial: orden a editar (si viene, el formulario edita en vez de crear)
function NuevaOrden({ calc, recipes, visible, mobile, user, busy, card, back, lineCalc, onSave, initial = null }) {
  const { resolveRecipe, kg, fmt, num, C, btn, inp, sect, SANS } = calc;
  const mkLine = (r) => ({ id: uid(), recipeId: r?.id || "", units: r?.units || 100, tandas: 1, biga: r ? r.biga !== false : true });
  const editing = !!initial;
  const [fecha, setFecha] = useState(() => initial?.fecha || tomorrow());
  const [nota, setNota] = useState(() => initial?.nota || "");
  // al editar, cada línea recuerda la original (orig): se conserva su fórmula guardada y sus tandas hechas
  const [lines, setLines] = useState(() => initial
    ? initial.lines.map(l => ({ id: l.id, recipeId: l.recipeId, units: l.units, tandas: l.tandas, biga: !!l.biga, orig: l }))
    : (visible[0] ? [mkLine(visible[0])] : []));
  const patch = (id, p) => setLines(ls => ls.map(l => l.id === id ? { ...l, ...p } : l));
  const lbl = { display: "flex", flexDirection: "column", gap: 4, fontSize: 11, fontWeight: 800, letterSpacing: ".1em", color: C.muted, textTransform: "uppercase" };

  const snapshot = (l) => {
    const units = Math.max(1, Math.round(num(l.units))), tandas = Math.max(1, Math.round(num(l.tandas) || 1));
    if (l.orig && l.recipeId === l.orig.recipeId) return { ...l.orig, units, tandas, biga: !!l.biga };
    const raw = recipes.find(r => r.id === l.recipeId);
    const rec = resolveRecipe(raw, recipes);
    if (!rec) return null;
    return { id: l.orig?.id || uid(), recipeId: raw.id, pan: (raw.pan && raw.pan.trim()) || raw.name, units: Math.max(1, Math.round(num(l.units))), tandas: Math.max(1, Math.round(num(l.tandas) || 1)), biga: !!l.biga, hechas: [],
      rec: { id: rec.id, name: rec.name, ings: (rec.ings || []).map(i => ({ name: i.name, pct: num(i.pct) })), instr: rec.instr || "", wfinal: rec.wfinal, merma: rec.merma, round: rec.round } };
  };
  const doneOrig = (l) => (l.orig ? Array.from({ length: l.orig.tandas }, (_, t) => tandaDone(l.orig, t)).filter(Boolean).length : 0);
  const valid = lines.length > 0 && lines.every(l => l.recipeId && num(l.units) > 0 && Math.round(num(l.tandas) || 1) >= Math.max(1, doneOrig(l))) && !!fecha;
  const preview = lines.map(l => { const s = snapshot(l); return s ? { s, c: lineCalc(s) } : null; }).filter(Boolean);
  const totalMasa = preview.reduce((a, p) => a + p.c.LR.total * p.s.tandas, 0);

  const submit = () => {
    if (!valid || busy) return;
    const ls = lines.map(snapshot).filter(Boolean);
    if (editing) onSave({ ...initial, fecha, nota: nota.trim(), lines: ls });
    else onSave({ id: uid(), createdAt: new Date().toISOString(), createdBy: user, fecha, nota: nota.trim(), bigaLista: null, cancelada: null, lines: ls });
  };

  return (
    <div className="calcpan-noprint" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>{editing ? back({ k: "order", id: initial.id }, "Volver sin guardar") : back({ k: "list" }, "Órdenes")}</div>
      <div style={sect}>{editing ? "Editar orden de producción" : "Nueva orden de producción"}</div>
      {editing && initial.bigaLista && <div style={{ fontSize: 12.5, fontWeight: 600, color: "#8e5b10", background: "#FFF6E8", border: "1px solid #F3D9AE", borderRadius: 10, padding: "8px 12px" }}>⚠️ La biga de esta orden ya está pesada. Si cambiás unidades, tandas o biga de los panes, la biga necesaria cambia.</div>}
      <label style={{ ...lbl, maxWidth: 260 }}>Día de producción
        <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={{ ...inp, textAlign: "left" }} />
      </label>
      {lines.map((l, k) => {
        const rec = recipes.find(r => r.id === l.recipeId);
        const dn = doneOrig(l);
        return (
          <div key={l.id} style={{ ...card, display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "2fr 1fr 1fr auto auto", gap: 10, alignItems: "end" }}>
            <label style={{ ...lbl, gridColumn: mobile ? "1 / -1" : undefined }}>Pan {lines.length > 1 ? k + 1 : ""}
              <select value={l.recipeId} disabled={dn > 0} title={dn > 0 ? "Ya tiene tandas pesadas: no se puede cambiar el pan" : undefined} onChange={e => { const r = recipes.find(x => x.id === e.target.value); patch(l.id, { recipeId: e.target.value, units: r?.units || l.units, biga: r ? r.biga !== false : l.biga }); }}
                style={{ ...inp, textAlign: "left", fontSize: 15 }}>
                {l.orig && !visible.some(r => r.id === l.orig.recipeId) && <option value={l.orig.recipeId}>{l.orig.pan || l.orig.rec?.name}</option>}
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
            <button type="button" onClick={() => setLines(ls => ls.filter(x => x.id !== l.id))} title={dn > 0 ? "Ya tiene tandas pesadas" : "Quitar"} disabled={lines.length < 2 || dn > 0}
              style={{ height: 44, width: 44, borderRadius: 11, border: `1.5px solid ${C.line}`, background: "#fff", color: lines.length < 2 ? C.muted2 : C.red, fontSize: 18, cursor: lines.length < 2 ? "default" : "pointer", justifySelf: mobile ? "end" : undefined }}>×</button>
            {dn > 0 && <div style={{ gridColumn: "1 / -1", fontSize: 12, fontWeight: 700, color: "#166E4B" }}>✓ {dn} {dn === 1 ? "tanda ya pesada" : "tandas ya pesadas"}: las tandas no pueden ser menos de {dn}.</div>}
            {(rec || l.orig) && <div style={{ gridColumn: "1 / -1", fontSize: 12, color: C.muted }}>
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
          {busy ? "Guardando…" : editing ? "Guardar cambios" : "Enviar orden"}
        </button>
        {totalMasa > 0 && <span style={{ fontSize: 13, color: C.muted }}>Masa total de la orden: <b style={{ color: C.navy }}>{kg(totalMasa)} KILO</b></span>}
      </div>
    </div>
  );
}

// ── Resumen de cambios al editar una orden (lo que Gaby muestra antes de guardar) ──
function diffOrder(a, b, { lineName, fmt, kg, orderBiga }) {
  const out = [];
  const tx = (l) => `${fmt(l.units)} u × ${l.tandas} ${l.tandas === 1 ? "tanda" : "tandas"}, ${l.biga ? "con biga" : "sin biga"}`;
  if (a.fecha !== b.fecha) out.push(`Día: ${dayLabel(a.fecha)} → ${dayLabel(b.fecha)}`);
  if ((a.nota || "") !== (b.nota || "")) out.push(b.nota ? `Nota: «${b.nota}»` : "Se quitó la nota");
  const old = new Map((a.lines || []).map(l => [l.id, l]));
  (b.lines || []).forEach(l => {
    const o = old.get(l.id);
    if (!o) { out.push(`Se agregó ${lineName(l)}: ${tx(l)}`); return; }
    old.delete(l.id);
    const n = lineName(o);
    if (o.recipeId !== l.recipeId) { out.push(`${n} → ${lineName(l)} (${tx(l)})`); return; }
    if (o.units !== l.units) out.push(`${n}: unidades ${fmt(o.units)} → ${fmt(l.units)}`);
    if (o.tandas !== l.tandas) out.push(`${n}: tandas ${o.tandas} → ${l.tandas}`);
    if (!!o.biga !== !!l.biga) out.push(`${n}: ${o.biga ? "con biga" : "sin biga"} → ${l.biga ? "con biga" : "sin biga"}`);
  });
  old.forEach(l => out.push(`Se quitó ${lineName(l)}`));
  if (out.length) {
    const b0 = orderBiga(a)?.total || 0, b1 = orderBiga(b)?.total || 0;
    if (b0 !== b1) out.push(`Biga total: ${kg(b0)} → ${kg(b1)} KILO`);
  }
  return out;
}

// ── Gaby (la asistente) pregunta antes de cancelar o guardar cambios ──
function GabyDialog({ C, SANS, SERIF, mobile, title, text, items, warn, yes = "Sí", no = "No", danger, onYes, onNo }) {
  const [img, setImg] = useState(true);
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onNo(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onNo]);
  return (
    <div className="calcpan-noprint" onClick={onNo} style={{ position: "fixed", inset: 0, zIndex: 10040, background: "rgba(9,24,49,.45)", display: "flex", alignItems: mobile ? "flex-end" : "center", justifyContent: "center", padding: mobile ? 0 : 20, animation: "dtFade .2s both", fontFamily: SANS }}>
      <div role="alertdialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 460, background: "#fff", borderRadius: mobile ? "22px 22px 0 0" : 22, boxShadow: "0 30px 70px -20px rgba(0,0,0,.55)", padding: mobile ? "18px 16px calc(16px + env(safe-area-inset-bottom, 0px))" : 22, display: "flex", flexDirection: "column", gap: 14, animation: "dtPop .3s cubic-bezier(.2,.8,.2,1) both", maxHeight: "calc(var(--app-height, 100vh) * .9)", overflowY: "auto" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <span style={{ width: 58, height: 58, borderRadius: "50%", overflow: "hidden", flex: "none", background: "#FBEBDD", border: `2.5px solid ${C.gold}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>
            {img ? <img src="/chef-avatar.png" alt="Gaby" onError={() => setImg(false)} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "👩‍🍳"}
          </span>
          <div style={{ flex: 1, minWidth: 0, background: C.row, borderRadius: "4px 16px 16px 16px", padding: "10px 14px" }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".16em", color: C.gold }}>GABY</div>
            <div style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 600, color: C.navy, lineHeight: 1.2, marginTop: 2 }}>{title}</div>
            {text && <div style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.45, marginTop: 6 }}>{text}</div>}
          </div>
        </div>
        {items && items.length > 0 && (
          <ul style={{ margin: 0, padding: "10px 14px 10px 30px", background: "#F4F7FB", border: "1px solid #D6E2F0", borderRadius: 14, display: "flex", flexDirection: "column", gap: 6, fontSize: 14, color: C.ink, lineHeight: 1.4 }}>
            {items.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        )}
        {warn && <div style={{ fontSize: 13, fontWeight: 700, color: "#8e5b10", background: "#FFF6E8", border: "1px solid #F3D9AE", borderRadius: 12, padding: "9px 12px" }}>⚠️ {warn}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onNo} style={{ flex: 1, height: 50, borderRadius: 14, border: 0, background: "#EFEAE2", color: "#3C3A36", fontWeight: 800, fontSize: 14.5, cursor: "pointer", fontFamily: SANS }}>{no}</button>
          <button onClick={onYes} autoFocus style={{ flex: 1.4, height: 50, borderRadius: 14, border: 0, background: danger ? "#C8423B" : C.navy, color: "#fff", fontWeight: 800, fontSize: 14.5, cursor: "pointer", fontFamily: SANS }}>{yes}</button>
        </div>
      </div>
    </div>
  );
}
