"use client";
import { useState, useRef, useEffect } from "react";
import { useViewport } from "@/hooks/useViewport";
import { VoiceTextarea } from "@/components/VoiceTextarea";
import { CATEGORIES } from "@/lib/constants";
import { uploadImage } from "@/lib/storage";
import { useLang } from "@/lib/LangContext";
import { normalizeIngredient, ingredientToString } from "@/lib/ingredients";
import { InsumoSelector } from "@/components/InsumoSelector";
import { ProductoSelector } from "@/components/ProductoSelector";

// Constantes de estilo a nivel de módulo — no se recrean en cada render
// Rediseño Don Telmo: campos h50, radio 14, Manrope; etiquetas en mayúscula con tracking
const inp = { width:"100%", height:50, padding:"0 14px", border:"1.5px solid #E7E1D7", borderRadius:14, fontSize:16, fontWeight:600, color:"#0E2240", outline:"none", boxSizing:"border-box", fontFamily:"var(--dt-sans)", background:"#fff" };
const lbl = { fontSize:11, fontWeight:800, color:"#0E2240", letterSpacing:".16em", textTransform:"uppercase", display:"block", marginBottom:7, fontFamily:"var(--dt-sans)" };

const AUTOSAVE_MS = 800;

export function RecipeForm({ initial, categories, bodegaSubcategories = [], onSave, onCancel }) {
  const cats = (categories || CATEGORIES).filter(c => c.id !== "all");
  // Asegurar que "RECETAS BODEGA" sea seleccionable como categoria aunque no este en allCategories
  if (!cats.some(c => c.id === "RECETAS BODEGA")) {
    cats.push({ id: "RECETAS BODEGA", label: "🏭 Recetas Bodega", icon: "🏭" });
  }
  const [form, setForm] = useState(initial || {
    name:"", category:"Adiciones", prepTime:"", cookTime:"", portions:"",
    ingredients:[], preparation:"", recommendations:"", image:null, video:"",
    description:"", salesPitch:"", subcategory:"", barcode:""
  });
  const [currentId, setCurrentId] = useState(initial?.id || null);
  const [editingIdx, setEditingIdx] = useState(null);
  const [editingVal, setEditingVal] = useState("");
  const [editingCode, setEditingCode] = useState("");
  const [imagePreview, setImagePreview] = useState(initial?.image || null);
  // Bump al seleccionar archivo para disparar autosave (sin contaminar form)
  const [pendingImageBump, setPendingImageBump] = useState(0);
  // Estado del autosave: "idle" | "saving" | "saved" | "error" | "blocked"
  const [saveState, setSaveState] = useState("idle");
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const fileRef = useRef();
  const pendingFileRef = useRef(null);
  const saveTimerRef = useRef(null);
  const isFirstRenderRef = useRef(true);
  const inFlightRef = useRef(false);
  const { mobile: isMobile } = useViewport();
  const { t } = useLang();

  const set = (k, v) => setForm(f => ({...f, [k]:v}));

  // ─── Autosave debounceado ──────────────────────────────────────
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    if (!form.name.trim()) {
      setSaveState("blocked");
      return;
    }
    setSaveState("saving");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => { doAutoSave(); }, AUTOSAVE_MS);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, pendingImageBump]);

  const doAutoSave = async () => {
    if (inFlightRef.current) return; // evitar overlapping
    inFlightRef.current = true;
    try {
      let imageUrl = form.image;
      if (pendingFileRef.current) {
        const url = await uploadImage(pendingFileRef.current);
        if (url) { imageUrl = url; pendingFileRef.current = null; setForm(f => ({ ...f, image: url })); }
      }
      const payload = { ...form, image: imageUrl, ...(currentId ? { id: currentId } : {}) };
      const saved = await onSave(payload);
      if (saved?.id && !currentId) setCurrentId(saved.id);
      setSaveState("saved");
      setLastSavedAt(new Date());
    } catch (err) {
      console.error("autosave error:", err);
      setSaveState("error");
    } finally {
      inFlightRef.current = false;
    }
  };

  // Texto del indicador
  const saveLabel = (() => {
    if (saveState === "blocked") return "Esperando nombre...";
    if (saveState === "saving") return "Guardando...";
    if (saveState === "saved") return lastSavedAt ? "Guardado" : "Guardado";
    if (saveState === "error") return "Error al guardar (reintenta editando algo)";
    return "Listo";
  })();
  const saveColor = saveState === "error" ? "#FFB1AB"
    : saveState === "saving" ? "#F0A35E"
    : saveState === "saved"  ? "#6FD3A8"
    : "rgba(255,255,255,.6)";
  // Recibe string del InsumoSelector: "20 GRAMOS - Cebolla Morada | 227"
  const addIngFromSelector = (ingString) => {
    if (!ingString || !ingString.trim()) return;
    set("ingredients", [...form.ingredients, ingString.trim()]);
  };
  const removeIng = i => set("ingredients", form.ingredients.filter((_,idx)=>idx!==i));
  const startEdit = (i, ing) => {
    const n = normalizeIngredient(ing);
    setEditingIdx(i); setEditingVal(n.text); setEditingCode(n.code);
  };
  const saveEdit = () => {
    if (editingIdx === null) return;
    if (editingVal.trim()) {
      // Guardar como string canonico "texto | codigo"
      const code = editingCode.trim();
      const text = editingVal.trim();
      const updated = code ? `${text} | ${code}` : text;
      set("ingredients", form.ingredients.map((ing, idx) => idx === editingIdx ? updated : ing));
    }
    setEditingIdx(null); setEditingVal(""); setEditingCode("");
  };
  const handleImage = e => {
    const file = e.target.files[0]; if (!file) return;
    pendingFileRef.current = file;
    // Preview local inmediato. El upload + persistencia los maneja el autosave.
    const r = new FileReader();
    r.onload = ev => { setImagePreview(ev.target.result); };
    r.readAsDataURL(file);
    // Disparar autosave (sin tocar form para no contaminar el payload)
    setPendingImageBump(b => b + 1);
  };

  return (
    <div className="dt-scope" style={{ position:"fixed", inset:0, zIndex:300, background:"rgba(9,24,49,.55)", backdropFilter:"blur(6px)", WebkitBackdropFilter:"blur(6px)", animation:"dtFade .25s both", display:"flex", alignItems: isMobile?"flex-end":"center", justifyContent:"center", padding: isMobile?0:24, fontFamily:"var(--dt-sans)", color:"#14213D" }}>
      <div style={{ background:"#fff", borderRadius: isMobile?"24px 24px 0 0":24, width:"100%", maxWidth:780, maxHeight: isMobile?"94vh":"min(92vh, 1000px)", overflow:"hidden", display:"flex", flexDirection:"column", boxShadow:"0 40px 80px -20px rgba(0,0,0,.5)", animation: isMobile ? "dtSheet .4s cubic-bezier(.2,.8,.2,1) both" : "dtPop .35s cubic-bezier(.2,.8,.2,1) both" }}>
        <div style={{ background:"linear-gradient(160deg,#16325A,#0E2240)", color:"#fff", padding: isMobile ? "14px 18px" : "20px 28px", display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, flexShrink:0 }}>
          <div style={{ display:"flex", flexDirection:"column", gap:3, minWidth:0 }}>
            <span style={{ color:"#F0A35E", fontSize:10, fontWeight:700, letterSpacing:".22em" }}>DON TELMO® RECETARIO</span>
            <span style={{ fontFamily:"var(--dt-serif)", fontSize: isMobile ? 20 : 24, fontWeight:600 }}>{initial || currentId ? t.form.editTitle : t.form.newTitle}</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{
              display:"inline-flex", alignItems:"center", gap:7, whiteSpace:"nowrap",
              background:"rgba(255,255,255,.1)", borderRadius:999,
              height:30, padding:"0 12px", fontSize:12, fontWeight:700, color:saveColor,
            }}>
              <span style={{
                display:"inline-block", width:"7px", height:"7px", borderRadius:"50%",
                background: saveColor,
                animation: saveState === "saving" ? "pulse 1s ease-in-out infinite" : "none",
              }} />
              {saveLabel}
            </div>
            <button onClick={onCancel} aria-label="Cerrar" style={{ width:42, height:42, borderRadius:12, border:0, background:"rgba(255,255,255,.1)", color:"#fff", cursor:"pointer", flex:"none", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
        </div>
        <style>{`@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.3 } }`}</style>

        <div style={{ overflowY:"auto", flex:1, padding: isMobile ? 18 : 28, display:"flex", flexDirection:"column", gap:18 }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap:14 }}>
            <div style={{ gridColumn:"1/-1" }}>
              <label style={lbl}>{t.form.nameLabel}</label>
              <ProductoSelector
                value={form.name}
                source={form.category === "RECETAS BODEGA" ? "insumos" : "productos"}
                onChange={(name) => set("name", name)}
                onSelect={(p) => setForm(f => ({ ...f, name: p.nombre, barcode: p.barcode || "" }))}
                allowFree={true}
              />
              {form.barcode && (
                <div style={{ marginTop:6, display:"flex", alignItems:"center", gap:8, fontSize:12 }}>
                  <span style={{ background:"#FBEBDD", color:"#B85E10", borderRadius:7, padding:"3px 9px", fontWeight:700, fontFamily:"ui-monospace,Menlo,monospace" }}>
                    barcode {form.barcode}
                  </span>
                  <span style={{ color:"#888" }}>vinculado al producto de gabycontrol</span>
                  <button
                    type="button"
                    onClick={() => set("barcode", "")}
                    style={{ background:"none", border:"none", color:"#c0392b", cursor:"pointer", fontSize:11, fontWeight:700 }}
                    title="Quitar el barcode (para sub-recetas o bases sin producto)"
                  >quitar ×</button>
                </div>
              )}
            </div>
            <div>
              <label style={lbl}>{t.form.categoryLabel}</label>
              <select style={inp} value={form.category} onChange={e=>set("category",e.target.value)}>
                {cats.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            {form.category === "RECETAS BODEGA" && (
              <div>
                <label style={lbl}>Sub-categoria (bodega)</label>
                <input
                  style={inp}
                  list="bodega-subs"
                  value={form.subcategory || ""}
                  onChange={e=>set("subcategory", e.target.value)}
                  placeholder="ej: Carnes y proteinas"
                />
                <datalist id="bodega-subs">
                  {bodegaSubcategories.map(s => <option key={s} value={s} />)}
                </datalist>
              </div>
            )}
            <div>
              <label style={lbl}>{t.form.portionsLabel}</label>
              <input style={inp} value={form.portions} onChange={e=>set("portions",e.target.value)} placeholder={t.form.portionsPlaceholder} />
            </div>
            <div>
              <label style={lbl}>{t.form.prepLabel}</label>
              <input style={inp} value={form.prepTime} onChange={e=>set("prepTime",e.target.value)} placeholder={t.form.prepPlaceholder} />
            </div>
            <div>
              <label style={lbl}>{t.form.cookLabel}</label>
              <input style={inp} value={form.cookTime} onChange={e=>set("cookTime",e.target.value)} placeholder={t.form.cookPlaceholder} />
            </div>
          </div>

          <div>
            <label style={lbl}>{t.form.ingredientsLabel}</label>
            <div style={{ marginBottom: 10, background:"#FFFAF5", border:"1.5px solid #F1D9C2", borderRadius:16, padding:10 }}>
              <InsumoSelector onAdd={addIngFromSelector} />
            </div>
            {form.ingredients.map((ing,i)=>{
              const n = normalizeIngredient(ing);
              return (
                <div key={i} style={{ display:"flex", gap:6, alignItems:"center", marginBottom:4 }}>
                  {editingIdx === i ? (
                    <>
                      <input
                        style={{...inp, width:92, height:44, padding:"0 8px", textAlign:"center", fontWeight:800, color:"#B85E10", fontFamily:"ui-monospace,Menlo,monospace"}}
                        value={editingCode}
                        onChange={e=>setEditingCode(e.target.value.replace(/[^0-9]/g,""))}
                        onKeyDown={e=>{ if(e.key==="Enter") saveEdit(); if(e.key==="Escape") setEditingIdx(null); }}
                        placeholder="ID"
                        maxLength={5}
                      />
                      <input
                        autoFocus
                        style={{...inp, flex:1, height:44}}
                        value={editingVal}
                        onChange={e=>setEditingVal(e.target.value)}
                        onBlur={saveEdit}
                        onKeyDown={e=>{ if(e.key==="Enter") saveEdit(); if(e.key==="Escape") setEditingIdx(null); }}
                      />
                    </>
                  ) : (
                    <div onClick={()=>startEdit(i,ing)} style={{ flex:1, minWidth:0, background: i % 2 ? "#fff" : "#FAF8F4", border:"1px solid #F0ECE5", borderRadius:12, minHeight:44, padding:"6px 12px", fontSize:14, color:"#3C3A36", cursor:"text", display:"flex", alignItems:"center", gap:10 }}>
                      {n.code ? (
                        <span style={{ background:"#FBEBDD", color:"#B85E10", borderRadius:6, padding:"3px 7px", fontSize:10.5, fontWeight:700, fontFamily:"ui-monospace,Menlo,monospace", flexShrink:0 }}>{n.code}</span>
                      ) : (
                        <span style={{ background:"#fff", color:"#C8423B", border:"1px dashed #D9731A", borderRadius:6, padding:"2px 7px", fontSize:10.5, fontWeight:700, flexShrink:0 }}>sin ID</span>
                      )}
                      <span style={{ minWidth:0 }}>{n.text}</span>
                    </div>
                  )}
                  <button onClick={()=>removeIng(i)} aria-label="Quitar ingrediente" style={{ width:36, height:36, borderRadius:10, border:"1.5px solid #E7E1D7", background:"#fff", color:"#C8423B", cursor:"pointer", flex:"none", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                  </button>
                </div>
              );
            })}
          </div>

          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:7 }}>
              <label style={{...lbl, marginBottom:0}}>{t.form.preparationLabel}</label>
              <span style={{ fontSize:11, color:"#A39D92", fontWeight:600 }}>{t.form.dictate}</span>
            </div>
            <VoiceTextarea
              value={form.preparation}
              onChange={v => set("preparation", v)}
              placeholder={t.form.preparationPlaceholder}
              minHeight="110px"
            />
          </div>

          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:7 }}>
              <label style={{...lbl, marginBottom:0}}>{t.form.descriptionLabel}</label>
              <span style={{ fontSize:11, color:"#A39D92", fontWeight:600 }}>{t.form.dictate}</span>
            </div>
            <VoiceTextarea
              value={form.description}
              onChange={v => set("description", v)}
              placeholder={t.form.descriptionPlaceholder}
              minHeight="80px"
            />
          </div>

          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:7 }}>
              <label style={{...lbl, marginBottom:0}}>{t.form.recommendationsLabel}</label>
              <span style={{ fontSize:11, color:"#A39D92", fontWeight:600 }}>{t.form.dictate}</span>
            </div>
            <VoiceTextarea
              value={form.recommendations}
              onChange={v => set("recommendations", v)}
              placeholder={t.form.recommendationsPlaceholder}
              minHeight="80px"
            />
          </div>

          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:7 }}>
              <label style={{...lbl, marginBottom:0, color:"#D9731A"}}>{t.form.salesLabel}</label>
              <span style={{ fontSize:11, color:"#A39D92", fontWeight:600 }}>{t.form.dictate}</span>
            </div>
            <VoiceTextarea
              value={form.salesPitch}
              onChange={v => set("salesPitch", v)}
              placeholder={t.form.salesPlaceholder}
              minHeight="80px"
            />
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(100%, 260px), 1fr))", gap:14 }}>
            <div>
              <label style={lbl}>{t.form.imageLabel}</label>
              <div style={{ background:"#F6F3EE", borderRadius:16, border:"1.5px dashed #DCD4C7", aspectRatio:"16/9", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", overflow:"hidden" }} onClick={()=>fileRef.current.click()}>
                {(imagePreview || form.image)
                  ? <img src={imagePreview || form.image} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                  : <div style={{ textAlign:"center", color:"#A39D92", padding:16, display:"flex", flexDirection:"column", alignItems:"center", gap:8, fontSize:13 }}>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                      {t.form.uploadImage}
                    </div>
                }
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleImage} />
              {(imagePreview || form.image) && <button onClick={()=>{set("image",null);setImagePreview(null);pendingFileRef.current=null;}} style={{ marginTop:6, fontSize:12.5, fontWeight:700, color:"#C8423B", background:"none", border:"none", cursor:"pointer" }}>{t.form.removeImage}</button>}
            </div>
            <div>
              <label style={lbl}>{t.form.videoLabel}</label>
              <input style={inp} value={form.video} onChange={e=>set("video",e.target.value)} placeholder={t.form.videoPlaceholder} />
              <div style={{ fontSize:12, color:"#A39D92", marginTop:6, lineHeight:1.5 }}>{t.form.videoHint}</div>
            </div>
          </div>
        </div>

        <div style={{ padding: isMobile ? "12px 18px calc(12px + env(safe-area-inset-bottom))" : "14px 28px", borderTop:"1px solid #F0ECE5", display:"flex", gap:10, justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
          <span style={{ fontSize:12.5, color:"#8A847A" }}>
            Los cambios se guardan automáticamente
          </span>
          <button onClick={onCancel} style={{ height:44, background:"#0E2240", border:0, borderRadius:12, padding:"0 22px", cursor:"pointer", fontWeight:800, color:"#fff", fontSize:14 }}>Listo</button>
        </div>
      </div>
    </div>
  );
}
