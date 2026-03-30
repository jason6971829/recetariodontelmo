"use client";
import { memo } from "react";
import Image from "next/image";
import { useIsMobile } from "@/hooks/useIsMobile";
import { TextToSpeech } from "@/components/TextToSpeech";
import { useLang } from "@/lib/LangContext";

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

export const RecipeDetail = memo(function RecipeDetail({ recipe, onClose, onEdit, onDelete, onTogglePublish, currentUser }) {
  const isAdmin = currentUser.role === "admin";
  const isMobile = useIsMobile();
  const { t } = useLang();
  const ytId = getYtId(recipe.video);

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
          height:        isMobile ? "95vh" : "auto",
          maxHeight:     isMobile ? "95vh" : "92vh",
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
            </div>
            <div style={S.actionButtons}>
              {isAdmin && <>
                <button onClick={onTogglePublish} style={{ ...S.btnPublish, background: recipe.published ? "#27ae60" : "#7f8c8d" }}>
                  {recipe.published ? "✅ " + t.published : "📝 " + t.draft}
                </button>
                <button onClick={onEdit}   style={S.btnEdit}>{t.detail.edit}</button>
                <button onClick={onDelete} style={S.btnDelete}>🗑️</button>
              </>}
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
          <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap:0 }}>

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
                <TextToSpeech text={recipe.ingredients.join(". ")} label="ingredientes" userId={currentUser?.id} />
              </div>
              {recipe.ingredients.length > 0
                ? recipe.ingredients.map((ing, i) => (
                    <div key={i} style={{ background: i%2===0 ? "#F7F3EE" : "#fff", padding:"7px 10px", borderRadius:"6px", marginBottom:"3px", fontSize:"13px", color:"#333", lineHeight:"1.4" }}>• {ing}</div>
                  ))
                : <div style={S.noText}>{t.detail.noIngredients}</div>
              }
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
    </div>
  );
});
