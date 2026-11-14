"use client";
import { AdminShell, FootBtn, useToast, A, card } from "@/components/dt/AdminShell";

// Los textos de i18n traen emojis al inicio ("📤 Subir nueva imagen"): se quitan, el ícono va en SVG.
const txt = (s) => String(s || "").replace(/^[^\p{L}\p{N}]+/u, "");

const Svg = ({ d, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const P = {
  frame: "M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM21 15l-5-5L5 21",
  upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
};

const sliderCard = { ...card, borderRadius:16, padding:"14px 16px", display:"flex", flexDirection:"column", gap:6 };
const sliderName = { fontSize:14, fontWeight:800, color:A.navy };
const sliderValue = { fontFamily:A.serif, fontSize:20, fontWeight:600, color:A.orange, lineHeight:1 };
const sliderRow = { display:"flex", alignItems:"center", gap:10, fontSize:11.5, color:A.muted2 };
const range = { flex:1, minWidth:0, height:44, accentColor:"#D9731A", margin:0, cursor:"pointer", touchAction:"none" };

export function WatermarkModal({ show, isAdmin, onClose, t, watermarkLogo, setWatermarkLogo, watermarkOpacity, watermarkSize, saveWatermark }) {
  const [toast, showToast] = useToast();
  // El toast sigue visible un momento después de cerrar (el componente queda montado).
  if (!show || !isAdmin) return toast;
  const opPct = Math.round(watermarkOpacity * 100);
  return (
    <>
      <AdminShell
        icon={<Svg d={P.frame} size={20} />}
        title={txt(t.watermark.title)}
        maxWidth={480}
        zIndex={9995}
        bodyGap={14}
        onClose={onClose}
        footer={<>
          <FootBtn kind="gray" disabled={!watermarkLogo} title={t.watermark.restore} onClick={() => { saveWatermark({ logo: null }); showToast("Logo restaurado"); }}>
            {t.watermark.restoreShort || "Restaurar logo"}
          </FootBtn>
          <FootBtn kind="navy" onClick={() => { showToast("Marca de agua guardada"); onClose(); }}>
            {t.watermark.done || "Listo"}
          </FootBtn>
        </>}
      >
        <div className="dt-adm" style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{
            ...card, position:"relative", flex:"none", height:210, display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden",
            backgroundColor:"#fff",
            backgroundImage:"linear-gradient(45deg,#F6F3EE 25%,transparent 25%,transparent 75%,#F6F3EE 75%),linear-gradient(45deg,#F6F3EE 25%,transparent 25%,transparent 75%,#F6F3EE 75%)",
            backgroundSize:"20px 20px", backgroundPosition:"0 0,10px 10px",
            animation:"dtUp .4s both",
          }}>
            <img
              src={watermarkLogo || "https://nhqdsdmqmyoxuyzsdacj.supabase.co/storage/v1/object/public/recipe-images/watermark/logo-watermark.png"}
              alt={t.watermark.preview}
              style={{ width: watermarkSize + "%", maxHeight:"84%", objectFit:"contain", opacity: Math.max(watermarkOpacity, 0.15), transition:"opacity .25s,width .25s" }}
            />
            <span style={{ position:"absolute", left:8, right:8, bottom:8, textAlign:"center", fontSize:11.5, color:A.muted2 }}>{t.watermark.previewNote}</span>
          </div>

          <div style={{ ...sliderCard, animation:"dtUp .4s both", animationDelay:"60ms" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={sliderName}>{t.watermark.visibility}</span>
              <span style={sliderValue}>{opPct}%</span>
            </div>
            <div style={sliderRow}>
              <span>{t.watermark.faint}</span>
              <input type="range" min="3" max="40" value={opPct} aria-label={t.watermark.visibility}
                onChange={e => saveWatermark({ opacity: parseInt(e.target.value) / 100 })}
                style={range}
              />
              <span>{t.watermark.visible}</span>
            </div>
          </div>

          <div style={{ ...sliderCard, animation:"dtUp .4s both", animationDelay:"120ms" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={sliderName}>{t.watermark.size}</span>
              <span style={sliderValue}>{watermarkSize}%</span>
            </div>
            <div style={sliderRow}>
              <span>{t.watermark.small}</span>
              <input type="range" min="20" max="90" value={watermarkSize} aria-label={t.watermark.size}
                onChange={e => saveWatermark({ size: parseInt(e.target.value) })}
                style={range}
              />
              <span>{t.watermark.large}</span>
            </div>
          </div>

          <label className="dt-adm-navy" style={{
            flex:"none", height:50, borderRadius:14, background:A.navy, color:"#fff", fontWeight:800, fontSize:14.5, cursor:"pointer",
            display:"flex", alignItems:"center", justifyContent:"center", gap:9, transition:"background .2s",
            animation:"dtUp .4s both", animationDelay:"180ms",
          }}>
            <Svg d={P.upload} />
            {txt(t.watermark.upload)}
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
        </div>
      </AdminShell>
      {toast}
    </>
  );
}
