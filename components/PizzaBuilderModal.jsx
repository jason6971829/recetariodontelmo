"use client";
import { useState, useMemo, useRef, useCallback } from "react";

/* ─── Tamaños ─── */
const SIZES = {
  c: { label: "Completa", cm: 50, portions: 8 },
  m: { label: "Mediana",  cm: 40, portions: 8 },
  p: { label: "Personal", cm: 27, portions: 4 },
};

/* ─── Configuraciones ─── */
const ALL_CFGS = [
  { id: 0, label: "8 porciones", sub: "1 sabor",   p: [8] },
  { id: 1, label: "5 + 3",       sub: "2 sabores", p: [5, 3] },
  { id: 2, label: "2+2+2+2",     sub: "4 sabores", p: [2, 2, 2, 2] },
  { id: 3, label: "3+3+2",       sub: "3 sabores", p: [3, 3, 2] },
  { id: 4, label: "6 + 2",       sub: "2 sabores", p: [6, 2] },
  { id: 5, label: "4+2+2",       sub: "3 sabores", p: [4, 2, 2] },
  { id: 6, label: "4 + 4",       sub: "2 sabores", p: [4, 4] },
  { id: 7, label: "4 porciones", sub: "1 sabor",   p: [4] },
  { id: 8, label: "2 + 2",       sub: "2 sabores", p: [2, 2] },
];
const SIZE_CFGS = {
  c: [0, 1, 2, 3, 4, 5],
  m: [0, 6, 5, 3],
  p: [7, 8],
};

/* ─── Colores ─── */
const SEC_COLORS = ["#D4721A", "#1A6B9E", "#27ae60", "#8e44ad", "#e67e22", "#c0392b"];
const SEC_LIGHTS = ["#FFF0E3", "#E3F2FD", "#E8F8EE", "#F5E9FF", "#FEF3E3", "#FDECEA"];

/* ─── Premium names ─── */
const PREMIUM_NAMES = [
  "MIEL MOSTAZA","MEXICANA PREMIUM","HAW PREMIUM",
  "HAWAINA PREMIUM","HAWAIANA PREMIUM",
  "AHUMADA","COLOMBIANA","CRIOLLA","TRES CARNES","PEPERONI","PEPPERONI","CESAR",
];

/* ─── Helpers ─── */
export function getPizzaSuffix(name = "") {
  const m = name.match(/\(([cmp])\)\s*$/i);
  return m ? m[1].toLowerCase() : null;
}
function scaleIngredient(str, factor) {
  if (factor === 1) return str;
  return str.replace(/\b(\d+(?:[.,]\d+)?)\b/g, (m) => {
    const n = parseFloat(m.replace(",", ".")) * factor;
    return Number.isInteger(n) ? String(n) : parseFloat(n.toFixed(1)).toString();
  });
}
function cleanName(name = "") { return name.replace(/\s*\([cmp]\)\s*$/i, "").trim(); }

/* ─── Pie-slice SVG path ─── */
function pieSlice(cx, cy, r, startDeg, endDeg) {
  const rad = a => ((a - 90) * Math.PI) / 180;
  const s = rad(startDeg), e = rad(endDeg);
  const x1 = cx + r * Math.cos(s), y1 = cy + r * Math.sin(s);
  const x2 = cx + r * Math.cos(e), y2 = cy + r * Math.sin(e);
  const large = (endDeg - startDeg) > 180 ? 1 : 0;
  return `M${cx},${cy} L${x1},${y1} A${r},${r},0,${large},1,${x2},${y2} Z`;
}

/* ─── Pizza visual con secciones droppables ─── */
function PizzaVisual({ portions, size = 80, dragOverSec = -1, onSecDrop }) {
  const total = portions.reduce((a, b) => a + b, 0);
  let cur = 0;
  const stops = portions.map((p, i) => {
    const s = (cur / total) * 100, e = ((cur + p) / total) * 100;
    cur += p;
    return `${SEC_COLORS[i % SEC_COLORS.length]} ${s}% ${e}%`;
  });
  cur = 0;
  const divAngles = portions.slice(0, -1).map(p => { cur += p; return (cur / total) * 360; });
  const cx = size / 2, cy = size / 2, r = (size - 6) / 2;

  // Pie slice angles per section
  let deg = 0;
  const slices = portions.map((p, i) => {
    const start = deg;
    deg += (p / total) * 360;
    return { i, start, end: deg };
  });

  return (
    <div style={{ position:"relative", width:size, height:size, flexShrink:0 }}>
      {/* Conic gradient base */}
      <div style={{ position:"absolute", inset:3, borderRadius:"50%", background:`conic-gradient(${stops.join(", ")})` }} />
      {/* SVG: divisores + drop zones */}
      <svg width={size} height={size} style={{ position:"absolute", inset:0, overflow:"visible" }}>
        {/* Invisible droppable slices */}
        {slices.map(({ i, start, end }) => (
          <path
            key={i}
            d={pieSlice(cx, cy, r, start, end)}
            fill={dragOverSec === i ? "rgba(255,255,255,0.35)" : "transparent"}
            stroke={dragOverSec === i ? "#fff" : "none"}
            strokeWidth="2"
            style={{ cursor:"copy", transition:"fill 0.1s" }}
            data-section-idx={i}
            onDragOver={e => { e.preventDefault(); e.currentTarget.closest("[data-drop-pizza]")?.dispatchEvent(new CustomEvent("secHover",{detail:i,bubbles:true})); }}
            onDrop={e => { e.preventDefault(); onSecDrop?.(i); }}
          />
        ))}
        {/* Divisor lines */}
        {divAngles.map((deg2, i) => {
          const rad = ((deg2 - 90) * Math.PI) / 180;
          return <line key={i} x1={cx} y1={cy} x2={cx + r * Math.cos(rad)} y2={cy + r * Math.sin(rad)} stroke="rgba(255,255,255,0.85)" strokeWidth="2.5" />;
        })}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="3" />
        <circle cx={cx} cy={cy} r={size * 0.11} fill="rgba(255,255,255,0.92)" />
        {/* Drop indicator ring */}
        {dragOverSec >= 0 && (
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#FFD700" strokeWidth="3" strokeDasharray="8 4" opacity="0.9" />
        )}
      </svg>
    </div>
  );
}

const STEP_LABELS = ["Tamaño", "División", "Sabores"];

/* ─── Modal principal ─── */
export function PizzaBuilderModal({ pizzaRecipes, onClose }) {
  const [step, setStep]                     = useState(1);
  const [selectedSuffix, setSelectedSuffix] = useState("m");
  const [selectedCfgId, setSelectedCfgId]   = useState(null);
  const [sectionFlavors, setSectionFlavors] = useState({});
  const [dragOverSec, setDragOverSec]       = useState(-1);

  /* Refs para drag pointer */
  const draggingRef = useRef(null);   // { recipeId, name }
  const ghostRef    = useRef(null);   // DOM node del ghost flotante
  const containerRef = useRef(null);  // el modal

  const size = SIZES[selectedSuffix];
  const availableCfgs = useMemo(() =>
    SIZE_CFGS[selectedSuffix].map(id => ALL_CFGS.find(c => c.id === id)), [selectedSuffix]);
  const activeCfgId  = selectedCfgId ?? availableCfgs[0]?.id;
  const selectedCfg  = useMemo(() => ALL_CFGS.find(c => c.id === activeCfgId), [activeCfgId]);
  const sameSizeFlavors = useMemo(() =>
    pizzaRecipes.filter(r => getPizzaSuffix(r.name) === selectedSuffix), [pizzaRecipes, selectedSuffix]);

  const nextEmptySection = useMemo(() => {
    if (!selectedCfg) return 0;
    return selectedCfg.p.findIndex((_, i) => sectionFlavors[i] === undefined);
  }, [selectedCfg, sectionFlavors]);

  const totalSections  = selectedCfg?.p.length ?? 0;
  const filledSections = Object.keys(sectionFlavors).length;
  const allAssigned    = filledSections === totalSections && totalSections > 0;

  const liveResults = useMemo(() => {
    if (!selectedCfg) return [];
    return selectedCfg.p.map((portions, i) => {
      if (sectionFlavors[i] === undefined) return null;
      const recipe = sameSizeFlavors.find(r => r.id === sectionFlavors[i]);
      if (!recipe) return null;
      return { name: cleanName(recipe.name), portions, color: SEC_COLORS[i % SEC_COLORS.length], light: SEC_LIGHTS[i % SEC_LIGHTS.length], ingredients: recipe.ingredients.map(ing => scaleIngredient(ing, portions)) };
    }).filter(Boolean);
  }, [selectedCfg, sectionFlavors, sameSizeFlavors]);

  const premiumFlavors = useMemo(() =>
    sameSizeFlavors.filter(r => PREMIUM_NAMES.includes(cleanName(r.name).toUpperCase())), [sameSizeFlavors]);
  const tradFlavors    = useMemo(() =>
    sameSizeFlavors.filter(r => !PREMIUM_NAMES.includes(cleanName(r.name).toUpperCase())), [sameSizeFlavors]);

  function assignToSection(sectionIdx, recipeId) {
    setSectionFlavors(prev => ({ ...prev, [sectionIdx]: recipeId }));
  }

  function handleFlavorTap(recipeId) {
    const existing = Object.entries(sectionFlavors).find(([, v]) => v === recipeId);
    if (existing) {
      setSectionFlavors(prev => { const n = { ...prev }; delete n[parseInt(existing[0])]; return n; });
    } else if (nextEmptySection !== -1) {
      assignToSection(nextEmptySection, recipeId);
    }
  }

  function assignedSectionOf(recipeId) {
    const e = Object.entries(sectionFlavors).find(([, v]) => v === recipeId);
    return e ? parseInt(e[0]) : -1;
  }

  /* ── Drag: HTML5 (desktop mouse) ── */
  function handleDragStart(e, recipe) {
    draggingRef.current = { recipeId: recipe.id, name: cleanName(recipe.name) };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(recipe.id));
  }
  function handleDragEnd() {
    draggingRef.current = null;
    setDragOverSec(-1);
  }

  /* ── Drag: Pointer events (touch + mouse) ── */
  function showGhost(name, x, y) {
    const g = ghostRef.current;
    if (!g) return;
    g.textContent = "🍕 " + name;
    g.style.display = "inline-flex";
    g.style.left = (x - 50) + "px";
    g.style.top  = (y - 18) + "px";
  }
  function hideGhost() {
    if (ghostRef.current) ghostRef.current.style.display = "none";
  }

  const handlePointerDown = useCallback((e, recipe) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // Don't capture on desktop (HTML5 dnd handles it) — only for touch
    if (e.pointerType !== "touch") return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = { recipeId: recipe.id, name: cleanName(recipe.name) };
    showGhost(cleanName(recipe.name), e.clientX, e.clientY);
  }, []);

  const handlePointerMove = useCallback((e) => {
    if (!draggingRef.current) return;
    showGhost(draggingRef.current.name, e.clientX, e.clientY);
    // Temporarily hide ghost to use elementFromPoint
    if (ghostRef.current) ghostRef.current.style.display = "none";
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (ghostRef.current) ghostRef.current.style.display = "inline-flex";
    const secEl = el?.closest?.("[data-section-idx]") ?? el?.dataset?.sectionIdx !== undefined ? el : null;
    const idx = el?.dataset?.sectionIdx !== undefined
      ? parseInt(el.dataset.sectionIdx)
      : el?.closest?.("[data-section-idx]")?.dataset?.sectionIdx !== undefined
      ? parseInt(el.closest("[data-section-idx]").dataset.sectionIdx)
      : -1;
    setDragOverSec(idx);
  }, []);

  const handlePointerUp = useCallback((e) => {
    if (!draggingRef.current) return;
    const { recipeId } = draggingRef.current;
    if (dragOverSec !== -1) {
      assignToSection(dragOverSec, recipeId);
    }
    draggingRef.current = null;
    hideGhost();
    setDragOverSec(-1);
  }, [dragOverSec]);

  function handleSizeSelect(s) {
    setSelectedSuffix(s); setSelectedCfgId(null); setSectionFlavors({});
  }
  function goNext() { setSectionFlavors({}); setStep(s => s + 1); }
  function goBack() { setStep(s => s - 1); }

  /* ── Chip de sabor ── */
  function FlavorChip({ recipe }) {
    const sec      = assignedSectionOf(recipe.id);
    const assigned = sec !== -1;
    const color    = assigned ? SEC_COLORS[sec % SEC_COLORS.length] : "#888";
    const bg       = assigned ? SEC_LIGHTS[sec % SEC_LIGHTS.length] : "#fff";
    const isDragging = draggingRef.current?.recipeId === recipe.id;
    return (
      <div
        draggable
        onDragStart={e => handleDragStart(e, recipe)}
        onDragEnd={handleDragEnd}
        onPointerDown={e => handlePointerDown(e, recipe)}
        onClick={() => handleFlavorTap(recipe.id)}
        style={{
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"7px 10px", borderRadius:"10px", marginBottom:"5px",
          border:`1.5px solid ${assigned ? color : dragOverSec >= 0 && draggingRef.current ? "#D4721A" : "#E0D8CE"}`,
          background: bg, cursor:"grab",
          opacity: isDragging ? 0.4 : 1,
          userSelect:"none", touchAction:"none",
          transition:"opacity 0.15s, border-color 0.15s",
        }}
      >
        <span style={{ fontFamily:"Georgia,serif", fontSize:"12px", fontWeight: assigned ? "700":"600", color: assigned ? color : "#333", flex:1 }}>
          {assigned && <span style={{ marginRight:"4px" }}>✓</span>}
          {cleanName(recipe.name)}
        </span>
        {assigned
          ? <span style={{ fontSize:"10px", fontWeight:"800", color:"#fff", background:color, padding:"2px 7px", borderRadius:"10px", flexShrink:0, marginLeft:"6px" }}>Sec {sec+1}</span>
          : <span style={{ fontSize:"11px", color:"#bbb", marginLeft:"6px", flexShrink:0 }}>⠿</span>
        }
      </div>
    );
  }

  /* ── Render ── */
  return (
    <>
      {/* Ghost flotante para drag-touch */}
      <div ref={ghostRef} style={{ display:"none", position:"fixed", zIndex:99999, pointerEvents:"none", background:"linear-gradient(135deg,var(--app-primary),var(--app-primary-dark))", color:"#fff", padding:"8px 16px", borderRadius:"20px", fontSize:"13px", fontWeight:"700", fontFamily:"Georgia,serif", whiteSpace:"nowrap", boxShadow:"0 8px 28px rgba(0,0,0,0.35)", transform:"scale(1.1) rotate(-3deg)", alignItems:"center", gap:"6px" }} />

      <div
        style={{ position:"fixed", inset:0, zIndex:10000, background:"rgba(0,0,0,0.6)", backdropFilter:"blur(4px)", display:"flex", alignItems:"flex-end" }}
        onClick={onClose}
      >
        <div
          ref={containerRef}
          onClick={e => e.stopPropagation()}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          data-drop-pizza
          style={{ width:"100%", maxHeight:"92vh", background:"#F4F0EB", borderRadius:"24px 24px 0 0", display:"flex", flexDirection:"column", overflow:"hidden", boxShadow:"0 -8px 40px rgba(0,0,0,0.4)" }}
        >
          {/* ── Header ── */}
          <div style={{ background:"linear-gradient(135deg,var(--app-primary),var(--app-primary-dark))", padding:"14px 20px 12px", flexShrink:0 }}>
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
              <div>
                <div style={{ color:"#D4721A", fontSize:"10px", fontWeight:"700", letterSpacing:"3px", fontFamily:"Georgia,serif", marginBottom:"3px" }}>DON TELMO® — 1958 — COMPANY</div>
                <div style={{ color:"#fff", fontFamily:"Georgia,serif", fontSize:"19px", fontWeight:"700" }}>🍕 Armador de Pizzas</div>
              </div>
              <button style={{ background:"rgba(255,255,255,0.15)", border:"none", borderRadius:"8px", color:"#fff", width:"32px", height:"32px", cursor:"pointer", fontSize:"18px", lineHeight:1, flexShrink:0 }} onClick={onClose}>×</button>
            </div>
            <div style={{ display:"flex", alignItems:"center", marginTop:"10px" }}>
              {[1,2,3].map((s, i) => (
                <div key={s} style={{ display:"flex", alignItems:"center", flex: i < 2 ? 1 : 0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"5px", flexShrink:0 }}>
                    <div style={{ width:"22px", height:"22px", borderRadius:"50%", background: step > s ? "#D4721A" : step === s ? "#fff" : "rgba(255,255,255,0.18)", color: step > s ? "#fff" : step === s ? "var(--app-primary)" : "rgba(255,255,255,0.45)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"10px", fontWeight:"800" }}>
                      {step > s ? "✓" : s}
                    </div>
                    <span style={{ fontSize:"10px", fontWeight:"600", color: step >= s ? "#fff" : "rgba(255,255,255,0.35)", whiteSpace:"nowrap" }}>{STEP_LABELS[i]}</span>
                  </div>
                  {i < 2 && <div style={{ flex:1, height:"2px", background: step > s ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.18)", margin:"0 6px" }} />}
                </div>
              ))}
            </div>
          </div>

          {/* ── Body ── */}
          <div style={{ overflowY:"auto", flex:1 }}>

            {/* PASO 1 */}
            {step === 1 && (
              <div style={{ padding:"16px 20px" }}>
                <div style={{ fontSize:"11px", fontWeight:"700", color:"var(--app-primary)", letterSpacing:"1.5px", marginBottom:"12px", textTransform:"uppercase", fontFamily:"Georgia,serif" }}>¿De qué tamaño?</div>
                {Object.entries(SIZES).map(([key, sz]) => (
                  <div key={key} onClick={() => handleSizeSelect(key)} style={{ display:"flex", alignItems:"center", gap:"12px", padding:"12px 14px", borderRadius:"12px", marginBottom:"9px", border:`2px solid ${selectedSuffix === key ? "var(--app-primary)" : "#E0D8CE"}`, background: selectedSuffix === key ? "rgba(27,58,92,0.05)" : "#fff", cursor:"pointer" }}>
                    <div style={{ width: sz.cm >= 50 ? 52 : sz.cm >= 40 ? 44 : 36, height: sz.cm >= 50 ? 52 : sz.cm >= 40 ? 44 : 36, borderRadius:"50%", background:`conic-gradient(${SEC_COLORS[0]} 0% 100%)`, flexShrink:0 }} />
                    <div style={{ flex:1 }}>
                      <div style={{ fontFamily:"Georgia,serif", fontWeight:"700", fontSize:"15px", color:"var(--app-primary)" }}>{sz.label}</div>
                      <div style={{ fontSize:"12px", color:"#888", marginTop:"2px" }}>{sz.cm} cm · {sz.portions} porciones</div>
                    </div>
                    <div style={{ width:"20px", height:"20px", borderRadius:"50%", flexShrink:0, border:`2.5px solid ${selectedSuffix === key ? "var(--app-primary)" : "#E0D8CE"}`, background: selectedSuffix === key ? "var(--app-primary)" : "#fff", display:"flex", alignItems:"center", justifyContent:"center" }}>
                      {selectedSuffix === key && <div style={{ width:"7px", height:"7px", borderRadius:"50%", background:"#fff" }} />}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* PASO 2 */}
            {step === 2 && (
              <div style={{ padding:"16px 20px" }}>
                <div style={{ fontSize:"11px", fontWeight:"700", color:"var(--app-primary)", letterSpacing:"1.5px", marginBottom:"4px", textTransform:"uppercase", fontFamily:"Georgia,serif" }}>¿Cómo la divides?</div>
                <div style={{ fontSize:"12px", color:"#888", marginBottom:"12px" }}>{size.label} · {size.cm} cm · {size.portions} porciones</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px" }}>
                  {availableCfgs.map(cfg => {
                    const active = activeCfgId === cfg.id;
                    let c = 0;
                    const stops2 = cfg.p.map((p, i) => { const s=(c/cfg.p.reduce((a,b)=>a+b,0))*100,e=((c+p)/cfg.p.reduce((a,b)=>a+b,0))*100; c+=p; return `${SEC_COLORS[i%SEC_COLORS.length]} ${s}% ${e}%`; });
                    return (
                      <div key={cfg.id} onClick={() => setSelectedCfgId(cfg.id)} style={{ padding:"12px 10px", borderRadius:"12px", textAlign:"center", border:`2px solid ${active ? "var(--app-primary)" : "#E0D8CE"}`, background: active ? "rgba(27,58,92,0.05)" : "#fff", cursor:"pointer" }}>
                        <div style={{ display:"flex", justifyContent:"center", marginBottom:"7px" }}>
                          <div style={{ width:68, height:68, borderRadius:"50%", background:`conic-gradient(${stops2.join(", ")})`, border:"3px solid rgba(255,255,255,0.6)", boxShadow:"0 2px 8px rgba(0,0,0,0.15)" }} />
                        </div>
                        <div style={{ fontFamily:"Georgia,serif", fontWeight:"700", fontSize:"13px", color:"var(--app-primary)" }}>{cfg.label}</div>
                        <div style={{ fontSize:"11px", color:"#888", marginTop:"1px" }}>{cfg.sub}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* PASO 3 */}
            {step === 3 && selectedCfg && (
              <div>
                {/* Badge + contador */}
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 16px 6px" }}>
                  <div style={{ background:"linear-gradient(135deg,var(--app-primary),var(--app-primary-dark))", color:"#fff", fontSize:"12px", fontWeight:"800", padding:"5px 14px", borderRadius:"20px", boxShadow:"0 3px 10px rgba(0,0,0,0.2)" }}>
                    🍕 {size.label} · {size.cm}cm
                  </div>
                  <div style={{ fontSize:"12px", fontWeight:"800", color:"#888", background:"#EDECE8", padding:"5px 12px", borderRadius:"20px" }}>
                    <span style={{ fontSize:"15px", fontWeight:"900", color: allAssigned ? "#27ae60" : "var(--app-primary)" }}>{filledSections}</span>/{totalSections} sabores
                  </div>
                </div>

                {/* Hint */}
                <div style={{ margin:"0 14px 6px", padding:"7px 12px", borderRadius:"10px", fontSize:"11px", fontWeight:"700", display:"flex", alignItems:"center", gap:"6px", background: allAssigned ? "#E8F8EE" : "#FFF0E3", color: allAssigned ? "#27ae60" : "#D4721A", border:`1.5px solid ${allAssigned ? "rgba(39,174,96,0.2)" : "rgba(212,114,26,0.2)"}` }}>
                  {allAssigned
                    ? "✅ ¡Listo! Revisa los ingredientes abajo"
                    : `🖐 Arrastra o toca un sabor → Sección ${nextEmptySection + 1} — faltan ${totalSections - filledSections}`}
                </div>

                {/* Split layout */}
                <div style={{ display:"flex", minHeight:"220px", borderBottom:"2px solid #E0D8CE" }}>

                  {/* Izquierda: pizza + secciones */}
                  <div style={{ width:"160px", flexShrink:0, display:"flex", flexDirection:"column", alignItems:"center", padding:"8px 6px 10px", borderRight:"1.5px solid #E0D8CE", gap:"8px" }}
                    onDragOver={e => e.preventDefault()}
                  >
                    <PizzaVisual
                      portions={selectedCfg.p}
                      size={130}
                      dragOverSec={dragOverSec}
                      onSecDrop={(secIdx) => {
                        if (draggingRef.current) assignToSection(secIdx, draggingRef.current.recipeId);
                        setDragOverSec(-1);
                      }}
                    />
                    <div style={{ fontFamily:"Georgia,serif", fontSize:"12px", fontWeight:"700", color:"var(--app-primary)", textAlign:"center" }}>
                      {size.label}<br /><span style={{ fontSize:"10px", fontWeight:"600", color:"#888" }}>{size.cm} cm</span>
                    </div>
                    {/* Sección rows */}
                    <div style={{ width:"100%", display:"flex", flexDirection:"column", gap:"4px" }}>
                      {selectedCfg.p.map((portions, i) => {
                        const recipe = sectionFlavors[i] !== undefined ? sameSizeFlavors.find(r => r.id === sectionFlavors[i]) : null;
                        const isNext = i === nextEmptySection;
                        const color  = SEC_COLORS[i % SEC_COLORS.length];
                        const isOver = dragOverSec === i;
                        return (
                          <div key={i}
                            data-section-idx={i}
                            onDragOver={e => { e.preventDefault(); setDragOverSec(i); }}
                            onDragLeave={() => setDragOverSec(-1)}
                            onDrop={e => { e.preventDefault(); if (draggingRef.current) assignToSection(i, draggingRef.current.recipeId); setDragOverSec(-1); }}
                            onClick={() => { if (recipe) setSectionFlavors(prev => { const n={...prev}; delete n[i]; return n; }); }}
                            style={{ display:"flex", alignItems:"center", gap:"5px", padding:"4px 6px", borderRadius:"7px", border:`1.5px solid ${isOver ? "#FFD700" : isNext && !recipe ? color : recipe ? color : "#E0D8CE"}`, background: isOver ? "#FFFAE0" : recipe ? SEC_LIGHTS[i % SEC_LIGHTS.length] : "#fff", cursor: recipe ? "pointer" : "default", transition:"all 0.1s" }}
                          >
                            <div style={{ width:"16px", height:"16px", borderRadius:"4px", background:color, color:"#fff", fontSize:"9px", fontWeight:"800", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{portions}</div>
                            <span style={{ fontSize:"9px", fontWeight: recipe ? "700":"600", color: recipe ? color : isNext ? color : "#bbb", flex:1, overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis", maxWidth:"90px" }}>
                              {recipe ? cleanName(recipe.name) : isNext ? "← suelta aquí" : "—"}
                            </span>
                            {recipe && <span style={{ fontSize:"9px", color:"#aaa" }}>✕</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Derecha: lista sabores */}
                  <div style={{ flex:1, overflowY:"auto", padding:"8px 10px" }}>
                    {premiumFlavors.length > 0 && (
                      <div style={{ marginBottom:"8px" }}>
                        <div style={{ fontSize:"10px", fontWeight:"800", padding:"4px 8px", borderRadius:"6px 6px 0 0", background:"#E8F8EE", color:"#1B7A1B", letterSpacing:"0.4px" }}>⭐ Premium</div>
                        <div style={{ background:"#fff", border:"1.5px solid #E0D8CE", borderTop:"none", borderRadius:"0 0 8px 8px", padding:"6px 8px" }}>
                          {premiumFlavors.map(r => <FlavorChip key={r.id} recipe={r} />)}
                        </div>
                      </div>
                    )}
                    {tradFlavors.length > 0 && (
                      <div style={{ marginBottom:"8px" }}>
                        <div style={{ fontSize:"10px", fontWeight:"800", padding:"4px 8px", borderRadius:"6px 6px 0 0", background:"#FDECEA", color:"#C0292C", letterSpacing:"0.4px" }}>🔴 Tradicional</div>
                        <div style={{ background:"#fff", border:"1.5px solid #E0D8CE", borderTop:"none", borderRadius:"0 0 8px 8px", padding:"6px 8px" }}>
                          {tradFlavors.map(r => <FlavorChip key={r.id} recipe={r} />)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Ingredientes en vivo */}
                {liveResults.length > 0 && (
                  <div style={{ padding:"12px 16px 4px" }}>
                    <div style={{ fontSize:"11px", fontWeight:"700", color:"var(--app-primary)", letterSpacing:"1.5px", marginBottom:"10px", textTransform:"uppercase", fontFamily:"Georgia,serif", display:"flex", alignItems:"center", gap:"8px" }}>
                      <span>📊 Ingredientes en vivo</span>
                      <div style={{ flex:1, height:"1px", background:"#E0D8CE" }} />
                    </div>
                    {liveResults.map((r, i) => (
                      <div key={i} style={{ marginBottom:"12px" }}>
                        <div style={{ background:r.color, borderRadius:"9px 9px 0 0", padding:"8px 12px", display:"flex", alignItems:"center", gap:"8px" }}>
                          <span style={{ color:"#fff", fontFamily:"Georgia,serif", fontSize:"12px", fontWeight:"700", flex:1 }}>🍕 {r.name}</span>
                          <span style={{ color:"rgba(255,255,255,0.9)", fontSize:"11px", fontWeight:"700", background:"rgba(255,255,255,0.2)", padding:"2px 8px", borderRadius:"6px" }}>{r.portions} porc.</span>
                        </div>
                        <div style={{ border:`1.5px solid ${r.color}`, borderTop:"none", borderRadius:"0 0 9px 9px", padding:"6px" }}>
                          {r.ingredients.map((ing, j) => (
                            <div key={j} style={{ padding:"5px 8px", fontSize:"12px", color:"#333", borderRadius:"5px", lineHeight:1.4, background: j%2===0 ? r.light : "#fff" }}>• {ing}</div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          <div style={{ padding:"10px 18px 18px", background:"#fff", borderTop:"2px solid #E0D8CE", flexShrink:0, display:"flex", gap:"10px" }}>
            {step > 1 && (
              <button onClick={goBack} style={{ flex:1, padding:"12px", border:"2px solid #E0D8CE", borderRadius:"12px", background:"#fff", color:"#555", fontWeight:"700", fontSize:"13px", cursor:"pointer", fontFamily:"Georgia,serif" }}>← Volver</button>
            )}
            {step < 3
              ? <button onClick={goNext} style={{ flex:2, padding:"12px", background:"linear-gradient(135deg,var(--app-primary),var(--app-primary-dark))", border:"none", borderRadius:"12px", color:"#fff", fontSize:"13px", fontWeight:"700", cursor:"pointer", fontFamily:"Georgia,serif" }}>Siguiente →</button>
              : <div style={{ flex:2, padding:"12px", borderRadius:"12px", background: allAssigned ? "#E8F8EE" : "#EDECE8", border:`2px solid ${allAssigned ? "#27ae60" : "#E0D8CE"}`, textAlign:"center", fontSize:"13px", fontWeight:"700", color: allAssigned ? "#27ae60" : "#aaa", fontFamily:"Georgia,serif" }}>
                  {allAssigned ? "✅ Pizza lista" : `Faltan ${totalSections - filledSections} sección${totalSections-filledSections!==1?"es":""}`}
                </div>
            }
          </div>
          <div style={{ background:"#fff", paddingBottom:"4px", textAlign:"center", color:"#D4721A", fontSize:"10px", fontFamily:"Georgia,serif", fontWeight:"700", letterSpacing:"3px" }}>━━━ DON TELMO® 1958 ━━━</div>
        </div>
      </div>
    </>
  );
}
