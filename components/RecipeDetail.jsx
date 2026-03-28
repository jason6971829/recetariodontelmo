"use client";
import { useIsMobile } from "@/hooks/useIsMobile";
import { TextToSpeech } from "@/components/TextToSpeech";
import { useLang } from "@/lib/LangContext";

export function RecipeDetail({ recipe, onClose, onEdit, onDelete, onTogglePublish, currentUser }) {
  const isAdmin = currentUser.role === "admin";
  const isMobile = useIsMobile();
  const { t } = useLang();

  function getYtId(url) {
    if (!url) return null;
    const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\.\w-]+)/);
    return m ? m[1] : null;
  }
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
          background:"#fff", borderRadius: isMobile ? "20px 20px 0 0" : "18px",
          width:"100%", maxWidth:"820px",
          height: isMobile ? "95vh" : "auto",
          maxHeight: isMobile ? "95vh" : "92vh",
          marginTop: isMobile ? "auto" : "0",
          overflow:"hidden", display:"flex", flexDirection:"column",
          boxShadow:"0 30px 80px rgba(0,0,0,0.5)", position:"relative"
        }}
      >
        {/* Header */}
        <div style={{ background:"linear-gradient(135deg,#1B3A5C,#0d2340)", padding:"18px 22px 14px", flexShrink:0, position:"relative", zIndex:10 }}>
          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:"12px" }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ color:"#D4721A", fontSize:"10px", fontWeight:"700", letterSpacing:"3px", marginBottom:"4px", fontFamily:"Georgia,serif" }}>
                DON TELMO® — 1958 — COMPANY
              </div>
              <div style={{ color:"#fff", fontFamily:"Georgia,serif", fontSize: isMobile?"18px":"22px", fontWeight:"700", lineHeight:"1.2", wordBreak:"break-word" }}>
                {recipe.name}
              </div>
              <div style={{ color:"#8BAACC", fontSize:"11px", marginTop:"4px", letterSpacing:"2px" }}>
                {recipe.category.toUpperCase()}
              </div>
            </div>
            <div style={{ display:"flex", gap:"8px", alignItems:"center", flexShrink:0 }}>
              {isAdmin && <>
                <button onClick={onTogglePublish} style={{ background: recipe.published ? "#27ae60" : "#7f8c8d", border:"none", borderRadius:"8px", color:"#fff", padding:"7px 14px", cursor:"pointer", fontSize:"13px", fontWeight:"600" }}>
                  {recipe.published ? "✅ " + t.published : "📝 " + t.draft}
                </button>
                <button onClick={onEdit}  style={{ background:"#D4721A", border:"none", borderRadius:"8px", color:"#fff", padding:"7px 14px", cursor:"pointer", fontSize:"13px", fontWeight:"600" }}>{t.detail.edit}</button>
                <button onClick={onDelete} style={{ background:"rgba(220,50,50,0.8)", border:"none", borderRadius:"8px", color:"#fff", padding:"7px 12px", cursor:"pointer", fontSize:"13px" }}>🗑️</button>
              </>}
              <button onClick={onClose} style={{ background:"rgba(255,255,255,0.15)", border:"none", borderRadius:"8px", color:"#fff", width:"34px", height:"34px", cursor:"pointer", fontSize:"18px", lineHeight:"1" }}>×</button>
            </div>
          </div>
          {/* Times */}
          <div style={{ display:"flex", gap:"10px", marginTop:"12px", flexWrap:"wrap" }}>
            {[[`⏱ ${t.detail.prep}`, recipe.prepTime||"—"],[`🔥 ${t.detail.cook}`, recipe.cookTime||"—"],[`🍽 ${t.detail.portions}`, recipe.portions||"—"]].map(([l,v])=>(
              <div key={l} style={{ background:"rgba(255,255,255,0.09)", borderRadius:"8px", padding:"6px 12px" }}>
                <div style={{ color:"#8BAACC", fontSize:"10px", fontWeight:"600", letterSpacing:"1px" }}>{l}</div>
                <div style={{ color:"#fff", fontWeight:"600", fontSize:"13px", marginTop:"2px" }}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ overflowY:"auto", flex:1, position:"relative", zIndex:10 }}>
          <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap:0 }}>

            {/* Izquierda: imagen + ingredientes */}
            <div style={{ padding:"20px", borderRight: isMobile ? "none" : "1px solid #F0ECE6", borderBottom: isMobile ? "1px solid #F0ECE6" : "none" }}>
              <div style={{
                background:"#F7F3EE", borderRadius:"12px", border:"2px dashed #C0B8A8",
                minHeight:"160px", display:"flex", alignItems:"center", justifyContent:"center",
                marginBottom:"18px", overflow:"hidden"
              }}>
                {recipe.image
                  ? <img src={recipe.image} alt={recipe.name} style={{ width:"100%", objectFit:"cover", borderRadius:"10px" }} />
                  : <div style={{ textAlign:"center", color:"#C0B8A8", padding:"20px" }}>
                      <div style={{ fontSize:"36px" }}>📷</div>
                      <div style={{ fontSize:"12px", marginTop:"6px" }}>{t.detail.noImage}</div>
                    </div>
                }
              </div>

              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"10px" }}>
                <div style={{ fontFamily:"Georgia,serif", fontWeight:"700", fontSize:"13px", color:"#1B3A5C", letterSpacing:"1px" }}>{t.detail.ingredients}</div>
                <TextToSpeech text={recipe.ingredients.join(". ")} label="ingredientes" userId={currentUser?.id} />
              </div>
              {recipe.ingredients.length > 0
                ? recipe.ingredients.map((ing, i) => (
                    <div key={i} style={{
                      background: i%2===0 ? "#F7F3EE" : "#fff",
                      padding:"7px 10px", borderRadius:"6px", marginBottom:"3px",
                      fontSize:"13px", color:"#333", lineHeight:"1.4"
                    }}>• {ing}</div>
                  ))
                : <div style={{ color:"#aaa", fontSize:"13px", fontStyle:"italic" }}>{t.detail.noIngredients}</div>
              }
            </div>

            {/* Derecha: preparación + recomendaciones + video */}
            <div style={{ padding:"20px" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"10px" }}>
                <div style={{ fontFamily:"Georgia,serif", fontWeight:"700", fontSize:"13px", color:"#1B3A5C", letterSpacing:"1px" }}>{t.detail.preparation}</div>
                <TextToSpeech text={recipe.preparation} label="preparación" userId={currentUser?.id} />
              </div>
              <div style={{ background:"#F7F3EE", borderRadius:"10px", padding:"14px", fontSize:"13px", color:"#333", lineHeight:"1.9", marginBottom:"18px", minHeight:"100px", whiteSpace:"pre-wrap" }}>
                {recipe.preparation || <span style={{ color:"#aaa", fontStyle:"italic" }}>{t.detail.noPreparation}</span>}
              </div>

              {/* Descripción */}
              {recipe.description && <>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"10px" }}>
                  <div style={{ fontFamily:"Georgia,serif", fontWeight:"700", fontSize:"13px", color:"#1B3A5C", letterSpacing:"1px" }}>{t.detail.description}</div>
                  <TextToSpeech text={recipe.description} label="descripción" userId={currentUser?.id} />
                </div>
                <div style={{ background:"#F0F4F8", border:"1px solid #C8D6E5", borderRadius:"10px", padding:"14px", fontSize:"13px", color:"#2c3e50", lineHeight:"1.7", marginBottom:"18px", whiteSpace:"pre-wrap" }}>
                  {recipe.description}
                </div>
              </>}

              {recipe.recommendations && <>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"10px" }}>
                  <div style={{ fontFamily:"Georgia,serif", fontWeight:"700", fontSize:"13px", color:"#1B3A5C", letterSpacing:"1px" }}>{t.detail.recommendations}</div>
                  <TextToSpeech text={recipe.recommendations} label="recomendaciones" userId={currentUser?.id} />
                </div>
                <div style={{ background:"#FFF8F2", border:"1px solid #E8C9A0", borderRadius:"10px", padding:"14px", fontSize:"13px", color:"#5a3e2b", lineHeight:"1.7", marginBottom:"18px" }}>
                  {recipe.recommendations}
                </div>
              </>}

              {/* Aprende a Vender */}
              {recipe.salesPitch && <>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"10px" }}>
                  <div style={{ fontFamily:"Georgia,serif", fontWeight:"700", fontSize:"13px", color:"#D4721A", letterSpacing:"1px" }}>{t.detail.salesPitch}</div>
                  <TextToSpeech text={recipe.salesPitch} label="aprende a vender" userId={currentUser?.id} />
                </div>
                <div style={{ background:"linear-gradient(135deg, #FFF8F0, #FFF3E6)", border:"2px solid #D4721A", borderRadius:"10px", padding:"14px", fontSize:"13px", color:"#5a3e2b", lineHeight:"1.7", marginBottom:"18px", whiteSpace:"pre-wrap" }}>
                  {recipe.salesPitch}
                </div>
              </>}

              {recipe.video && <>
                <div style={{ fontFamily:"Georgia,serif", fontWeight:"700", fontSize:"13px", color:"#1B3A5C", marginBottom:"10px", letterSpacing:"1px" }}>{t.detail.video}</div>
                {ytId
                  ? <div style={{ borderRadius:"10px", overflow:"hidden", aspectRatio:"16/9" }}>
                      <iframe src={`https://www.youtube.com/embed/${ytId}`} style={{ width:"100%", height:"100%", border:"none" }} allowFullScreen title="Video" />
                    </div>
                  : <a href={recipe.video} target="_blank" rel="noreferrer" style={{ color:"#D4721A", fontSize:"13px" }}>{t.detail.watchVideo}</a>
                }
              </>}
            </div>
          </div>

          <div style={{ borderTop:"1px solid #F0ECE6", padding:"12px 22px", textAlign:"center", color:"#D4721A", fontSize:"11px", fontFamily:"Georgia,serif", fontWeight:"700", letterSpacing:"3px" }}>
            ━━━ DON TELMO® 1958 ━━━
          </div>
        </div>
      </div>
    </div>
  );
}
