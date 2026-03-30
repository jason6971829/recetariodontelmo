"use client";
import { saveBannerConfig } from "@/lib/storage";

export function BannerConfigModal({
  show, isAdmin, onClose,
  bannerActive, setBannerActive, bannerImages, setBannerImages,
  bannerUploading, setBannerUploading,
  setBannerSlide, setShowBanner,
}) {
  if (!show || !isAdmin) return null;
  return (
    <div style={{ position:"fixed", inset:0, zIndex:9995, background:"rgba(10,15,25,0.88)", backdropFilter:"blur(8px)", display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
      <div style={{ background:"#fff", borderRadius:"20px", width:"100%", maxWidth:"480px", maxHeight:"90vh", overflow:"hidden", display:"flex", flexDirection:"column", boxShadow:"0 30px 80px rgba(0,0,0,0.5)" }}>
        {/* Header */}
        <div style={{ background:"linear-gradient(135deg,var(--app-primary),var(--app-primary-dark))", padding:"18px 24px", display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
          <div>
            <div style={{ color:"#D4721A", fontSize:"10px", fontWeight:"700", letterSpacing:"3px", fontFamily:"Georgia,serif" }}>DON TELMO® RECETARIO</div>
            <div style={{ color:"#fff", fontFamily:"Georgia,serif", fontSize:"17px", fontWeight:"700", marginTop:"3px" }}>📢 Banner de Anuncios</div>
          </div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,0.15)", border:"none", borderRadius:"8px", color:"#fff", width:"34px", height:"34px", cursor:"pointer", fontSize:"18px" }}>×</button>
        </div>

        <div style={{ overflowY:"auto", flex:1, padding:"20px" }}>
          {/* Toggle */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:"#F7F3EE", borderRadius:"14px", padding:"16px 18px", marginBottom:"20px" }}>
            <div>
              <div style={{ fontWeight:"700", fontSize:"14px", color:"var(--app-primary)" }}>Publicar banner</div>
              <div style={{ fontSize:"12px", color:"#888", marginTop:"2px" }}>Los usuarios verán el banner al iniciar sesión</div>
            </div>
            <div onClick={() => setBannerActive(v => !v)} style={{
              width:"51px", height:"31px", borderRadius:"16px", cursor:"pointer", transition:"all 0.3s",
              background: bannerActive ? "#34c759" : "#e0e0e0", position:"relative", flexShrink:0,
            }}>
              <div style={{
                position:"absolute", top:"2px", width:"27px", height:"27px", borderRadius:"50%",
                background:"#fff", boxShadow:"0 2px 4px rgba(0,0,0,0.2)", transition:"all 0.3s",
                left: bannerActive ? "22px" : "2px",
              }} />
            </div>
          </div>

          {/* Imágenes */}
          <div style={{ marginBottom:"16px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"10px" }}>
              <div style={{ fontSize:"12px", fontWeight:"700", color:"var(--app-primary)", letterSpacing:"1px" }}>IMÁGENES DEL BANNER</div>
              <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                {[1,2,3,4,5].map(n => (
                  <div key={n} style={{
                    width:"28px", height:"28px", borderRadius:"8px", fontSize:"11px", fontWeight:"700",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    background: n <= bannerImages.length ? "var(--app-primary)" : "#F0ECE6",
                    color: n <= bannerImages.length ? "#fff" : "#bbb",
                    transition:"all 0.2s",
                  }}>{n}</div>
                ))}
              </div>
            </div>

            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"10px" }}>
              <div style={{ fontSize:"12px", color:"#888" }}>
                {bannerImages.length === 0
                  ? "Sin imágenes aún"
                  : `${bannerImages.length} de 5 imagen${bannerImages.length !== 1 ? "es" : ""} subida${bannerImages.length !== 1 ? "s" : ""}`}
              </div>
              {bannerImages.length >= 5 && (
                <div style={{ fontSize:"11px", color:"#e74c3c", fontWeight:"700" }}>Límite alcanzado</div>
              )}
            </div>

            {bannerImages.length < 5 && (
              <label style={{ display:"block", background: bannerUploading ? "#ccc" : "var(--app-primary)", color:"#fff", padding:"12px", borderRadius:"10px", textAlign:"center", cursor: bannerUploading ? "not-allowed" : "pointer", fontWeight:"700", fontSize:"14px", marginBottom:"12px" }}>
                {bannerUploading ? "⏳ Subiendo..." : `📤 Agregar imagen (${5 - bannerImages.length} disponible${5 - bannerImages.length !== 1 ? "s" : ""})`}
                <input type="file" accept="image/*" multiple style={{ display:"none" }} disabled={bannerUploading || bannerImages.length >= 5} onChange={async (e) => {
                  const files = Array.from(e.target.files || []).slice(0, 5 - bannerImages.length);
                  if (!files.length) return;
                  setBannerUploading(true);
                  const newUrls = [];
                  for (const file of files) {
                    const localUrl = await new Promise(resolve => {
                      const r = new FileReader();
                      r.onload = ev => resolve(ev.target.result);
                      r.readAsDataURL(file);
                    });
                    newUrls.push(localUrl);
                    try {
                      const { supabase } = await import("@/lib/supabase");
                      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
                      const path = `banner/img-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
                      const { error } = await supabase.storage.from("recipe-images").upload(path, file, { upsert:false, cacheControl:"0" });
                      if (!error) {
                        const { data: urlData } = supabase.storage.from("recipe-images").getPublicUrl(path);
                        newUrls[newUrls.length - 1] = urlData.publicUrl;
                      }
                    } catch {}
                  }
                  setBannerImages(prev => [...prev, ...newUrls]);
                  setBannerUploading(false);
                }} />
              </label>
            )}

            {bannerImages.length === 0 ? (
              <div style={{ textAlign:"center", padding:"28px 20px", color:"#bbb", fontSize:"13px", background:"#F7F3EE", borderRadius:"12px", border:"2px dashed #E0D8CE" }}>
                <div style={{ fontSize:"28px", marginBottom:"8px" }}>🖼️</div>
                Sube hasta 5 imágenes para el banner
              </div>
            ) : (
              <div style={{ display:"flex", gap:"6px" }}>
                {bannerImages.map((url, i) => (
                  <div key={i} style={{ position:"relative", borderRadius:"8px", overflow:"hidden", width:"72px", height:"72px", flexShrink:0, background:"#000", boxShadow:"0 2px 6px rgba(0,0,0,0.2)" }}>
                    <img src={url} alt={`Banner ${i+1}`} style={{ width:"100%", height:"100%", objectFit:"cover", opacity:0.92 }} />
                    <div style={{ position:"absolute", bottom:"3px", left:"3px", background:"var(--app-primary)", color:"#fff", fontSize:"9px", fontWeight:"700", padding:"1px 5px", borderRadius:"5px" }}>{i + 1}</div>
                    <button onClick={() => setBannerImages(prev => prev.filter((_,idx) => idx !== i))}
                      style={{ position:"absolute", top:"2px", right:"2px", background:"rgba(231,76,60,0.9)", border:"none", borderRadius:"50%", width:"20px", height:"20px", color:"#fff", cursor:"pointer", fontSize:"12px", fontWeight:"700", display:"flex", alignItems:"center", justifyContent:"center", lineHeight:1 }}>×</button>
                  </div>
                ))}
                {Array.from({ length: 5 - bannerImages.length }).map((_, i) => (
                  <div key={`empty-${i}`} style={{ borderRadius:"8px", width:"72px", height:"72px", flexShrink:0, background:"#F7F3EE", border:"2px dashed #E0D8CE", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <span style={{ fontSize:"18px", color:"#ddd" }}>+</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {bannerImages.length > 0 && (
            <button onClick={() => { onClose(); setBannerSlide(0); setShowBanner(true); }}
              style={{ width:"100%", background:"#F0ECE6", border:"none", borderRadius:"10px", padding:"11px", cursor:"pointer", fontWeight:"600", fontSize:"13px", color:"var(--app-primary)", marginBottom:"10px" }}>
              👁️ Vista previa del banner
            </button>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding:"14px 20px", borderTop:"1px solid #F0ECE6", display:"flex", gap:"10px", flexShrink:0 }}>
          <button onClick={onClose} style={{ flex:1, background:"#F0ECE6", border:"none", borderRadius:"10px", padding:"12px", cursor:"pointer", fontWeight:"600", color:"#5a3e2b", fontSize:"14px" }}>
            Cancelar
          </button>
          <button onClick={async () => {
            await saveBannerConfig({ active: bannerActive, images: bannerImages });
            onClose();
          }} style={{ flex:2, background:"var(--app-primary)", border:"none", borderRadius:"10px", padding:"12px", cursor:"pointer", fontWeight:"700", color:"#fff", fontSize:"14px" }}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
