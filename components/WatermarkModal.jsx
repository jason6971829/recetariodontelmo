"use client";

export function WatermarkModal({ show, isAdmin, onClose, t, watermarkLogo, setWatermarkLogo, watermarkOpacity, watermarkSize, saveWatermark }) {
  if (!show || !isAdmin) return null;
  return (
    <div style={{ position:"fixed", inset:0, zIndex:9995, background:"var(--app-primary-dark)", display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
      <div style={{ background:"#fff", borderRadius:"20px", padding:"32px 28px", width:"100%", maxWidth:"440px", boxShadow:"0 30px 80px rgba(0,0,0,0.5)" }}>
        <div style={{ fontSize:"28px", marginBottom:"4px", textAlign:"center" }}>🖼️</div>
        <div style={{ color:"var(--app-primary)", fontSize:"18px", fontWeight:"700", fontFamily:"Georgia,serif", marginBottom:"16px", textAlign:"center" }}>
          {t.watermark.title}
        </div>

        <div style={{ background:"#fff", borderRadius:"12px", border:"1px solid #eee", padding:"20px", marginBottom:"16px", textAlign:"center", minHeight:"120px", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
          <img
            src={watermarkLogo || "https://nhqdsdmqmyoxuyzsdacj.supabase.co/storage/v1/object/public/recipe-images/watermark/logo-watermark.png"}
            alt={t.watermark.preview}
            style={{ width: watermarkSize + "%", maxWidth:"220px", opacity: Math.max(watermarkOpacity, 0.15) }}
          />
          <div style={{ color:"#bbb", fontSize:"11px", marginTop:"8px" }}>{t.watermark.previewNote}</div>
        </div>

        <div style={{ background:"#f8f8f8", borderRadius:"10px", padding:"12px 14px", marginBottom:"10px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"8px" }}>
            <span style={{ fontSize:"13px", color:"#333", fontWeight:"600" }}>{t.watermark.visibility}</span>
            <span style={{ fontSize:"13px", color:"var(--app-primary)", fontWeight:"700" }}>{Math.round(watermarkOpacity * 100)}%</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
            <span style={{ fontSize:"11px", color:"#999", width:"40px" }}>{t.watermark.faint}</span>
            <input type="range" min="1" max="40" value={Math.round(watermarkOpacity * 100)}
              onChange={e => saveWatermark({ opacity: parseInt(e.target.value) / 100 })}
              style={{ flex:1, accentColor:"var(--app-primary)", cursor:"pointer", height:"20px", touchAction:"none" }}
            />
            <span style={{ fontSize:"11px", color:"#999", width:"40px", textAlign:"right" }}>{t.watermark.visible}</span>
          </div>
        </div>

        <div style={{ background:"#f8f8f8", borderRadius:"10px", padding:"12px 14px", marginBottom:"16px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"8px" }}>
            <span style={{ fontSize:"13px", color:"#333", fontWeight:"600" }}>{t.watermark.size}</span>
            <span style={{ fontSize:"13px", color:"var(--app-primary)", fontWeight:"700" }}>{watermarkSize}%</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
            <span style={{ fontSize:"11px", color:"#999", width:"40px" }}>{t.watermark.small}</span>
            <input type="range" min="10" max="90" value={watermarkSize}
              onChange={e => saveWatermark({ size: parseInt(e.target.value) })}
              style={{ flex:1, accentColor:"var(--app-primary)", cursor:"pointer", height:"20px", touchAction:"none" }}
            />
            <span style={{ fontSize:"11px", color:"#999", width:"40px", textAlign:"right" }}>{t.watermark.large}</span>
          </div>
        </div>

        <label style={{
          display:"block", background:"var(--app-primary)", color:"#fff", padding:"12px", borderRadius:"10px",
          textAlign:"center", cursor:"pointer", fontWeight:"700", fontSize:"14px", marginBottom:"12px",
        }}>
          {t.watermark.upload}
          <input type="file" accept="image/*" style={{ display:"none" }} onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              const { supabase } = await import("@/lib/supabase");
              const ext = file.name.split(".").pop()?.toLowerCase() || "png";
              const path = `watermark/custom-watermark.${ext}`;
              await supabase.storage.from("recipe-images").remove([path]);
              const { error } = await supabase.storage
                .from("recipe-images")
                .upload(path, file, { upsert: true, cacheControl: "0" });
              if (error) throw error;
              const { data: urlData } = supabase.storage.from("recipe-images").getPublicUrl(path);
              const stableUrl = urlData.publicUrl;
              saveWatermark({ logo: stableUrl });
              setWatermarkLogo(stableUrl + "?t=" + Date.now());
            } catch (err) {
              console.error("Watermark upload error:", err);
              const reader = new FileReader();
              reader.onload = () => saveWatermark({ logo: reader.result });
              reader.readAsDataURL(file);
            }
          }} />
        </label>

        {watermarkLogo && (
          <button onClick={() => saveWatermark({ logo: null })} style={{ width:"100%", background:"none", border:"1px solid #ddd", padding:"10px", borderRadius:"10px", cursor:"pointer", fontSize:"13px", color:"#888", marginBottom:"12px" }}>
            {t.watermark.restore}
          </button>
        )}

        <button onClick={onClose} style={{
          width:"100%", background:"#e74c3c", border:"none", padding:"12px", borderRadius:"10px",
          color:"#fff", cursor:"pointer", fontWeight:"700", fontSize:"14px",
        }}>
          {t.watermark.close}
        </button>
      </div>
    </div>
  );
}
