"use client";
import { memo } from "react";
import { saveAppConfig } from "@/lib/storage";

const BRAND_COLORS = [
  "#ffffff","#D4721A","#f0b429","#f39c12","#27ae60","#2ecc71",
  "#3498db","#8BAACC","#9b59b6","#e74c3c","#e91e63","#aaaaaa",
  "#1B3A5C","#1a1a1a","#2c3e50","#16a085",
];

const ColorPalette = memo(function ColorPalette({ value, onChange }) {
  return (
    <div style={{ display:"flex", flexWrap:"wrap", gap:"6px", marginTop:"8px" }}>
      {BRAND_COLORS.map(c => (
        <div key={c} onClick={() => onChange(c)} style={{
          width:"24px", height:"24px", borderRadius:"50%", background:c,
          cursor:"pointer", flexShrink:0,
          boxShadow: value === c ? `0 0 0 2px #fff, 0 0 0 4px ${c}` : "0 1px 3px rgba(0,0,0,0.2)",
          transform: value === c ? "scale(1.2)" : "scale(1)",
          transition:"all 0.15s",
          border: c === "#ffffff" ? "1px solid #ddd" : "none",
        }} />
      ))}
    </div>
  );
});

export function BrandModal({
  show, isAdmin, onClose, t,
  brandDraft, setBrandDraft,
  brandLabel, brandName, companyTagline, brandIcon, brandLabelColor, brandNameColor, brandTaglineColor,
  setBrandLabel, setBrandName, setCompanyTagline, setBrandIcon, setBrandLabelColor, setBrandNameColor, setBrandTaglineColor,
  themeId,
}) {
  if (!show || !isAdmin) return null;
  return (
    <div style={{ position:"fixed", inset:0, zIndex:9995, background:"rgba(10,15,25,0.88)", backdropFilter:"blur(8px)", display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
      <div style={{ background:"#fff", borderRadius:"20px", padding:"28px 24px", width:"100%", maxWidth:"420px", boxShadow:"0 30px 80px rgba(0,0,0,0.5)", maxHeight:"90vh", overflowY:"auto" }}>
        <div style={{ textAlign:"center", marginBottom:"18px" }}>
          <div style={{ fontSize:"28px", marginBottom:"6px" }}>🏷️</div>
          <div style={{ color:"var(--app-primary)", fontSize:"17px", fontWeight:"700", fontFamily:"Georgia,serif" }}>{t.brand.title}</div>
        </div>

        {/* Preview */}
        <div style={{ background:"linear-gradient(135deg,var(--app-primary-dark),var(--app-primary))", borderRadius:"14px", padding:"22px", textAlign:"center", marginBottom:"20px" }}>
          <div style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:"62px", height:"62px", background:"linear-gradient(135deg,var(--app-primary),var(--app-primary-dark))", borderRadius:"16px", marginBottom:"10px", boxShadow:"0 4px 16px rgba(0,0,0,0.4)", border:"2px solid rgba(255,255,255,0.1)", overflow:"hidden" }}>
            {brandDraft.icon
              ? <img src={brandDraft.icon} alt="logo" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
              : <span style={{ fontSize:"26px" }}>🍽️</span>}
          </div>
          <div style={{ color:brandDraft.labelColor||"#D4721A", fontSize:"9px", fontWeight:"700", letterSpacing:"3px" }}>{brandDraft.label || "RECETARIO DIGITAL"}</div>
          <div style={{ color:brandDraft.nameColor||"#ffffff", fontSize:"20px", fontWeight:"700", fontFamily:"Georgia,serif", marginTop:"2px" }}>{brandDraft.name || "Don Telmo®"}</div>
          {brandDraft.tagline && <div style={{ color:brandDraft.taglineColor||"#8BAACC", fontSize:"12px", marginTop:"2px" }}>{brandDraft.tagline}</div>}
        </div>

        {/* Ícono */}
        <div style={{ marginBottom:"14px" }}>
          <label style={{ display:"block", fontSize:"11px", fontWeight:"700", color:"var(--app-primary)", letterSpacing:"1.5px", marginBottom:"8px" }}>🖼️ ÍCONO / LOGO</label>
          <label style={{ display:"block", background:"var(--app-primary)", color:"#fff", padding:"11px", borderRadius:"10px", textAlign:"center", cursor:"pointer", fontWeight:"700", fontSize:"13px", marginBottom:"6px" }}>
            📤 Subir imagen
            <input type="file" accept="image/*" style={{ display:"none" }} onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = ev => setBrandDraft(d => ({...d, icon: ev.target.result}));
              reader.readAsDataURL(file);
              try {
                const { supabase } = await import("@/lib/supabase");
                const ext = file.name.split(".").pop()?.toLowerCase() || "png";
                const path = `brand/brand-icon.${ext}`;
                await supabase.storage.from("recipe-images").remove([path]);
                const { error } = await supabase.storage.from("recipe-images").upload(path, file, { upsert:true, cacheControl:"0" });
                if (!error) {
                  const { data: urlData } = supabase.storage.from("recipe-images").getPublicUrl(path);
                  const url = urlData.publicUrl + "?t=" + Date.now();
                  setBrandDraft(d => ({...d, icon: url}));
                }
              } catch { /* mantiene el preview local base64 */ }
            }} />
          </label>
          {brandDraft.icon && (
            <button onClick={() => setBrandDraft(d => ({...d, icon:null}))} style={{ width:"100%", background:"none", border:"1px solid #e0d8ce", borderRadius:"8px", padding:"8px", cursor:"pointer", fontSize:"12px", color:"#c0392b" }}>
              🗑️ Eliminar imagen
            </button>
          )}
        </div>

        {/* Campos de texto + colores */}
        <div style={{ marginBottom:"14px" }}>
          <label style={{ display:"block", fontSize:"11px", fontWeight:"700", color:"#D4721A", letterSpacing:"1.5px", marginBottom:"6px" }}>{t.brand.labelField}</label>
          <input type="text" value={brandDraft.label} onChange={e => setBrandDraft(d => ({...d, label: e.target.value}))} placeholder="RECETARIO DIGITAL"
            style={{ width:"100%", padding:"11px 14px", border:"2px solid #E0D8CE", borderRadius:"10px", fontSize:"14px", outline:"none", boxSizing:"border-box", fontFamily:"inherit" }} autoFocus />
          <ColorPalette value={brandDraft.labelColor} onChange={c => setBrandDraft(d => ({...d, labelColor:c}))} />
        </div>

        <div style={{ marginBottom:"14px" }}>
          <label style={{ display:"block", fontSize:"11px", fontWeight:"700", color:"var(--app-primary)", letterSpacing:"1.5px", marginBottom:"6px" }}>{t.brand.nameField}</label>
          <input type="text" value={brandDraft.name} onChange={e => setBrandDraft(d => ({...d, name: e.target.value}))} placeholder="Don Telmo®"
            style={{ width:"100%", padding:"11px 14px", border:"2px solid #E0D8CE", borderRadius:"10px", fontSize:"14px", outline:"none", boxSizing:"border-box", fontFamily:"inherit" }} />
          <ColorPalette value={brandDraft.nameColor} onChange={c => setBrandDraft(d => ({...d, nameColor:c}))} />
        </div>

        <div style={{ marginBottom:"20px" }}>
          <label style={{ display:"block", fontSize:"11px", fontWeight:"700", color:"#888", letterSpacing:"1.5px", marginBottom:"6px" }}>{t.brand.taglineLabel}</label>
          <input type="text" value={brandDraft.tagline} onChange={e => setBrandDraft(d => ({...d, tagline: e.target.value}))} placeholder="1958 — Company"
            style={{ width:"100%", padding:"11px 14px", border:"2px solid #E0D8CE", borderRadius:"10px", fontSize:"14px", outline:"none", boxSizing:"border-box", fontFamily:"inherit" }} />
          <ColorPalette value={brandDraft.taglineColor} onChange={c => setBrandDraft(d => ({...d, taglineColor:c}))} />
        </div>

        <div style={{ display:"flex", gap:"10px" }}>
          <button onClick={() => { setBrandDraft({ label:brandLabel, name:brandName, tagline:companyTagline, icon:brandIcon, labelColor:brandLabelColor, nameColor:brandNameColor, taglineColor:brandTaglineColor }); onClose(); }} style={{ flex:1, background:"#F0ECE6", border:"none", borderRadius:"10px", padding:"12px", cursor:"pointer", fontWeight:"600", color:"#5a3e2b", fontSize:"14px" }}>
            {t.brand.cancel}
          </button>
          <button onClick={() => {
            setBrandLabel(brandDraft.label);
            setBrandName(brandDraft.name);
            setCompanyTagline(brandDraft.tagline);
            setBrandIcon(brandDraft.icon);
            setBrandLabelColor(brandDraft.labelColor);
            setBrandNameColor(brandDraft.nameColor);
            setBrandTaglineColor(brandDraft.taglineColor);
            localStorage.setItem("dontelmo:brand", JSON.stringify({ label: brandDraft.label, name: brandDraft.name, tagline: brandDraft.tagline, icon: brandDraft.icon || null, labelColor: brandDraft.labelColor, nameColor: brandDraft.nameColor, taglineColor: brandDraft.taglineColor }));
            saveAppConfig({ themeId, brand: brandDraft });
            onClose();
          }} style={{ flex:1, background:"var(--app-primary)", border:"none", borderRadius:"10px", padding:"12px", cursor:"pointer", fontWeight:"700", color:"#fff", fontSize:"14px" }}>
            {t.brand.save}
          </button>
        </div>
      </div>
    </div>
  );
}
