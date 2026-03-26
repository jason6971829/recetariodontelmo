"use client";
import { useState, useRef } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";
import { VoiceTextarea } from "@/components/VoiceTextarea";
import { CATEGORIES } from "@/lib/constants";
import { uploadImage } from "@/lib/storage";

export function RecipeForm({ initial, categories, onSave, onCancel }) {
  const cats = (categories || CATEGORIES).filter(c => c.id !== "all");
  const [form, setForm] = useState(initial || {
    name:"", category:"Adiciones", prepTime:"", cookTime:"", portions:"",
    ingredients:[], preparation:"", recommendations:"", image:null, video:"",
    description:"", salesPitch:""
  });
  const [newIng, setNewIng] = useState("");
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState(initial?.image || null);
  const fileRef = useRef();
  const pendingFileRef = useRef(null);
  const isMobile = useIsMobile();

  const set = (k, v) => setForm(f => ({...f, [k]:v}));
  const addIng = () => { if (!newIng.trim()) return; set("ingredients", [...form.ingredients, newIng.trim()]); setNewIng(""); };
  const removeIng = i => set("ingredients", form.ingredients.filter((_,idx)=>idx!==i));
  const handleImage = e => {
    const file = e.target.files[0]; if (!file) return;
    pendingFileRef.current = file;
    // Mostrar preview local inmediata
    const r = new FileReader();
    r.onload = ev => { setImagePreview(ev.target.result); };
    r.readAsDataURL(file);
  };
  const handleSave = async () => {
    if (!form.name.trim()) { alert("El nombre es obligatorio"); return; }
    setUploading(true);
    let imageUrl = form.image;
    // Si hay un archivo pendiente, subirlo a Supabase Storage
    if (pendingFileRef.current) {
      const url = await uploadImage(pendingFileRef.current);
      if (url) imageUrl = url;
      pendingFileRef.current = null;
    }
    onSave({ ...form, image: imageUrl });
    setUploading(false);
  };

  const inp = { width:"100%", padding:"10px 12px", border:"1.5px solid #E0D8CE", borderRadius:"8px", fontSize:"13px", outline:"none", boxSizing:"border-box", fontFamily:"inherit", background:"#fff" };
  const lbl = { fontSize:"11px", fontWeight:"700", color:"#1B3A5C", letterSpacing:"1.5px", display:"block", marginBottom:"5px" };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:300, background:"rgba(10,15,25,0.88)", backdropFilter:"blur(8px)", display:"flex", alignItems: isMobile?"flex-end":"center", justifyContent:"center", padding: isMobile?"0":"16px" }}>
      <div style={{ background:"#fff", borderRadius: isMobile?"20px 20px 0 0":"16px", width:"100%", maxWidth:"700px", maxHeight: isMobile?"95vh":"92vh", overflow:"hidden", display:"flex", flexDirection:"column", boxShadow:"0 30px 80px rgba(0,0,0,0.5)" }}>
        <div style={{ background:"linear-gradient(135deg,#1B3A5C,#0d2340)", padding:"18px 24px", display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
          <div>
            <div style={{ color:"#D4721A", fontSize:"10px", fontWeight:"700", letterSpacing:"3px", fontFamily:"Georgia,serif" }}>DON TELMO® RECETARIO</div>
            <div style={{ color:"#fff", fontFamily:"Georgia,serif", fontSize:"17px", fontWeight:"700", marginTop:"3px" }}>{initial ? "Editar Receta" : "Nueva Receta"}</div>
          </div>
          <button onClick={onCancel} style={{ background:"rgba(255,255,255,0.15)", border:"none", borderRadius:"8px", color:"#fff", width:"34px", height:"34px", cursor:"pointer", fontSize:"18px" }}>×</button>
        </div>

        <div style={{ overflowY:"auto", flex:1, padding:"20px" }}>
          <div style={{ display:"grid", gridTemplateColumns: isMobile?"1fr":"1fr 1fr", gap:"14px", marginBottom:"14px" }}>
            <div style={{ gridColumn:"1/-1" }}>
              <label style={lbl}>NOMBRE DE LA RECETA *</label>
              <input style={inp} value={form.name} onChange={e=>set("name",e.target.value)} placeholder="Ej: HAMBURGUESA CLÁSICA" />
            </div>
            <div>
              <label style={lbl}>CATEGORÍA</label>
              <select style={inp} value={form.category} onChange={e=>set("category",e.target.value)}>
                {cats.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>PORCIONES</label>
              <input style={inp} value={form.portions} onChange={e=>set("portions",e.target.value)} placeholder="Ej: 1 persona" />
            </div>
            <div>
              <label style={lbl}>TIEMPO DE PREP.</label>
              <input style={inp} value={form.prepTime} onChange={e=>set("prepTime",e.target.value)} placeholder="Ej: 10 min" />
            </div>
            <div>
              <label style={lbl}>TIEMPO DE COCCIÓN</label>
              <input style={inp} value={form.cookTime} onChange={e=>set("cookTime",e.target.value)} placeholder="Ej: 15 min" />
            </div>
          </div>

          <div style={{ marginBottom:"14px" }}>
            <label style={lbl}>INGREDIENTES</label>
            <div style={{ display:"flex", gap:"8px", marginBottom:"8px" }}>
              <input style={{...inp, flex:1}} value={newIng} onChange={e=>setNewIng(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addIng()} placeholder="Ej: 0.15 KILO - Carne Molida | 085" />
              <button onClick={addIng} style={{ background:"#D4721A", border:"none", borderRadius:"8px", color:"#fff", padding:"0 16px", cursor:"pointer", fontWeight:"700", whiteSpace:"nowrap" }}>+ Agregar</button>
            </div>
            {form.ingredients.map((ing,i)=>(
              <div key={i} style={{ display:"flex", gap:"6px", alignItems:"center", marginBottom:"4px" }}>
                <div style={{ flex:1, background:"#F7F3EE", borderRadius:"6px", padding:"7px 12px", fontSize:"13px" }}>• {ing}</div>
                <button onClick={()=>removeIng(i)} style={{ background:"none", border:"none", color:"#c0392b", cursor:"pointer", fontSize:"18px", padding:"4px 6px" }}>×</button>
              </div>
            ))}
          </div>

          <div style={{ marginBottom:"14px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"5px" }}>
              <label style={{...lbl, marginBottom:0}}>PREPARACIÓN</label>
              <span style={{ fontSize:"10px", color:"#aaa" }}>🎙️ Toca el micrófono para dictar</span>
            </div>
            <VoiceTextarea
              value={form.preparation}
              onChange={v => set("preparation", v)}
              placeholder="Instrucciones paso a paso... (o dicta con el micrófono 🎙️)"
              minHeight="110px"
            />
          </div>

          <div style={{ marginBottom:"14px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"5px" }}>
              <label style={{...lbl, marginBottom:0}}>DESCRIPCIÓN</label>
              <span style={{ fontSize:"10px", color:"#aaa" }}>🎙️ Toca el micrófono para dictar</span>
            </div>
            <VoiceTextarea
              value={form.description}
              onChange={v => set("description", v)}
              placeholder="Descripción del plato... (o dicta con el micrófono 🎙️)"
              minHeight="80px"
            />
          </div>

          <div style={{ marginBottom:"14px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"5px" }}>
              <label style={{...lbl, marginBottom:0}}>RECOMENDACIONES</label>
              <span style={{ fontSize:"10px", color:"#aaa" }}>🎙️ Toca el micrófono para dictar</span>
            </div>
            <VoiceTextarea
              value={form.recommendations}
              onChange={v => set("recommendations", v)}
              placeholder="Consejos y sugerencias... (o dicta con el micrófono 🎙️)"
              minHeight="80px"
            />
          </div>

          <div style={{ marginBottom:"14px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"5px" }}>
              <label style={{...lbl, marginBottom:0, color:"#D4721A"}}>🎯 APRENDE A VENDER</label>
              <span style={{ fontSize:"10px", color:"#aaa" }}>🎙️ Toca el micrófono para dictar</span>
            </div>
            <VoiceTextarea
              value={form.salesPitch}
              onChange={v => set("salesPitch", v)}
              placeholder="Cómo ofrecer este plato al comensal... (o dicta con el micrófono 🎙️)"
              minHeight="80px"
            />
          </div>

          <div style={{ display:"grid", gridTemplateColumns: isMobile?"1fr":"1fr 1fr", gap:"14px" }}>
            <div>
              <label style={lbl}>IMAGEN DE REFERENCIA</label>
              <div style={{ background:"#F7F3EE", borderRadius:"10px", border:"2px dashed #C0B8A8", minHeight:"110px", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", overflow:"hidden" }} onClick={()=>fileRef.current.click()}>
                {(imagePreview || form.image)
                  ? <img src={imagePreview || form.image} alt="" style={{ width:"100%", height:"110px", objectFit:"cover" }} />
                  : <div style={{ textAlign:"center", color:"#C0B8A8", padding:"16px" }}>
                      <div style={{ fontSize:"28px" }}>📷</div>
                      <div style={{ fontSize:"12px", marginTop:"4px" }}>Toca para subir</div>
                    </div>
                }
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleImage} />
              {(imagePreview || form.image) && <button onClick={()=>{set("image",null);setImagePreview(null);pendingFileRef.current=null;}} style={{ marginTop:"5px", fontSize:"12px", color:"#c0392b", background:"none", border:"none", cursor:"pointer" }}>× Quitar imagen</button>}
            </div>
            <div>
              <label style={lbl}>ENLACE VIDEO (YouTube)</label>
              <input style={inp} value={form.video} onChange={e=>set("video",e.target.value)} placeholder="https://youtube.com/watch?v=..." />
              <div style={{ fontSize:"11px", color:"#aaa", marginTop:"6px", lineHeight:"1.5" }}>Pega el link de YouTube con el tutorial de preparación</div>
            </div>
          </div>
        </div>

        <div style={{ padding:"14px 20px", borderTop:"1px solid #F0ECE6", display:"flex", gap:"10px", justifyContent:"flex-end", flexShrink:0 }}>
          <button onClick={onCancel} disabled={uploading} style={{ background:"#F0ECE6", border:"none", borderRadius:"8px", padding:"10px 18px", cursor:"pointer", fontWeight:"600", color:"#5a3e2b", opacity: uploading ? 0.5 : 1 }}>Cancelar</button>
          <button onClick={handleSave} disabled={uploading} style={{ background:"#1B3A5C", border:"none", borderRadius:"8px", padding:"10px 22px", cursor:"pointer", fontWeight:"700", color:"#fff", fontSize:"14px", opacity: uploading ? 0.7 : 1 }}>{uploading ? "⏳ Guardando..." : "💾 Guardar"}</button>
        </div>
      </div>
    </div>
  );
}
