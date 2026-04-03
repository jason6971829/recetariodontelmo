"use client";
import { useState, useMemo } from "react";

const SIZES = {
  c: { label: "Completa", cm: 50, portions: 8 },
  m: { label: "Mediana",  cm: 40, portions: 8 },
  p: { label: "Personal", cm: 27, portions: 4 },
};

const ALL_CFGS = [
  { id: 0, label: "8 porciones", sub: "1 sabor",    p: [8] },
  { id: 1, label: "5 + 3",       sub: "2 sabores",  p: [5, 3] },
  { id: 2, label: "2+2+2+2",     sub: "4 sabores",  p: [2, 2, 2, 2] },
  { id: 3, label: "3+3+2",       sub: "3 sabores",  p: [3, 3, 2] },
  { id: 4, label: "6 + 2",       sub: "2 sabores",  p: [6, 2] },
  { id: 5, label: "4+2+2",       sub: "3 sabores",  p: [4, 2, 2] },
  { id: 6, label: "4 + 4",       sub: "2 sabores",  p: [4, 4] },
  { id: 7, label: "4 porciones", sub: "1 sabor",    p: [4] },
  { id: 8, label: "2 + 2",       sub: "2 sabores",  p: [2, 2] },
];

const SIZE_CFGS = {
  c: [0, 1, 2, 3, 4, 5],
  m: [0, 6, 5, 3],
  p: [7, 8],
};

const SEC_COLORS = ["#D4721A", "#1A6B9E", "#27ae60", "#8e44ad", "#e67e22", "#c0392b"];

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

function PizzaVisual({ portions, size = 80 }) {
  const total = portions.reduce((a, b) => a + b, 0);
  let current = 0;
  const stops = portions.map((p, i) => {
    const s = (current / total) * 100;
    const e = ((current + p) / total) * 100;
    current += p;
    return `${SEC_COLORS[i % SEC_COLORS.length]} ${s}% ${e}%`;
  });

  current = 0;
  const divAngles = portions.slice(0, -1).map(p => {
    current += p;
    return (current / total) * 360;
  });

  const cx = size / 2;
  const cy = size / 2;
  const r  = (size - 6) / 2;

  return (
    <div style={{ position:"relative", width:size, height:size, flexShrink:0 }}>
      <div style={{
        position:"absolute", inset:3, borderRadius:"50%",
        background:`conic-gradient(${stops.join(", ")})`,
      }} />
      <svg width={size} height={size} style={{ position:"absolute", inset:0 }}>
        {divAngles.map((deg, i) => {
          const rad = ((deg - 90) * Math.PI) / 180;
          return (
            <line key={i}
              x1={cx} y1={cy}
              x2={cx + r * Math.cos(rad)} y2={cy + r * Math.sin(rad)}
              stroke="rgba(255,255,255,0.85)" strokeWidth="2.5"
            />
          );
        })}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="3" />
        <circle cx={cx} cy={cy} r={size * 0.11} fill="rgba(255,255,255,0.92)" />
      </svg>
    </div>
  );
}

const STEP_LABELS = ["Tamaño", "División", "Sabores"];

export function PizzaBuilderModal({ pizzaRecipes, onClose }) {
  const [step, setStep]                     = useState(1);
  const [selectedSuffix, setSelectedSuffix] = useState("m");
  const [selectedCfgId, setSelectedCfgId]   = useState(null);
  const [sectionFlavors, setSectionFlavors] = useState({});
  const [activeSection, setActiveSection]   = useState(null);
  const [showResult, setShowResult]         = useState(false);

  const size = SIZES[selectedSuffix];

  const availableCfgs = useMemo(() =>
    SIZE_CFGS[selectedSuffix].map(id => ALL_CFGS.find(c => c.id === id)),
    [selectedSuffix]
  );

  const activeCfgId = selectedCfgId ?? availableCfgs[0]?.id;

  const selectedCfg = useMemo(() =>
    ALL_CFGS.find(c => c.id === activeCfgId),
    [activeCfgId]
  );

  const sameSizeFlavors = useMemo(() =>
    pizzaRecipes.filter(r => getPizzaSuffix(r.name) === selectedSuffix),
    [pizzaRecipes, selectedSuffix]
  );

  const missingSections = useMemo(() =>
    selectedCfg ? selectedCfg.p.filter((_, i) => sectionFlavors[i] === undefined).length : 0,
    [selectedCfg, sectionFlavors]
  );

  const allAssigned = missingSections === 0 && !!selectedCfg;

  const results = useMemo(() => {
    if (!allAssigned || !selectedCfg) return [];
    return selectedCfg.p.map((portions, i) => {
      const recipe = sameSizeFlavors.find(r => r.id === sectionFlavors[i]);
      if (!recipe) return null;
      return {
        name: cleanName(recipe.name),
        portions,
        color: SEC_COLORS[i % SEC_COLORS.length],
        ingredients: recipe.ingredients.map(ing => scaleIngredient(ing, portions)),
      };
    }).filter(Boolean);
  }, [allAssigned, selectedCfg, sectionFlavors, sameSizeFlavors]);

  function handleSizeSelect(s) {
    setSelectedSuffix(s);
    setSelectedCfgId(null);
    setSectionFlavors({});
    setActiveSection(null);
    setShowResult(false);
  }

  function goNext() {
    setSectionFlavors({});
    setActiveSection(null);
    setShowResult(false);
    setStep(s => s + 1);
  }

  function goBack() {
    setActiveSection(null);
    setShowResult(false);
    setStep(s => s - 1);
  }

  function assignFlavor(sectionIdx, recipeId) {
    setSectionFlavors(prev => ({ ...prev, [sectionIdx]: recipeId }));
    setActiveSection(null);
    setShowResult(false);
  }

  return (
    <div
      style={{ position:"fixed", inset:0, zIndex:10000, background:"rgba(0,0,0,0.6)",
        backdropFilter:"blur(4px)", display:"flex", alignItems:"flex-end" }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width:"100%", maxHeight:"92vh", background:"#F4F0EB",
          borderRadius:"24px 24px 0 0", display:"flex", flexDirection:"column",
          overflow:"hidden", boxShadow:"0 -8px 40px rgba(0,0,0,0.4)" }}
      >
        {/* ── Header ── */}
        <div style={{ background:"linear-gradient(135deg,var(--app-primary),var(--app-primary-dark))", padding:"16px 20px 14px", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
            <div>
              <div style={{ color:"#D4721A", fontSize:"10px", fontWeight:"700", letterSpacing:"3px", fontFamily:"Georgia,serif", marginBottom:"4px" }}>
                DON TELMO® — 1958 — COMPANY
              </div>
              <div style={{ color:"#fff", fontFamily:"Georgia,serif", fontSize:"20px", fontWeight:"700" }}>
                🍕 Armador de Pizzas
              </div>
            </div>
            <button style={{ background:"rgba(255,255,255,0.15)", border:"none", borderRadius:"8px", color:"#fff", width:"34px", height:"34px", cursor:"pointer", fontSize:"20px", lineHeight:1, flexShrink:0 }} onClick={onClose}>×</button>
          </div>

          {/* Step indicators */}
          <div style={{ display:"flex", alignItems:"center", marginTop:"12px" }}>
            {[1, 2, 3].map((s, i) => (
              <div key={s} style={{ display:"flex", alignItems:"center", flex: i < 2 ? 1 : 0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:"6px", flexShrink:0 }}>
                  <div style={{
                    width:"24px", height:"24px", borderRadius:"50%",
                    background: step > s ? "#D4721A" : step === s ? "#fff" : "rgba(255,255,255,0.18)",
                    color: step > s ? "#fff" : step === s ? "var(--app-primary)" : "rgba(255,255,255,0.45)",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:"11px", fontWeight:"800",
                  }}>
                    {step > s ? "✓" : s}
                  </div>
                  <span style={{ fontSize:"11px", fontWeight:"600", color: step >= s ? "#fff" : "rgba(255,255,255,0.35)", whiteSpace:"nowrap" }}>
                    {STEP_LABELS[i]}
                  </span>
                </div>
                {i < 2 && <div style={{ flex:1, height:"2px", background: step > s ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.18)", margin:"0 8px" }} />}
              </div>
            ))}
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ overflowY:"auto", flex:1 }}>

          {/* STEP 1: Tamaño */}
          {step === 1 && (
            <div style={{ padding:"18px 20px" }}>
              <div style={{ fontSize:"11px", fontWeight:"700", color:"var(--app-primary)", letterSpacing:"1.5px", marginBottom:"14px", textTransform:"uppercase", fontFamily:"Georgia,serif" }}>
                ¿De qué tamaño?
              </div>
              {Object.entries(SIZES).map(([key, sz]) => (
                <div key={key} onClick={() => handleSizeSelect(key)} style={{
                  display:"flex", alignItems:"center", gap:"14px", padding:"14px 16px",
                  borderRadius:"12px", marginBottom:"10px",
                  border:`2px solid ${selectedSuffix === key ? "var(--app-primary)" : "#E0D8CE"}`,
                  background: selectedSuffix === key ? "rgba(27,58,92,0.05)" : "#fff",
                  cursor:"pointer",
                }}>
                  <PizzaVisual portions={[1]} size={sz.cm >= 50 ? 54 : sz.cm >= 40 ? 46 : 38} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontFamily:"Georgia,serif", fontWeight:"700", fontSize:"16px", color:"var(--app-primary)" }}>{sz.label}</div>
                    <div style={{ fontSize:"12px", color:"#888", marginTop:"2px" }}>{sz.cm} cm · {sz.portions} porciones</div>
                  </div>
                  <div style={{
                    width:"22px", height:"22px", borderRadius:"50%", flexShrink:0,
                    border:`2.5px solid ${selectedSuffix === key ? "var(--app-primary)" : "#E0D8CE"}`,
                    background: selectedSuffix === key ? "var(--app-primary)" : "#fff",
                    display:"flex", alignItems:"center", justifyContent:"center",
                  }}>
                    {selectedSuffix === key && <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:"#fff" }} />}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* STEP 2: Configuración */}
          {step === 2 && (
            <div style={{ padding:"18px 20px" }}>
              <div style={{ fontSize:"11px", fontWeight:"700", color:"var(--app-primary)", letterSpacing:"1.5px", marginBottom:"4px", textTransform:"uppercase", fontFamily:"Georgia,serif" }}>
                ¿Cómo la divides?
              </div>
              <div style={{ fontSize:"12px", color:"#888", marginBottom:"14px" }}>{size.label} · {size.cm} cm · {size.portions} porciones</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px" }}>
                {availableCfgs.map(cfg => {
                  const active = activeCfgId === cfg.id;
                  return (
                    <div key={cfg.id} onClick={() => setSelectedCfgId(cfg.id)} style={{
                      padding:"14px 10px 12px", borderRadius:"12px", textAlign:"center",
                      border:`2px solid ${active ? "var(--app-primary)" : "#E0D8CE"}`,
                      background: active ? "rgba(27,58,92,0.05)" : "#fff",
                      cursor:"pointer",
                    }}>
                      <div style={{ display:"flex", justifyContent:"center", marginBottom:"8px" }}>
                        <PizzaVisual portions={cfg.p} size={72} />
                      </div>
                      <div style={{ fontFamily:"Georgia,serif", fontWeight:"700", fontSize:"14px", color:"var(--app-primary)" }}>{cfg.label}</div>
                      <div style={{ fontSize:"11px", color:"#888", marginTop:"2px" }}>{cfg.sub}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: Sabores + Resultado */}
          {step === 3 && selectedCfg && (
            <div style={{ padding:"18px 20px" }}>
              <div style={{ fontSize:"11px", fontWeight:"700", color:"var(--app-primary)", letterSpacing:"1.5px", marginBottom:"4px", textTransform:"uppercase", fontFamily:"Georgia,serif" }}>
                Asigna un sabor por sección
              </div>
              <div style={{ fontSize:"12px", color:"#888", marginBottom:"14px" }}>{selectedCfg.label} · {selectedCfg.sub}</div>

              {/* Pizza preview */}
              <div style={{ display:"flex", justifyContent:"center", marginBottom:"16px" }}>
                <PizzaVisual portions={selectedCfg.p} size={128} />
              </div>

              {/* Section rows */}
              {selectedCfg.p.map((portions, i) => {
                const assigned = sectionFlavors[i] !== undefined
                  ? sameSizeFlavors.find(r => r.id === sectionFlavors[i])
                  : null;
                const open  = activeSection === i;
                const color = SEC_COLORS[i % SEC_COLORS.length];
                return (
                  <div key={i} style={{ marginBottom:"8px" }}>
                    <div onClick={() => setActiveSection(open ? null : i)} style={{
                      display:"flex", alignItems:"center", gap:"10px", padding:"12px 14px",
                      borderRadius: open ? "10px 10px 0 0" : "10px",
                      border:`2px solid ${assigned ? color : "#E0D8CE"}`,
                      background: assigned ? "#F7F3EE" : "#fff",
                      cursor:"pointer",
                    }}>
                      <div style={{
                        width:"32px", height:"32px", borderRadius:"8px", flexShrink:0,
                        background:color, color:"#fff",
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:"11px", fontWeight:"800",
                      }}>
                        {portions}p
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:"11px", color:"#aaa", marginBottom:"2px" }}>Sección {i+1} · {portions} porciones</div>
                        <div style={{ fontFamily:"Georgia,serif", fontWeight:"700", fontSize:"14px", color: assigned ? color : "#C0B8A8" }}>
                          {assigned ? cleanName(assigned.name) : "Toca para seleccionar..."}
                        </div>
                      </div>
                      <span style={{ color:"#bbb", fontSize:"13px" }}>{open ? "▲" : "▼"}</span>
                    </div>
                    {open && (
                      <div style={{ border:`2px solid ${color}`, borderTop:"none", borderRadius:"0 0 10px 10px", background:"#fff", maxHeight:"200px", overflowY:"auto" }}>
                        {sameSizeFlavors.map(r => {
                          const sel = sectionFlavors[i] === r.id;
                          return (
                            <div key={r.id} onClick={() => assignFlavor(i, r.id)} style={{
                              padding:"10px 14px", cursor:"pointer",
                              background: sel ? "#F7F3EE" : "#fff",
                              borderBottom:"1px solid #F0ECE6",
                              fontFamily:"Georgia,serif", fontWeight: sel ? "700" : "600",
                              fontSize:"13px", color: sel ? color : "var(--app-primary)",
                              display:"flex", alignItems:"center", gap:"8px",
                            }}>
                              <span style={{ fontSize:"14px", opacity: sel ? 1 : 0 }}>✓</span>
                              {cleanName(r.name)}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Results */}
              {showResult && results.length > 0 && (
                <div style={{ marginTop:"20px" }}>
                  <div style={{ borderTop:"2px solid #E0D8CE", marginBottom:"16px" }} />
                  <div style={{ fontSize:"11px", fontWeight:"700", color:"var(--app-primary)", letterSpacing:"1.5px", marginBottom:"12px", textTransform:"uppercase", fontFamily:"Georgia,serif" }}>
                    Ingredientes exactos
                  </div>
                  {results.map((r, i) => (
                    <div key={i} style={{ marginBottom:"14px" }}>
                      <div style={{
                        background:r.color, borderRadius:"10px 10px 0 0",
                        padding:"10px 14px", display:"flex", alignItems:"center", gap:"8px",
                      }}>
                        <span style={{ color:"#fff", fontFamily:"Georgia,serif", fontSize:"13px", fontWeight:"700", flex:1 }}>🍕 {r.name}</span>
                        <span style={{ color:"rgba(255,255,255,0.9)", fontSize:"12px", fontWeight:"700", background:"rgba(255,255,255,0.2)", padding:"2px 8px", borderRadius:"6px" }}>
                          {r.portions} porc.
                        </span>
                      </div>
                      <div style={{ border:`2px solid ${r.color}`, borderTop:"none", borderRadius:"0 0 10px 10px", padding:"8px" }}>
                        {r.ingredients.map((ing, j) => (
                          <div key={j} style={{ padding:"6px 10px", fontSize:"13px", color:"#333", borderRadius:"6px", lineHeight:1.4, background: j%2===0 ? "#F7F3EE" : "#fff" }}>
                            • {ing}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* ── Action bar ── */}
        <div style={{ padding:"12px 20px 20px", background:"#fff", borderTop:"2px solid #E0D8CE", flexShrink:0, display:"flex", gap:"10px" }}>
          {step > 1 && (
            <button onClick={goBack} style={{
              flex:1, padding:"13px", border:"2px solid #E0D8CE", borderRadius:"12px",
              background:"#fff", color:"#555", fontWeight:"700", fontSize:"13px",
              cursor:"pointer", fontFamily:"Georgia,serif",
            }}>← Volver</button>
          )}
          {step < 3 ? (
            <button onClick={goNext} style={{
              flex:2, padding:"13px",
              background:"linear-gradient(135deg,var(--app-primary),var(--app-primary-dark))",
              border:"none", borderRadius:"12px", color:"#fff",
              fontSize:"14px", fontWeight:"700", cursor:"pointer", fontFamily:"Georgia,serif",
            }}>
              Siguiente →
            </button>
          ) : (
            <button
              disabled={!allAssigned}
              onClick={() => setShowResult(true)}
              style={{
                flex:2, padding:"13px",
                background: allAssigned
                  ? "linear-gradient(135deg,var(--app-primary),var(--app-primary-dark))"
                  : "#C0B8A8",
                border:"none", borderRadius:"12px", color:"#fff",
                fontSize:"14px", fontWeight:"700",
                cursor: allAssigned ? "pointer" : "not-allowed",
                fontFamily:"Georgia,serif",
              }}>
              {allAssigned ? "Ver ingredientes exactos" : `Faltan ${missingSections} sección${missingSections !== 1 ? "es" : ""}`}
            </button>
          )}
        </div>
        <div style={{ background:"#fff", paddingBottom:"4px", textAlign:"center", color:"#D4721A", fontSize:"11px", fontFamily:"Georgia,serif", fontWeight:"700", letterSpacing:"3px" }}>
          ━━━ DON TELMO® 1958 ━━━
        </div>
      </div>
    </div>
  );
}
