"use client";
import { useState, useMemo } from "react";

const SIZES = {
  c: { label: "Completa", cm: 50, portions: 8 },
  m: { label: "Mediana",  cm: 40, portions: 8 },
  p: { label: "Personal", cm: 27, portions: 4 },
};

export function getPizzaSuffix(name = "") {
  const m = name.match(/\(([cmp])\)\s*$/i);
  return m ? m[1].toLowerCase() : null;
}

function scaleIngredient(str, factor) {
  if (factor === 1) return str;
  return str.replace(/\b(\d+(?:[.,]\d+)?)\b/g, (match) => {
    const n = parseFloat(match.replace(",", "."));
    const scaled = n * factor;
    if (Number.isInteger(scaled)) return String(scaled);
    return parseFloat(scaled.toFixed(1)).toString();
  });
}

function cleanName(name = "") {
  return name.replace(/\s*\([cmp]\)\s*$/i, "").trim();
}

const S = {
  overlay:    { position:"fixed", inset:0, zIndex:10000, background:"#F4F0EB", display:"flex", flexDirection:"column", overflow:"hidden" },
  topBar:     { background:"linear-gradient(135deg,var(--app-primary),var(--app-primary-dark))", padding:"16px 20px 14px", flexShrink:0 },
  brandLabel: { color:"#D4721A", fontSize:"10px", fontWeight:"700", letterSpacing:"3px", fontFamily:"Georgia,serif", marginBottom:"4px" },
  title:      { color:"#fff", fontFamily:"Georgia,serif", fontSize:"20px", fontWeight:"700" },
  closeBtn:   { background:"rgba(255,255,255,0.15)", border:"none", borderRadius:"8px", color:"#fff", width:"34px", height:"34px", cursor:"pointer", fontSize:"20px", lineHeight:1, flexShrink:0 },
  sizeBar:    { background:"#fff", borderBottom:"2px solid #E0D8CE", padding:"12px 20px", display:"flex", gap:"10px", flexShrink:0 },
  sizeBtn:    { flex:1, padding:"10px 6px", border:"2px solid #E0D8CE", borderRadius:"10px", background:"#fff", color:"#555", fontWeight:"700", fontSize:"13px", cursor:"pointer", fontFamily:"Georgia,serif", transition:"all .2s", textAlign:"center" },
  sizeBtnActive: { flex:1, padding:"10px 6px", border:"2px solid var(--app-primary)", borderRadius:"10px", background:"var(--app-primary)", color:"#fff", fontWeight:"700", fontSize:"13px", cursor:"pointer", fontFamily:"Georgia,serif", transition:"all .2s", textAlign:"center" },
  body:       { overflowY:"auto", flex:1, padding:"18px 20px" },
  sectionLbl: { fontSize:"11px", fontWeight:"700", color:"var(--app-primary)", letterSpacing:"1.5px", marginBottom:"12px", textTransform:"uppercase", fontFamily:"Georgia,serif" },
  flavorRow:  { display:"flex", alignItems:"center", gap:"10px", padding:"10px 14px", borderRadius:"10px", marginBottom:"6px", border:"2px solid #E0D8CE", background:"#fff" },
  flavorRowOn:{ display:"flex", alignItems:"center", gap:"10px", padding:"10px 14px", borderRadius:"10px", marginBottom:"6px", border:"2px solid var(--app-primary)", background:"#F0F4F8" },
  flavorName: { flex:1, fontSize:"14px", fontWeight:"600", color:"var(--app-primary)", fontFamily:"Georgia,serif" },
  btn:        { width:"32px", height:"32px", borderRadius:"8px", border:"none", background:"var(--app-primary)", color:"#fff", fontSize:"20px", fontWeight:"700", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", lineHeight:1 },
  btnDis:     { width:"32px", height:"32px", borderRadius:"8px", border:"none", background:"#E0D8CE", color:"#bbb", fontSize:"20px", fontWeight:"700", cursor:"not-allowed", display:"flex", alignItems:"center", justifyContent:"center", lineHeight:1 },
  count:      { width:"30px", textAlign:"center", fontWeight:"700", fontSize:"16px", color:"var(--app-primary)" },
  totalBar:   { background:"#fff", border:"2px solid #E0D8CE", borderRadius:"12px", padding:"14px 18px", marginTop:"16px", marginBottom:"16px", display:"flex", alignItems:"center", justifyContent:"space-between" },
  totalTxt:   { fontSize:"13px", fontWeight:"600", color:"#888", fontFamily:"Georgia,serif" },
  calcBtn:    { width:"100%", padding:"14px", background:"linear-gradient(135deg,var(--app-primary),var(--app-primary-dark))", border:"none", borderRadius:"12px", color:"#fff", fontSize:"15px", fontWeight:"700", cursor:"pointer", fontFamily:"Georgia,serif", letterSpacing:"1px" },
  calcBtnDis: { width:"100%", padding:"14px", background:"#C0B8A8", border:"none", borderRadius:"12px", color:"#fff", fontSize:"15px", fontWeight:"700", cursor:"not-allowed", fontFamily:"Georgia,serif", letterSpacing:"1px" },
  divider:    { borderTop:"2px solid #E0D8CE", margin:"20px 0" },
  resHdr:     { background:"linear-gradient(135deg,var(--app-primary),var(--app-primary-dark))", borderRadius:"10px 10px 0 0", padding:"10px 14px", display:"flex", alignItems:"center" },
  resHdrTxt:  { color:"#fff", fontFamily:"Georgia,serif", fontSize:"13px", fontWeight:"700", flex:1 },
  resPortions:{ color:"#D4721A", fontSize:"12px", fontWeight:"700", background:"rgba(255,255,255,0.15)", padding:"2px 8px", borderRadius:"6px" },
  resBody:    { border:"2px solid var(--app-primary)", borderTop:"none", borderRadius:"0 0 10px 10px", padding:"10px", marginBottom:"14px" },
  ingRow:     { padding:"7px 10px", fontSize:"13px", color:"#333", borderRadius:"6px", lineHeight:1.4 },
  footer:     { borderTop:"2px solid #E0D8CE", padding:"10px 20px", textAlign:"center", color:"#D4721A", fontSize:"11px", fontFamily:"Georgia,serif", fontWeight:"700", letterSpacing:"3px", flexShrink:0, background:"#fff" },
};

export function PizzaBuilderModal({ pizzaRecipes, onClose }) {
  const [selectedSuffix, setSelectedSuffix] = useState("m");
  const size = SIZES[selectedSuffix];

  const sameSizeFlavors = useMemo(() =>
    pizzaRecipes.filter(r => getPizzaSuffix(r.name) === selectedSuffix),
    [pizzaRecipes, selectedSuffix]
  );

  const [assigned, setAssigned] = useState({});
  const [showResult, setShowResult] = useState(false);

  function selectSize(s) { setSelectedSuffix(s); setAssigned({}); setShowResult(false); }

  const totalAssigned = Object.values(assigned).reduce((a, b) => a + b, 0);
  const remaining = size.portions - totalAssigned;
  const isComplete = totalAssigned === size.portions;

  function change(id, delta) {
    setAssigned(prev => {
      const cur = prev[id] || 0;
      if (delta > 0 && remaining <= 0) return prev;
      return { ...prev, [id]: Math.max(0, cur + delta) };
    });
    setShowResult(false);
  }

  const results = useMemo(() => {
    if (!isComplete) return [];
    return sameSizeFlavors
      .filter(r => (assigned[r.id] || 0) > 0)
      .map(r => ({
        name: cleanName(r.name),
        portions: assigned[r.id],
        ingredients: r.ingredients.map(ing => scaleIngredient(ing, assigned[r.id])),
      }));
  }, [isComplete, assigned, sameSizeFlavors]);

  return (
    <div style={S.overlay}>
      {/* Header igual al RecipeDetail */}
      <div style={S.topBar}>
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
          <div>
            <div style={S.brandLabel}>DON TELMO® — 1958 — COMPANY</div>
            <div style={S.title}>🍕 Armador de Pizzas</div>
          </div>
          <button style={S.closeBtn} onClick={onClose}>×</button>
        </div>
      </div>

      {/* Selector de tamaño */}
      <div style={S.sizeBar}>
        {Object.entries(SIZES).map(([key, sz]) => (
          <button key={key} onClick={() => selectSize(key)}
            style={selectedSuffix === key ? S.sizeBtnActive : S.sizeBtn}>
            {sz.label}
            <div style={{ fontSize:"11px", fontWeight:"400", marginTop:"2px", opacity:0.8 }}>
              {sz.cm}cm · {sz.portions} porc.
            </div>
          </button>
        ))}
      </div>

      {/* Cuerpo */}
      <div style={S.body}>
        <div style={S.sectionLbl}>Asigna porciones a cada sabor</div>

        {sameSizeFlavors.map(r => {
          const cnt = assigned[r.id] || 0;
          return (
            <div key={r.id} style={cnt > 0 ? S.flavorRowOn : S.flavorRow}>
              <div style={S.flavorName}>{cleanName(r.name)}</div>
              <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                <button style={cnt === 0 ? S.btnDis : S.btn} onClick={() => change(r.id, -1)} disabled={cnt === 0}>−</button>
                <span style={S.count}>{cnt}</span>
                <button style={remaining <= 0 ? S.btnDis : S.btn} onClick={() => change(r.id, +1)} disabled={remaining <= 0}>+</button>
              </div>
            </div>
          );
        })}

        {/* Total */}
        <div style={S.totalBar}>
          <span style={S.totalTxt}>Porciones asignadas</span>
          <span style={{ fontSize:"22px", fontWeight:"700", fontFamily:"Georgia,serif", color: isComplete ? "#27ae60" : "#1B3A5C" }}>
            {totalAssigned} / {size.portions} {isComplete ? "✅" : ""}
          </span>
        </div>

        <button style={isComplete ? S.calcBtn : S.calcBtnDis} disabled={!isComplete} onClick={() => setShowResult(true)}>
          Ver ingredientes exactos
        </button>

        {/* Resultados */}
        {showResult && results.length > 0 && (
          <>
            <div style={S.divider} />
            <div style={S.sectionLbl}>Ingredientes por sabor</div>
            {results.map((r, i) => (
              <div key={i}>
                <div style={S.resHdr}>
                  <span style={S.resHdrTxt}>🍕 {r.name}</span>
                  <span style={S.resPortions}>{r.portions} porc.</span>
                </div>
                <div style={S.resBody}>
                  {r.ingredients.map((ing, j) => (
                    <div key={j} style={{ ...S.ingRow, background: j % 2 === 0 ? "#F7F3EE" : "#fff" }}>• {ing}</div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      <div style={S.footer}>━━━ DON TELMO® 1958 ━━━</div>
    </div>
  );
}
