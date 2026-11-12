"use client";
import { memo, useState, useMemo } from "react";
import Image from "next/image";
import { useIsMobile } from "@/hooks/useIsMobile";
import { TextToSpeech } from "@/components/TextToSpeech";
import { useLang } from "@/lib/LangContext";
import { generateRecipePDF } from "@/lib/recipePDF";
import { printRecipeThermal } from "@/lib/thermalPrint";
import { normalizeIngredient, ingredientToReadable } from "@/lib/ingredients";
import { parseQty, parseNumber, fmtScaled, fmtNum, defaultBaseIndex, GRAMS_PER } from "@/lib/scaleRecipe";
import { PesajeBascula } from "@/components/PesajeBascula";

// ── Estilos estáticos a nivel de módulo (se crean una sola vez) ──
const S = {
  header:         { background:"linear-gradient(135deg,var(--app-primary),var(--app-primary-dark))", padding:"18px 22px 14px", flexShrink:0, position:"relative", zIndex:10 },
  headerRow:      { display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:"12px" },
  headerFlex:     { flex:1, minWidth:0 },
  brandLabel:     { color:"#D4721A", fontSize:"10px", fontWeight:"700", letterSpacing:"3px", marginBottom:"4px", fontFamily:"Georgia,serif" },
  categoryLabel:  { color:"var(--app-primary-light)", fontSize:"11px", marginTop:"4px", letterSpacing:"2px" },
  actionButtons:  { display:"flex", gap:"8px", alignItems:"center", flexShrink:0 },
  btnPublish:     { border:"none", borderRadius:"8px", color:"#fff", padding:"7px 14px", cursor:"pointer", fontSize:"13px", fontWeight:"600" },
  btnEdit:        { background:"#D4721A", border:"none", borderRadius:"8px", color:"#fff", padding:"7px 14px", cursor:"pointer", fontSize:"13px", fontWeight:"600" },
  btnDelete:      { background:"rgba(220,50,50,0.8)", border:"none", borderRadius:"8px", color:"#fff", padding:"7px 12px", cursor:"pointer", fontSize:"13px" },
  btnClose:       { background:"rgba(255,255,255,0.15)", border:"none", borderRadius:"8px", color:"#fff", width:"34px", height:"34px", cursor:"pointer", fontSize:"18px", lineHeight:"1" },
  timesRow:       { display:"flex", gap:"10px", marginTop:"12px", flexWrap:"wrap" },
  timeChip:       { background:"rgba(255,255,255,0.09)", borderRadius:"8px", padding:"6px 12px" },
  timeChipLabel:  { color:"var(--app-primary-light)", fontSize:"10px", fontWeight:"600", letterSpacing:"1px" },
  timeChipValue:  { color:"#fff", fontWeight:"600", fontSize:"13px", marginTop:"2px" },
  bodyScroll:     { overflowY:"auto", flex:1, position:"relative", zIndex:10 },
  colLeft:        { padding:"20px" },
  colRight:       { padding:"20px" },
  imgContainer:   { background:"#F7F3EE", borderRadius:"12px", border:"2px dashed #C0B8A8", minHeight:"160px", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:"18px", overflow:"hidden" },
  noImg:          { textAlign:"center", color:"#C0B8A8", padding:"20px" },
  noImgIcon:      { fontSize:"36px" },
  sectionRow:     { display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"10px" },
  sectionTitle:   { fontFamily:"Georgia,serif", fontWeight:"700", fontSize:"13px", color:"var(--app-primary)", letterSpacing:"1px" },
  sectionTitleOr: { fontFamily:"Georgia,serif", fontWeight:"700", fontSize:"13px", color:"#D4721A", letterSpacing:"1px" },
  prepBox:        { background:"#F7F3EE", borderRadius:"10px", padding:"14px", fontSize:"13px", color:"#333", lineHeight:"1.9", marginBottom:"18px", minHeight:"100px", whiteSpace:"pre-wrap" },
  descBox:        { background:"#F0F4F8", border:"1px solid #C8D6E5", borderRadius:"10px", padding:"14px", fontSize:"13px", color:"#2c3e50", lineHeight:"1.7", marginBottom:"18px", whiteSpace:"pre-wrap" },
  recoBox:        { background:"#FFF8F2", border:"1px solid #E8C9A0", borderRadius:"10px", padding:"14px", fontSize:"13px", color:"#5a3e2b", lineHeight:"1.7", marginBottom:"18px" },
  salesBox:       { background:"linear-gradient(135deg,#FFF8F0,#FFF3E6)", border:"2px solid #D4721A", borderRadius:"10px", padding:"14px", fontSize:"13px", color:"#5a3e2b", lineHeight:"1.7", marginBottom:"18px", whiteSpace:"pre-wrap" },
  videoWrap:      { borderRadius:"10px", overflow:"hidden", aspectRatio:"16/9" },
  videoIframe:    { width:"100%", height:"100%", border:"none" },
  footer:         { borderTop:"1px solid #F0ECE6", padding:"12px 22px", textAlign:"center", color:"#D4721A", fontSize:"11px", fontFamily:"Georgia,serif", fontWeight:"700", letterSpacing:"3px" },
  noText:         { color:"#aaa", fontSize:"13px", fontStyle:"italic" },
  card:           { background:"#fff", width:"100%", maxWidth:"820px", overflow:"hidden", display:"flex", flexDirection:"column", boxShadow:"0 30px 80px rgba(0,0,0,0.5)", position:"relative" },
};

function getYtId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\.\w-]+)/);
  return m ? m[1] : null;
}

export const RecipeDetail = memo(function RecipeDetail({ recipe, onClose, onEdit, onDelete, onTogglePublish, currentUser, brandLabel, brandName, companyTagline }) {
  const isAdmin = currentUser.role === "admin";
  const isMobile = useIsMobile();
  const { t } = useLang();
  const ytId = getYtId(recipe.video);
  const [downloading, setDownloading] = useState(false);

  // ── Calculadora: todo se ajusta en proporción al ingrediente principal ──
  const ings = useMemo(() => (recipe.ingredients || []).map(normalizeIngredient), [recipe.ingredients]);
  const parsed = useMemo(() => ings.map(n => parseQty(n.text)), [ings]);
  const canCalc = parsed.some(Boolean);
  const [calcOn, setCalcOn] = useState(false);
  const [baseIdx, setBaseIdx] = useState(() => defaultBaseIndex(parsed));
  const [have, setHave] = useState("");
  const [pesar, setPesar] = useState(false);
  const base = parsed[baseIdx];
  const haveNum = parseNumber(have);
  const factor = calcOn && base && base.qty > 0 && isFinite(haveNum) && haveNum > 0 ? haveNum / base.qty : 1;
  const setFactor = (f) => base && setHave(fmtNum(base.qty * f, 3));
  const rinde = parseQty(recipe.portions);
  const pesajeItems = () => ings.map((n, i) => {
    const p = parsed[i];
    const name = p?.name || n.text;
    const note = n.code ? `Código ${n.code}` : "";
    if (p && GRAMS_PER[p.unit]) return { name, grams: Math.round(p.qty * factor * GRAMS_PER[p.unit]), note };
    return { name, manual: p ? fmtScaled(p, factor).main : n.text, note };
  });

  async function handleDownloadPDF() {
    setDownloading(true);
    try { await generateRecipePDF(recipe); } finally { setDownloading(false); }
  }

  return (
    <div
      style={{ position:"fixed", inset:0, zIndex:200, background:"rgba(10,15,25,0.88)",
        backdropFilter:"blur(8px)", display:"flex", alignItems:"center",
        justifyContent:"center", padding: isMobile ? "0" : "12px" }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          ...S.card,
          borderRadius:  isMobile ? "20px 20px 0 0" : "18px",
          height:        isMobile ? "calc(var(--app-height, 100vh) * 0.95)" : "auto",
          maxHeight:     isMobile ? "calc(var(--app-height, 100vh) * 0.95)" : "92vh",
          marginTop:     isMobile ? "auto" : "0",
        }}
      >
        {/* Header */}
        <div style={S.header}>
          <div style={S.headerRow}>
            <div style={S.headerFlex}>
              <div style={S.brandLabel}>DON TELMO® — 1958 — COMPANY</div>
              <div style={{ color:"#fff", fontFamily:"Georgia,serif", fontSize: isMobile?"18px":"22px", fontWeight:"700", lineHeight:"1.2", wordBreak:"break-word" }}>
                {recipe.name}
              </div>
              <div style={S.categoryLabel}>{recipe.category.toUpperCase()}</div>
              {recipe.barcode && (
                <div style={{ marginTop:6, display:"inline-flex", alignItems:"center", gap:6, background:"rgba(167,139,250,0.25)", border:"1px solid rgba(167,139,250,0.5)", borderRadius:6, padding:"3px 9px" }}>
                  <span style={{ color:"#C4B5FD", fontSize:"9px", fontWeight:"700", letterSpacing:"1px" }}>BARCODE</span>
                  <span style={{ color:"#fff", fontSize:"12px", fontWeight:"700", fontFamily:"monospace" }}>{recipe.barcode}</span>
                </div>
              )}
            </div>
            <div style={{ ...S.actionButtons, flexWrap: isMobile ? "wrap" : "nowrap", justifyContent:"flex-end" }}>
              {/* En mobile solo iconos para ahorrar espacio */}
              {isAdmin && <>
                {!isMobile && (
                  <button onClick={onTogglePublish} style={{ ...S.btnPublish, background: recipe.published ? "#27ae60" : "#7f8c8d" }}>
                    {recipe.published ? "✅ " + t.published : "📝 " + t.draft}
                  </button>
                )}
                {isMobile && (
                  <button onClick={onTogglePublish} style={{ background: recipe.published ? "#27ae60" : "#7f8c8d", border:"none", borderRadius:"8px", color:"#fff", padding:"7px 10px", cursor:"pointer", fontSize:"14px" }}>
                    {recipe.published ? "✅" : "📝"}
                  </button>
                )}
                <button onClick={onEdit} style={{ ...S.btnEdit, padding: isMobile ? "7px 10px" : "7px 14px" }}>
                  {isMobile ? "✏️" : t.detail.edit}
                </button>
                <button onClick={onDelete} style={S.btnDelete}>🗑️</button>
              </>}
              <button
                onClick={() => printRecipeThermal(recipe, { label: brandLabel, name: brandName, tagline: companyTagline })}
                title="Imprimir en impresora térmica 80mm"
                style={{ background:"#1B3A5C", border:"none", borderRadius:"8px", color:"#fff", padding:"7px 12px", cursor:"pointer", fontSize:"14px", flexShrink:0 }}
              >
                🖨️
              </button>
              <button
                onClick={handleDownloadPDF}
                disabled={downloading}
                title="Descargar PDF"
                style={{ background: downloading ? "#555" : "#D4721A", border:"none", borderRadius:"8px", color:"#fff", padding:"7px 12px", cursor: downloading ? "wait" : "pointer", fontSize:"14px", opacity: downloading ? 0.7 : 1, flexShrink:0 }}
              >
                {downloading ? "⏳" : "📄"}
              </button>
              <button onClick={onClose} style={S.btnClose}>×</button>
            </div>
          </div>
          <div style={S.timesRow}>
            {[[`⏱ ${t.detail.prep}`, recipe.prepTime||"—"],[`🔥 ${t.detail.cook}`, recipe.cookTime||"—"],[`🍽 ${t.detail.portions}`, recipe.portions||"—"]].map(([l,v])=>(
              <div key={l} style={S.timeChip}>
                <div style={S.timeChipLabel}>{l}</div>
                <div style={S.timeChipValue}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={S.bodyScroll}>
          <div style={{ display:"grid", gridTemplateColumns: isMobile ? "minmax(0,1fr)" : "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap:0 }}>

            {/* Izquierda: imagen + ingredientes */}
            <div style={{ ...S.colLeft, borderRight: isMobile ? "none" : "1px solid #F0ECE6", borderBottom: isMobile ? "1px solid #F0ECE6" : "none" }}>
              <div style={S.imgContainer}>
                {recipe.image
                  ? <Image width={800} height={500} src={recipe.image} alt={recipe.name} style={{ width:"100%", height:"auto", objectFit:"cover", borderRadius:"10px" }} />
                  : <div style={S.noImg}>
                      <div style={S.noImgIcon}>📷</div>
                      <div style={{ fontSize:"12px", marginTop:"6px" }}>{t.detail.noImage}</div>
                    </div>
                }
              </div>

              <div style={S.sectionRow}>
                <div style={S.sectionTitle}>{t.detail.ingredients}</div>
                <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                  {canCalc && (
                    <button onClick={() => { setCalcOn(c => !c); setHave(""); }} title="Calcular en proporción"
                      style={{ background: calcOn ? "#D4721A" : "#fff", color: calcOn ? "#fff" : "#D4721A", border:"1.5px solid #D4721A", borderRadius:"8px", padding:"5px 10px", cursor:"pointer", fontSize:"12px", fontWeight:"700" }}>
                      🧮 {calcOn ? "Cerrar" : "Calcular"}
                    </button>
                  )}
                  <TextToSpeech text={recipe.ingredients.map(ingredientToReadable).join(". ")} label="ingredientes" userId={currentUser?.id} />
                </div>
              </div>

              {calcOn && base && (
                <div style={{ background:"#FFF8F2", border:"1.5px solid #E8C9A0", borderRadius:"10px", padding:"12px", marginBottom:"10px" }}>
                  <div style={{ fontSize:"12px", color:"#8a6a4e", fontWeight:"700", marginBottom:"6px" }}>INGREDIENTE PRINCIPAL</div>
                  <select value={baseIdx} onChange={e => { setBaseIdx(Number(e.target.value)); setHave(""); }}
                    style={{ width:"100%", padding:"8px", borderRadius:"8px", border:"1.5px solid #E0D8CE", fontSize:"13px", fontWeight:"700", color:"#3a2f29", background:"#fff", marginBottom:"8px" }}>
                    {parsed.map((p, i) => p && <option key={i} value={i}>{p.name || ings[i].text} ({fmtNum(p.qty)} {p.unitRaw})</option>)}
                  </select>
                  <label style={{ display:"flex", alignItems:"center", gap:"8px", fontSize:"13px", fontWeight:"700", color:"#3a2f29" }}>
                    ¿Cuánto tenés?
                    <input inputMode="decimal" value={have} placeholder={fmtNum(base.qty)} onChange={e => setHave(e.target.value.replace(/[^0-9.,]/g, ""))} onFocus={e => e.target.select()}
                      style={{ flex:1, minWidth:0, padding:"9px 10px", borderRadius:"8px", border:"2px solid #D4721A", fontSize:"18px", fontWeight:"800", textAlign:"right", color:"#3a2f29" }} />
                    <span>{base.unitRaw}</span>
                  </label>
                  <div style={{ display:"flex", gap:"6px", marginTop:"8px", flexWrap:"wrap", alignItems:"center" }}>
                    {[0.25, 0.5, 1, 2, 3].map(f => (
                      <button key={f} onClick={() => setFactor(f)} style={{ border:"1.5px solid #E0D8CE", background: Math.abs(factor - f) < 1e-9 ? "#1B3A5C" : "#fff", color: Math.abs(factor - f) < 1e-9 ? "#fff" : "#3a2f29", borderRadius:"8px", padding:"4px 10px", fontSize:"12px", fontWeight:"700", cursor:"pointer" }}>×{fmtNum(f, 2)}</button>
                    ))}
                    <span style={{ marginLeft:"auto", fontSize:"12px", fontWeight:"700", color:"#8a6a4e" }}>
                      Receta ×{fmtNum(factor, 3)}{rinde ? ` · rinde ${fmtScaled(rinde, factor).main}` : ""}
                    </span>
                  </div>
                  <button onClick={() => setPesar(true)} style={{ width:"100%", marginTop:"10px", background:"#D4721A", border:"none", borderRadius:"8px", color:"#fff", padding:"10px", cursor:"pointer", fontSize:"14px", fontWeight:"800" }}>
                    ⚖️ Pesar con la báscula
                  </button>
                </div>
              )}

              {ings.length > 0
                ? ings.map((n, i) => {
                    const p = parsed[i];
                    const isBase = calcOn && i === baseIdx;
                    const sc = calcOn && p ? fmtScaled(p, factor) : null;
                    return (
                      <div key={i} onClick={calcOn && p ? () => { setBaseIdx(i); setHave(""); } : undefined}
                        style={{ background: isBase ? "#FBEFE3" : i%2===0 ? "#F7F3EE" : "#fff", border: isBase ? "1.5px solid #D4721A" : "1.5px solid transparent", padding:"7px 10px", borderRadius:"6px", marginBottom:"3px", fontSize:"13px", color:"#333", lineHeight:"1.4", display:"flex", alignItems:"center", gap:"8px", cursor: calcOn && p ? "pointer" : "default" }}>
                        {n.code && (
                          <span style={{ background:"#D4721A", color:"#fff", borderRadius:"4px", padding:"2px 7px", fontSize:"10px", fontWeight:"700", letterSpacing:"0.5px", flexShrink:0, fontFamily:"monospace" }}>{n.code}</span>
                        )}
                        {sc ? (
                          <span style={{ flex:1, minWidth:0 }}>
                            <b style={{ color: isBase ? "#D4721A" : "#1B3A5C" }}>{sc.main}</b>
                            {sc.sub && <span style={{ color:"#8a7a6e", fontSize:"11px" }}> · {sc.sub}</span>}
                            {" - "}{p.name}{isBase && <span style={{ color:"#D4721A", fontSize:"11px", fontWeight:"700" }}> ★ principal</span>}
                          </span>
                        ) : <span>{n.text}</span>}
                      </div>
                    );
                  })
                : <div style={S.noText}>{t.detail.noIngredients}</div>
              }
              {calcOn && <div style={{ fontSize:"11px", color:"#8a7a6e", marginTop:"6px" }}>Tocá un ingrediente para usarlo como principal. Lo calculado no cambia la receta guardada.</div>}
            </div>

            {/* Derecha: preparación + secciones */}
            <div style={S.colRight}>
              <div style={S.sectionRow}>
                <div style={S.sectionTitle}>{t.detail.preparation}</div>
                <TextToSpeech text={recipe.preparation} label="preparación" userId={currentUser?.id} />
              </div>
              <div style={S.prepBox}>
                {recipe.preparation || <span style={S.noText}>{t.detail.noPreparation}</span>}
              </div>

              {recipe.description && <>
                <div style={S.sectionRow}>
                  <div style={S.sectionTitle}>{t.detail.description}</div>
                  <TextToSpeech text={recipe.description} label="descripción" userId={currentUser?.id} />
                </div>
                <div style={S.descBox}>{recipe.description}</div>
              </>}

              {recipe.recommendations && <>
                <div style={S.sectionRow}>
                  <div style={S.sectionTitle}>{t.detail.recommendations}</div>
                  <TextToSpeech text={recipe.recommendations} label="recomendaciones" userId={currentUser?.id} />
                </div>
                <div style={S.recoBox}>{recipe.recommendations}</div>
              </>}

              {recipe.salesPitch && <>
                <div style={S.sectionRow}>
                  <div style={S.sectionTitleOr}>{t.detail.salesPitch}</div>
                  <TextToSpeech text={recipe.salesPitch} label="aprende a vender" userId={currentUser?.id} />
                </div>
                <div style={S.salesBox}>{recipe.salesPitch}</div>
              </>}

              {recipe.video && <>
                <div style={{ ...S.sectionTitle, marginBottom:"10px" }}>{t.detail.video}</div>
                {ytId
                  ? <div style={S.videoWrap}>
                      <iframe src={`https://www.youtube.com/embed/${ytId}`} style={S.videoIframe} allowFullScreen title="Video" />
                    </div>
                  : <a href={recipe.video} target="_blank" rel="noreferrer" style={{ color:"#D4721A", fontSize:"13px" }}>{t.detail.watchVideo}</a>
                }
              </>}
            </div>
          </div>

          <div style={S.footer}>━━━ DON TELMO® 1958 ━━━</div>
        </div>
      </div>
      {pesar && (
        <PesajeBascula
          title={recipe.name}
          subtitle={base ? `${fmtScaled(base, factor).main} de ${base.name || "principal"} · receta ×${fmtNum(factor, 3)}` : ""}
          items={pesajeItems()}
          onClose={() => setPesar(false)}
        />
      )}
    </div>
  );
});
