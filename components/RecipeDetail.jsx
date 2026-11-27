"use client";
import { memo, useState, useMemo, useEffect } from "react";
import Image from "next/image";
import { TextToSpeech } from "@/components/TextToSpeech";
import { useLang } from "@/lib/LangContext";
import { generateRecipePDF } from "@/lib/recipePDF";
import { printRecipeThermal } from "@/lib/thermalPrint";
import { normalizeIngredient, ingredientToReadable } from "@/lib/ingredients";
import { parseQty, parseNumber, fmtScaled, fmtNum, fmtGaby, defaultBaseIndex, GRAMS_PER, unitProblem } from "@/lib/scaleRecipe";
import { BasculaEnLista } from "@/components/BasculaEnLista";
import { useViewport } from "@/hooks/useViewport";
import { loadUi, saveUi, keepUiOnClose } from "@/lib/session";
import { useBodegaConfig, useInsumoCats, ingKey, tipoDe, rangoPct, panDeCalculadora, loadRegistros, addRegistro, patchRegistro, fmtFecha, uid } from "@/lib/bodega";
import { PedidoModal, CierreModal, DespiecePanel, BodegaPrint } from "@/components/BodegaExtras";

// ── Rediseño Don Telmo: detalle de receta (modal; bottom sheet en celular) ──
const C = { navy: "#0E2240", navy7: "#16325A", orange: "#D9731A", orange4: "#E8832B", orange3: "#F0A35E", orange7: "#B85E10", orange1: "#FBEBDD", cream: "#F6F3EE", row: "#FAF8F4", line: "#E7E1D7", ink: "#14213D", ink2: "#3C3A36", muted: "#8A847A", muted2: "#A39D92", green: "#1F9D6B", red: "#C8423B" };
const SERIF = "var(--dt-serif, Newsreader, Georgia, serif)";
const SANS = "var(--dt-sans, Manrope, system-ui, sans-serif)";

const Ico = {
  close: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>,
  edit: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>,
  print: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" rx="1" /></svg>,
  pdf: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M12 18v-6M9 15l3 3 3-3" /></svg>,
  trash: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>,
  camera: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>,
  calc: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M8 6h8M8 12h.01M12 12h.01M16 12h.01M8 17h.01M12 17h.01M16 17h.01" /></svg>,
  scale: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v17M7 20h10M5 7h14M5 7l-3 6a3 3 0 0 0 6 0zM19 7l-3 6a3 3 0 0 0 6 0z" /></svg>,
};

function getYtId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\.\w-]+)/);
  return m ? m[1] : null;
}

export const RecipeDetail = memo(function RecipeDetail({ recipe, onClose, onEdit, onDelete, onTogglePublish, currentUser, brandLabel, brandName, companyTagline, onOpenCalc }) {
  const isAdmin = currentUser.role === "admin";
  const { mobile } = useViewport();
  const { t } = useLang();
  const ytId = getYtId(recipe.video);
  const [downloading, setDownloading] = useState(false);

  // ── Calculadora: todo se ajusta en proporción al ingrediente principal ──
  const ings = useMemo(() => (recipe.ingredients || []).map(normalizeIngredient), [recipe.ingredients]);
  const parsed = useMemo(() => ings.map(n => parseQty(n.text)), [ings]);
  // Calcular y pesar son de producción: solo en Recetas Bodega. Las recetas del menú (Adiciones,
  // Hamburguesas, Pizzas…) no los necesitan. La Calculadora de Masas tiene los suyos.
  const isBodega = String(recipe.category || "").trim().toUpperCase() === "RECETAS BODEGA";
  // Producción de bodega: producto principal fijo, tipo de cada insumo (exacto / con rango), órdenes y despieces
  const [cfgAll, patchCfg] = useBodegaConfig(isBodega);
  const cfg = cfgAll[recipe.id] || {};
  const cats = useInsumoCats(isBodega);
  const panId = isBodega ? panDeCalculadora(recipe.name) : null;                      // pan: se hace con la Calculadora de Masas
  const despiece = isBodega && cfg.despiece?.salidas?.length ? cfg.despiece : null;   // ficha de despiece
  const canCalc = isBodega && !panId && !despiece && parsed.some(Boolean);
  const canPesar = canCalc;
  const keys = useMemo(() => ings.map((n, i) => ingKey(n.code, parsed[i]?.name || n.text)), [ings, parsed]);
  // Producto principal: el guardado en la receta; si no hay, el de mayor peso. Solo el admin lo cambia.
  const cfgIdx = cfg.principal ? keys.findIndex((k, i) => k === cfg.principal && parsed[i]) : -1;
  const baseIdx = cfgIdx >= 0 ? cfgIdx : defaultBaseIndex(parsed);
  const tolPct = rangoPct(cfg);
  const tipoOf = (i) => (i === baseIdx ? "principal" : tipoDe(cfg, keys[i], cats[ings[i]?.code]));
  const setPrincipal = (i) => { patchCfg(recipe.id, c => ({ ...c, principal: keys[i] })); setHave(""); setWant(""); };
  const toggleTipo = (i) => { const t = tipoOf(i); if (t === "principal") return; patchCfg(recipe.id, c => ({ ...c, tipos: { ...(c.tipos || {}), [keys[i]]: t === "rango" ? "exacto" : "rango" } })); };
  // Si la app se cerró a mitad de trabajo, se vuelve con la misma cantidad y al pesaje
  const [ui0] = useState(() => { const v = typeof window !== "undefined" ? loadUi("dt_recipe_ui") : null; return v && String(v.id) === String(recipe.id) ? v : null; });
  const [calcOn, setCalcOn] = useState(() => !!ui0?.calcOn);
  const [have, setHave] = useState(() => ui0?.have || "");
  const [want, setWant] = useState("");
  const [pesar, setPesar] = useState(() => !!ui0?.pesar);
  const [orderId, setOrderId] = useState(() => ui0?.orderId || null);   // orden que se está pesando
  const [prinPlan, setPrinPlan] = useState(() => (ui0?.prinPlan != null ? ui0.prinPlan : null)); // lo planeado del principal antes de pesarlo
  const [modal, setModal] = useState(null); // "pedido" | "cierre"
  const [cierreItems, setCierreItems] = useState(null);
  const [ordenes, setOrdenes] = useState([]);
  const [toast, setToast] = useState("");
  const flash = (m) => { setToast(m); setTimeout(() => setToast(""), 3500); };
  useEffect(() => { saveUi("dt_recipe_ui", { id: recipe.id, calcOn, have, pesar, orderId, prinPlan }); }, [recipe.id, calcOn, have, pesar, orderId, prinPlan]);
  useEffect(() => () => { if (!keepUiOnClose()) saveUi("dt_recipe_ui", null); }, []);
  const refreshOrdenes = () => loadRegistros().then(r => { if (r) setOrdenes(r.filter(o => o.kind === "orden" && o.estado === "pendiente" && String(o.recipeId) === String(recipe.id))); });
  useEffect(() => { if (isBodega) refreshOrdenes(); }, [isBodega, recipe.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const base = parsed[baseIdx];
  const haveNum = parseNumber(have);
  const factor = calcOn && canCalc && base && base.qty > 0 && isFinite(haveNum) && haveNum > 0 ? haveNum / base.qty : 1;
  const setFactor = (f) => { if (base) { setHave(fmtGaby(base.qty * f)); setWant(""); } };
  const rinde = parseQty(recipe.portions);
  // "¿Cuánto quieres producir?": se traduce a cantidad del principal
  const onWant = (v) => {
    const t = v.replace(/[^0-9.,]/g, ""); setWant(t);
    const w = parseNumber(t);
    if (base && rinde && rinde.qty > 0 && isFinite(w) && w > 0) setHave(fmtGaby((base.qty * w) / rinde.qty)); else if (!t) setHave("");
  };
  // Filas para pesar en la misma lista: meta en gramos de lo que va en peso; lo demás se mide o se cuenta.
  // El principal va primero: se pesa lo que llegó y con ese peso se recalcula el resto.
  const pesoRowsAll = ings.map((n, i) => {
    const p = parsed[i];
    const sc = p ? fmtScaled(p, factor) : null;
    const grams = p && GRAMS_PER[p.unit] ? Math.round(p.qty * factor * GRAMS_PER[p.unit]) : null;
    return { code: n.code, name: p?.name || n.text, main: sc ? sc.main : "", sub: sc ? sc.sub : "", grams, manual: grams == null ? (sc ? sc.main : n.text) : "", tipo: grams != null ? tipoOf(i) : undefined, tolPct, _i: i };
  });
  const pesoRows = [...pesoRowsAll.filter(r => r.tipo === "principal"), ...pesoRowsAll.filter(r => r.tipo !== "principal")];
  const onPrincipal = (grams) => {
    if (!base || !GRAMS_PER[base.unit]) return;
    setPrinPlan(pl => (pl != null ? pl : base.qty * factor));
    setCalcOn(true); setWant("");
    setHave(fmtGaby(grams / GRAMS_PER[base.unit]));
  };
  const user = currentUser?.username || "";
  const crearOrden = async () => {
    if (!base) return;
    const ok = await addRegistro({ id: uid(), kind: "orden", estado: "pendiente", at: new Date().toISOString(), by: user, recipeId: recipe.id, name: recipe.name,
      principal: { code: ings[baseIdx]?.code || "", name: base.name, unit: base.unitRaw, plan: base.qty * factor },
      rinde: rinde ? { unit: rinde.unitRaw, plan: rinde.qty * factor } : null });
    flash(ok ? "Orden creada ✓ · bodega la ve en «Órdenes y mermas» y en esta receta" : "No se pudo crear la orden (revisá la conexión)");
    if (ok) refreshOrdenes();
  };
  const usarOrden = (o) => { setCalcOn(true); setWant(""); setHave(fmtGaby(o.principal?.plan || 0)); setPrinPlan(o.principal?.plan ?? null); setOrderId(o.id); setPesar(true); };
  const guardarCierre = async (real, nota) => {
    const reg = { id: uid(), kind: "produccion", at: new Date().toISOString(), by: user, recipeId: recipe.id, name: recipe.name, factor, orderId: orderId || null, nota,
      principal: base ? { code: ings[baseIdx]?.code || "", name: base.name, unit: base.unitRaw, plan: prinPlan != null ? prinPlan : base.qty * factor, real: base.qty * factor } : null,
      rinde: { unit: rinde?.unitRaw || "", plan: rinde ? Math.round(rinde.qty * factor * 1000) / 1000 : 0, real },
      items: cierreItems || [] };
    const ok = await addRegistro(reg);
    if (!ok) { flash("No se pudo guardar (revisá la conexión)"); return false; }
    if (orderId) await patchRegistro(orderId, o => ({ ...o, estado: "hecha", doneAt: reg.at, doneBy: user }));
    saveUi("dt_pesaje", null);
    setModal(null); setCierreItems(null); setPesar(false); setOrderId(null); setPrinPlan(null);
    flash("Producción guardada ✓"); refreshOrdenes();
    return true;
  };

  async function handleDownloadPDF() {
    setDownloading(true);
    try { await generateRecipePDF(recipe); } finally { setDownloading(false); }
  }

  const inner = mobile ? 18 : 28;
  const iconBtn = (extra = {}) => ({ width: 40, height: 40, borderRadius: 11, border: 0, background: "rgba(255,255,255,.1)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", ...extra });
  const sectionTitle = { fontFamily: SERIF, fontSize: 22, fontWeight: 600, color: C.navy };
  const textBox = (bg, border, color) => ({ borderRadius: 16, background: bg, border: border ? `1px solid ${border}` : 0, padding: 18, color, fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap" });

  return (
    <div onClick={onClose} className="dt-scope"
      style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(9,24,49,.55)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", animation: "dtFade .25s both", display: "flex", alignItems: mobile ? "flex-end" : "center", justifyContent: "center", padding: mobile ? 0 : 24, fontFamily: SANS }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 960, height: mobile ? "var(--app-height, 100vh)" : undefined, maxHeight: mobile ? "var(--app-height, 100vh)" : "min(calc(var(--app-height, 100vh) * 0.92), 1000px)", background: "#fff", borderRadius: mobile ? 0 : 24, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 40px 80px -20px rgba(0,0,0,.5)", animation: mobile ? "dtSheet .4s cubic-bezier(.2,.8,.2,1) both" : "dtPop .35s cubic-bezier(.2,.8,.2,1) both", color: C.ink }}>

        {/* Header */}
        <div style={{ background: `linear-gradient(160deg, ${C.navy7}, ${C.navy})`, color: "#fff", padding: mobile ? `calc(16px + env(safe-area-inset-top)) ${inner}px 18px` : `22px ${inner}px 20px`, display: "flex", flexDirection: "column", gap: 16, flex: "none" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".24em", color: C.orange3 }}>DON TELMO® · {String(recipe.category || "").toUpperCase()}</span>
              <span style={{ fontFamily: SERIF, fontSize: mobile ? 26 : 34, fontWeight: 600, lineHeight: 1.05, wordBreak: "break-word" }}>{recipe.name}</span>
              {recipe.barcode && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, alignSelf: "flex-start", background: "rgba(255,255,255,.08)", borderRadius: 8, padding: "3px 9px" }}>
                  <span style={{ color: C.orange3, fontSize: 9, fontWeight: 800, letterSpacing: ".12em" }}>BARCODE</span>
                  <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "ui-monospace,Menlo,monospace" }}>{recipe.barcode}</span>
                </span>
              )}
            </div>
            <button onClick={onClose} aria-label="Cerrar" style={iconBtn({ width: 44, height: 44, borderRadius: 12 })}>{Ico.close}</button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {[[t.detail.prep, recipe.prepTime || "—"], [t.detail.cook, recipe.cookTime || "—"], [t.detail.portions, recipe.portions || "—"]].map(([l, v]) => (
              <div key={l} style={{ display: "flex", flexDirection: "column", gap: 2, padding: "8px 14px", borderRadius: 12, background: "rgba(255,255,255,.08)" }}>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,.6)" }}>{l}</span>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {isAdmin && (
              <>
                <button onClick={onTogglePublish} style={{ height: 40, padding: "0 14px", borderRadius: 11, border: 0, background: recipe.published ? C.green : "rgba(255,255,255,.14)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, transition: "all .2s" }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff" }} />{recipe.published ? t.published : t.draft}
                </button>
                <button onClick={onEdit} style={{ height: 40, padding: "0 14px", borderRadius: 11, border: 0, background: C.orange, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>{Ico.edit}Editar</button>
              </>
            )}
            {isBodega && <button onClick={() => window.print()} title="Imprimir en impresora normal (hoja carta), con las cantidades que se ven ahora" style={{ height: 40, padding: "0 14px", borderRadius: 11, border: 0, background: "#fff", color: C.navy, fontWeight: 800, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>{Ico.print}Imprimir hoja</button>}
            <button aria-label="Imprimir" title="Imprimir en impresora térmica 80mm" onClick={() => printRecipeThermal(recipe, { label: brandLabel, name: brandName, tagline: companyTagline })} style={iconBtn()}>{Ico.print}</button>
            <button aria-label="PDF" title="Descargar PDF" onClick={handleDownloadPDF} disabled={downloading} style={iconBtn({ opacity: downloading ? 0.5 : 1, cursor: downloading ? "wait" : "pointer" })}>{Ico.pdf}</button>
            {isAdmin && <button aria-label="Eliminar" title="Eliminar" onClick={onDelete} style={iconBtn({ background: "rgba(200,66,59,.22)", color: "#FFB1AB" })}>{Ico.trash}</button>}
          </div>
        </div>

        {/* Cuerpo */}
        <div style={{ overflowY: "auto", padding: `${inner}px ${inner}px calc(${inner}px + env(safe-area-inset-bottom))`, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 28, alignItems: "start" }}>
          {/* Izquierda: imagen + ingredientes */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
            {recipe.image ? (
              <Image width={800} height={500} src={recipe.image} alt={recipe.name} style={{ width: "100%", height: "auto", aspectRatio: "16/10", objectFit: "cover", borderRadius: 18 }} />
            ) : (
              <div style={{ aspectRatio: "16/10", borderRadius: 18, background: C.cream, border: "1.5px dashed #DCD4C7", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: C.muted2, fontSize: 13 }}>
                {Ico.camera}{t.detail.noImage}
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <span style={sectionTitle}>Ingredientes</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {canCalc && (
                  <button onClick={() => { setCalcOn(c => !c); setHave(""); setWant(""); }} title="Calcular en proporción"
                    style={{ height: 36, padding: "0 12px", borderRadius: 10, border: `1.5px solid ${C.orange}`, background: calcOn ? C.orange : "#fff", color: calcOn ? "#fff" : C.orange, fontWeight: 800, fontSize: 12.5, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "all .2s" }}>
                    {Ico.calc}Calcular
                  </button>
                )}
                {canPesar && (
                  <button onClick={() => setPesar(v => !v)} title="Pesar con la báscula"
                    style={{ height: 36, padding: "0 12px", borderRadius: 10, border: `1.5px solid ${C.green}`, background: pesar ? C.green : "#fff", color: pesar ? "#fff" : C.green, fontWeight: 800, fontSize: 12.5, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", transition: "all .2s" }}>
                    {Ico.scale}{pesar ? "Dejar de pesar" : "Pesar"}
                  </button>
                )}
                <TextToSpeech text={recipe.ingredients.map(ingredientToReadable).join(". ")} label="ingredientes" userId={currentUser?.id} />
              </div>
            </div>

            {toast && <div style={{ borderRadius: 12, background: C.navy, color: "#fff", padding: "10px 14px", fontSize: 13, fontWeight: 700, animation: "dtUp .3s both" }}>{toast}</div>}

            {panId && (
              <div style={{ borderRadius: 16, background: "#FFFAF5", border: "1.5px solid #F1D9C2", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                <span style={{ fontSize: 13.5, color: C.ink2, lineHeight: 1.5 }}><strong style={{ color: C.navy }}>Este pan se produce con la Calculadora de Masas.</strong> La fórmula, las unidades, la biga, el pesaje y las órdenes de producción están allá; lo de abajo es la misma fórmula para la tanda estándar.</span>
                {onOpenCalc && <button onClick={() => onOpenCalc(panId)} style={{ height: 46, borderRadius: 12, border: 0, background: C.orange, color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>{Ico.calc}Abrir en la Calculadora de Masas</button>}
              </div>
            )}

            {canCalc && ordenes.length > 0 && !pesar && ordenes.map(o => (
              <div key={o.id} style={{ borderRadius: 14, background: "#EAF0F8", border: "1.5px solid #C9D6E8", padding: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ flex: 1, minWidth: 160, display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".16em", color: "#3F5E8C" }}>ORDEN PENDIENTE</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: C.navy }}>{fmtGaby(o.principal?.plan || 0)} {o.principal?.unit} de {o.principal?.name}</span>
                  <span style={{ fontSize: 11.5, color: C.muted }}>{o.by || "—"} · {fmtFecha(o.at)}</span>
                </span>
                <button onClick={() => usarOrden(o)} style={{ height: 40, padding: "0 14px", borderRadius: 11, border: 0, background: C.green, color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>{Ico.scale}Pesar esta orden</button>
              </div>
            ))}

            {calcOn && canCalc && base && (
              <div style={{ borderRadius: 16, background: "#FFFAF5", border: "1.5px solid #F1D9C2", padding: 14, display: "flex", flexDirection: "column", gap: 10, animation: "dtUp .3s both" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".16em", color: C.orange7 }}>★ PRODUCTO PRINCIPAL</span>
                  {isAdmin ? (
                    <select value={baseIdx} onChange={e => setPrincipal(Number(e.target.value))} title="Queda guardado en la receta para todos"
                      style={{ height: 44, borderRadius: 11, border: `1.5px solid ${C.line}`, background: "#fff", padding: "0 12px", fontSize: 16, fontWeight: 700, color: C.navy, minWidth: 0 }}>
                      {parsed.map((p, i) => p && <option key={i} value={i}>{p.name || ings[i].text} ({fmtScaled(p, 1).main})</option>)}
                    </select>
                  ) : (
                    <span style={{ fontSize: 16, fontWeight: 800, color: C.navy }}>{base.name} <span style={{ fontSize: 12, fontWeight: 600, color: C.muted }}>({fmtScaled(base, 1).main} en la receta)</span></span>
                  )}
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.navy, whiteSpace: "nowrap" }}>¿Cuánto tienes?</span>
                  <input inputMode="decimal" value={have} placeholder={fmtGaby(base.qty)} onChange={e => { setHave(e.target.value.replace(/[^0-9.,]/g, "")); setWant(""); }} onFocus={e => e.target.select()}
                    style={{ flex: 1, minWidth: 0, height: 48, borderRadius: 12, border: `2px solid ${C.orange}`, background: "#fff", padding: "0 14px", fontSize: 20, fontWeight: 800, color: C.navy, textAlign: "right" }} />
                  <span style={{ fontSize: 13, fontWeight: 800, color: C.navy }}>{base.unitRaw}</span>
                </div>
                {rinde && rinde.qty > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.navy, whiteSpace: "nowrap" }}>¿O cuánto quieres producir?</span>
                    <input inputMode="decimal" value={want || (factor !== 1 ? fmtGaby(Math.round(rinde.qty * factor * 1000) / 1000) : "")} placeholder={fmtGaby(rinde.qty)} onChange={e => onWant(e.target.value)} onFocus={e => e.target.select()}
                      style={{ flex: 1, minWidth: 0, height: 44, borderRadius: 12, border: `1.5px solid ${C.line}`, background: "#fff", padding: "0 14px", fontSize: 17, fontWeight: 800, color: C.navy, textAlign: "right" }} />
                    <span style={{ fontSize: 13, fontWeight: 800, color: C.navy }}>{rinde.unitRaw}</span>
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                  {[0.25, 0.5, 1, 2, 3].map(f => {
                    const on = Math.abs(factor - f) < 1e-9;
                    return <button key={f} onClick={() => setFactor(f)} style={{ height: 32, padding: "0 10px", borderRadius: 9, border: `1.5px solid ${on ? C.navy : C.line}`, background: on ? C.navy : "#fff", color: on ? "#fff" : C.navy, fontSize: 12, fontWeight: 800, cursor: "pointer", transition: "all .2s" }}>×{fmtNum(f, 2)}</button>;
                  })}
                  <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: C.orange7 }}>
                    Receta ×{fmtNum(factor, 2)}{rinde ? ` · rinde ${fmtScaled(rinde, factor).main}` : ""}
                  </span>
                </div>
                {!pesar && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <button onClick={() => setModal("pedido")} style={{ height: 42, borderRadius: 11, border: `1.5px solid ${C.navy}`, background: "#fff", color: C.navy, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>Lista de pedido</button>
                    <button onClick={crearOrden} style={{ height: 42, borderRadius: 11, border: 0, background: C.navy, color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>Crear orden para bodega</button>
                  </div>
                )}
              </div>
            )}

            {canPesar && pesar && ings.length > 0 ? (
              <BasculaEnLista title={recipe.name} rows={pesoRows} onPrincipal={onPrincipal} finishLabel="Cerrar producción" onFinish={(items) => { setCierreItems(items); setModal("cierre"); }} />
            ) : despiece ? (
              <DespiecePanel recipe={recipe} principal={base ? { code: ings[baseIdx]?.code || "", name: base.name } : null} despiece={despiece} currentUser={currentUser} />
            ) : ings.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {ings.map((n, i) => {
                  const p = parsed[i];
                  const isBase = canCalc && i === baseIdx;
                  const tipo = canCalc && p ? tipoOf(i) : null;
                  const sc = p ? fmtScaled(p, factor) : null;
                  return (
                    <div key={i}
                      style={{ display: "flex", alignItems: "center", gap: 10, minHeight: mobile ? 40 : 46, padding: "6px 10px", borderRadius: 12, background: isBase ? "#FFF6EE" : i % 2 ? "#fff" : C.row, border: `1.5px solid ${isBase ? C.orange : "transparent"}`, animation: "dtUp .4s both", animationDelay: `${Math.min(i, 14) * 30}ms`, transition: "all .2s" }}>
                      {n.code && <span style={{ fontFamily: "ui-monospace,Menlo,monospace", fontSize: 10.5, fontWeight: 700, color: C.orange7, background: C.orange1, padding: "3px 7px", borderRadius: 6, flex: "none" }}>{n.code}</span>}
                      <span style={{ flex: 1, minWidth: 0, fontSize: mobile ? 13 : 14, color: C.ink2, lineHeight: 1.3 }}>
                        {sc ? (
                          <><strong style={{ color: C.navy, fontWeight: 800 }}>{sc.main}</strong>{calcOn && sc.sub && <span style={{ fontSize: 11.5, color: C.muted }}> · {sc.sub}</span>} · {p.name}</>
                        ) : n.text}
                      </span>
                      {unitProblem(n.text) && <span title={unitProblem(n.text)} style={{ fontSize: 10.5, fontWeight: 800, color: "#C8423B", background: "#FDECEA", padding: "3px 7px", borderRadius: 6, flex: "none" }}>⚠ unidad</span>}
                      {isBase && <span style={{ fontSize: 10.5, fontWeight: 800, color: C.orange, flex: "none" }}>★ principal</span>}
                      {tipo && tipo !== "principal" && GRAMS_PER[p.unit] && (
                        <button disabled={!isAdmin} onClick={() => toggleTipo(i)} title={isAdmin ? "Tocar para cambiar: exacto ↔ con rango" : tipo === "rango" ? "Se acepta un margen al pesar" : "Solo pasa con el peso exacto"}
                          style={{ fontSize: 10.5, fontWeight: 800, border: 0, borderRadius: 6, padding: "3px 7px", flex: "none", cursor: isAdmin ? "pointer" : "default", color: tipo === "rango" ? "#3F5E8C" : C.muted, background: tipo === "rango" ? "#EAF0F8" : "#F0ECE5" }}>
                          {tipo === "rango" ? `± ${tolPct} %` : "exacto"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ color: C.muted2, fontSize: 13, fontStyle: "italic" }}>{t.detail.noIngredients}</div>
            )}
            {canCalc && !pesar && <span style={{ fontSize: 11.5, color: C.muted2, lineHeight: 1.45 }}>★ principal: se pesa primero y con lo que llegó se recalcula todo · «exacto»: solo pasa con el peso justo · «± {tolPct} %»: acepta ese margen.{isAdmin ? " Tocá la etiqueta de un insumo para cambiarla." : ""} Lo calculado no cambia la receta guardada.</span>}
            {isBodega && <BodegaPrint recipe={recipe} factor={factor} tolPct={tolPct} despiece={despiece} principal={canCalc && base ? base.name : ""}
              rindeTxt={despiece ? "" : rinde ? fmtScaled(rinde, factor).main : recipe.portions}
              rows={ings.map((n, i) => { const p = parsed[i]; const sc = p ? fmtScaled(p, factor) : null; return { code: n.code, name: p?.name || n.text, main: sc ? sc.main : "", sub: sc ? sc.sub : "", tipo: canCalc && p ? (i === baseIdx || GRAMS_PER[p.unit] ? tipoOf(i) : "") : "" }; })} />}
            {modal === "pedido" && <PedidoModal recipeName={recipe.name} rindeTxt={rinde ? `rinde ${fmtScaled(rinde, factor).main}` : ""} lines={ings.map((n, i) => { const p = parsed[i]; return p ? { main: fmtScaled(p, factor).main, name: p.name, code: n.code } : { main: "", name: n.text, code: n.code }; })} onClose={() => setModal(null)} />}
            {modal === "cierre" && <CierreModal recipeName={recipe.name} planQty={rinde ? Math.round(rinde.qty * factor * 1000) / 1000 : 0} unit={rinde?.unitRaw || ""} resumen={base ? `★ ${base.name}: ${fmtGaby(base.qty * factor)} ${base.unitRaw}${prinPlan != null && Math.abs(prinPlan - base.qty * factor) > 0.0005 ? ` (se había planeado ${fmtGaby(prinPlan)})` : ""}` : ""} onSave={guardarCierre} onClose={() => setModal(null)} />}
          </div>

          {/* Derecha: preparación + secciones */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span style={sectionTitle}>Preparación</span>
              {recipe.preparation && <TextToSpeech text={recipe.preparation} label="preparación" userId={currentUser?.id} />}
            </div>
            <div style={{ ...textBox(C.row), minHeight: 140, color: recipe.preparation ? "#333" : C.muted2, fontStyle: recipe.preparation ? "normal" : "italic" }}>
              {recipe.preparation || "Sin instrucciones aún. Toca Editar para agregarlas."}
            </div>

            {recipe.description && <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 6 }}>
                <span style={sectionTitle}>{t.detail.description.charAt(0) + t.detail.description.slice(1).toLowerCase()}</span>
                <TextToSpeech text={recipe.description} label="descripción" userId={currentUser?.id} />
              </div>
              <div style={textBox("#F4F7FB", "#D5DEEA", "#2c3e50")}>{recipe.description}</div>
            </>}

            {recipe.recommendations && <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 6 }}>
                <span style={sectionTitle}>{t.detail.recommendations.charAt(0) + t.detail.recommendations.slice(1).toLowerCase()}</span>
                <TextToSpeech text={recipe.recommendations} label="recomendaciones" userId={currentUser?.id} />
              </div>
              <div style={textBox("#FFFAF5", "#F1D9C2", "#5a3e2b")}>{recipe.recommendations}</div>
            </>}

            {recipe.salesPitch && <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 6 }}>
                <span style={{ ...sectionTitle, color: C.orange }}>Aprende a vender</span>
                <TextToSpeech text={recipe.salesPitch} label="aprende a vender" userId={currentUser?.id} />
              </div>
              <div style={{ ...textBox("#FFF6EE", null, "#5a3e2b"), border: `2px solid ${C.orange}` }}>{recipe.salesPitch}</div>
            </>}

            {recipe.video && <>
              <span style={{ ...sectionTitle, marginTop: 6 }}>Video</span>
              {ytId
                ? <div style={{ borderRadius: 16, overflow: "hidden", aspectRatio: "16/9" }}>
                    <iframe src={`https://www.youtube.com/embed/${ytId}`} style={{ width: "100%", height: "100%", border: "none" }} allowFullScreen title="Video" />
                  </div>
                : <a href={recipe.video} target="_blank" rel="noreferrer" style={{ color: C.orange, fontSize: 13, fontWeight: 700 }}>{t.detail.watchVideo}</a>}
            </>}
          </div>
        </div>
      </div>
    </div>
  );
});
