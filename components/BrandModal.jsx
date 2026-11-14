"use client";
import { memo } from "react";
import { saveAppConfig } from "@/lib/storage";
import { useViewport } from "@/hooks/useViewport";
import { Icon } from "@/components/dt/ui";
import { AdminShell, FootBtn, useToast, A, input } from "@/components/dt/AdminShell";

const BRAND_COLORS = [
  "#FFFFFF","#D9731A","#F0B429","#F59E0B","#27AE60","#2ECC71",
  "#3498DB","#8FAACB","#9B59B6","#E74C3C","#E91E63","#A8A8A8",
  "#1F426F","#1A1A1A","#2F3E57","#16A085",
];
// Colores de la paleta anterior que pueden seguir guardados: solo sirven para marcar el círculo
// equivalente como seleccionado. No se modifica el valor guardado.
const LEGACY = { "#d4721a":"#d9731a", "#f39c12":"#f59e0b", "#8baacc":"#8faacb", "#aaaaaa":"#a8a8a8", "#1b3a5c":"#1f426f", "#2c3e50":"#2f3e57" };
const norm = (c) => { const v = String(c || "").toLowerCase(); return LEGACY[v] || v; };

// Halo claro para que un color oscuro siga leyéndose sobre el fondo navy de la vista previa.
function halo(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
  if (!m) return undefined;
  const n = parseInt(m[1], 16);
  const lum = (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  return lum < 0.32 ? "0 0 1px rgba(255,255,255,.95), 0 0 10px rgba(255,255,255,.6)" : undefined;
}

const Svg = ({ d, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const P = {
  upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
  trash: "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5",
  utensils: "M3 2v7a3 3 0 0 0 3 3v10M9 2v7a3 3 0 0 1-3 3M19 2c-2 2-3 5-3 8s1 4 3 4v8",
};

// Círculo visible de `size` px dentro de un botón de 44 px (área táctil); el margen negativo
// mantiene la separación visual de 8 px del diseño.
const ColorPalette = memo(function ColorPalette({ value, onChange, size }) {
  const cur = norm(value);
  const pad = (44 - size) / 2;
  return (
    <div style={{ display:"flex", flexWrap:"wrap", gap:8, padding:"2px 0" }}>
      {BRAND_COLORS.map(c => {
        const sel = cur === c.toLowerCase();
        return (
          <button key={c} type="button" onClick={() => onChange(c)} aria-label={"Color " + c} aria-pressed={sel}
            style={{ width:44, height:44, margin:-pad, border:0, padding:0, background:"transparent", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flex:"none" }}>
            <span style={{
              width:size, height:size, borderRadius:"50%", background:c, display:"block",
              boxShadow: sel ? `0 0 0 2px #fff, 0 0 0 4px ${A.navy}` : "0 0 0 1px rgba(14,34,64,.16)",
              transform: sel ? "scale(1.12)" : "scale(1)",
              transition:`all .2s ${A.ease}`,
            }} />
          </button>
        );
      })}
    </div>
  );
});

const sectionLabel = { fontSize:11, fontWeight:800, letterSpacing:".18em" };

export function BrandModal({
  show, isAdmin, onClose, t,
  brandDraft, setBrandDraft,
  brandLabel, brandName, companyTagline, brandIcon, brandLabelColor, brandNameColor, brandTaglineColor,
  setBrandLabel, setBrandName, setCompanyTagline, setBrandIcon, setBrandLabelColor, setBrandNameColor, setBrandTaglineColor,
  themeId,
}) {
  const { mobile } = useViewport();
  const [toast, showToast] = useToast();
  // El toast sigue visible un momento después de cerrar (el componente queda montado).
  if (!show || !isAdmin) return toast;

  const cancel = () => {
    setBrandDraft({ label:brandLabel, name:brandName, tagline:companyTagline, icon:brandIcon, labelColor:brandLabelColor, nameColor:brandNameColor, taglineColor:brandTaglineColor });
    onClose();
  };
  const save = () => {
    setBrandLabel(brandDraft.label);
    setBrandName(brandDraft.name);
    setCompanyTagline(brandDraft.tagline);
    setBrandIcon(brandDraft.icon);
    setBrandLabelColor(brandDraft.labelColor);
    setBrandNameColor(brandDraft.nameColor);
    setBrandTaglineColor(brandDraft.taglineColor);
    localStorage.setItem("dontelmo:brand", JSON.stringify({ label: brandDraft.label, name: brandDraft.name, tagline: brandDraft.tagline, icon: brandDraft.icon || null, labelColor: brandDraft.labelColor, nameColor: brandDraft.nameColor, taglineColor: brandDraft.taglineColor }));
    saveAppConfig({ themeId, brand: brandDraft });
    showToast("Marca guardada");
    onClose();
  };

  const labelC = brandDraft.labelColor || "#D9731A";
  const nameC = brandDraft.nameColor || "#ffffff";
  const taglineC = brandDraft.taglineColor || "#8FAACB";
  const field = { ...input, height:50, borderRadius:13, fontWeight:500 };
  const sw = mobile ? 30 : 28;
  const logoBox = { width:68, height:68, borderRadius:18, boxShadow:"0 0 0 3px rgba(255,255,255,.14),0 14px 24px -10px rgba(0,0,0,.5)", animation:"dtPop .4s both", flex:"none" };

  return (
    <>
      <AdminShell
        icon={Icon.tag()}
        title={t.brand.title}
        maxWidth={520}
        zIndex={9995}
        bodyGap={14}
        onClose={cancel}
        footer={<>
          <FootBtn kind="gray" onClick={cancel}>{t.brand.cancel}</FootBtn>
          <FootBtn kind="navy" onClick={save}>{t.brand.save}</FootBtn>
        </>}
      >
        <div className="dt-adm" style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {/* Vista previa en vivo */}
          <div style={{ flex:"none", borderRadius:20, background:"radial-gradient(120% 90% at 85% 0%,#1F426F,#0E2240 60%,#091831)", padding:"26px 16px", display:"flex", flexDirection:"column", alignItems:"center", gap:7, textAlign:"center", minHeight:190, justifyContent:"center", boxSizing:"border-box", animation:"dtUp .4s both" }}>
            {brandDraft.icon
              ? <img src={brandDraft.icon} alt="logo" style={{ ...logoBox, objectFit:"cover", background:"#fff" }} />
              : <span style={{ ...logoBox, background:"rgba(255,255,255,.08)", color:A.orangeSoft, display:"flex", alignItems:"center", justifyContent:"center" }}><Svg d={P.utensils} size={28} /></span>}
            <span style={{ fontSize:11, fontWeight:800, letterSpacing:".26em", color:labelC, textShadow:halo(labelC), marginTop:6, wordBreak:"break-word" }}>{brandDraft.label || "RECETARIO DIGITAL"}</span>
            <span style={{ fontFamily:A.serif, fontSize:32, fontWeight:600, color:nameC, textShadow:halo(nameC), lineHeight:1.05, wordBreak:"break-word" }}>{brandDraft.name || "Don Telmo®"}</span>
            {brandDraft.tagline && <span style={{ fontSize:13, color:taglineC, textShadow:halo(taglineC), wordBreak:"break-word" }}>{brandDraft.tagline}</span>}
          </div>

          {/* Ícono */}
          <div style={{ display:"flex", flexDirection:"column", gap:8, animation:"dtUp .4s both", animationDelay:"60ms" }}>
            <span style={{ ...sectionLabel, color:A.navy }}>ÍCONO / LOGO</span>
            <div style={{ display:"grid", gridTemplateColumns: brandDraft.icon ? "1fr 1fr" : "1fr", gap:8 }}>
              <label className="dt-adm-navy" style={{ height:46, borderRadius:13, background:A.navy, color:"#fff", fontWeight:800, fontSize:13.5, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8, transition:"background .2s" }}>
                <Svg d={P.upload} />
                Subir imagen
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
                <button type="button" onClick={() => setBrandDraft(d => ({...d, icon:null}))} style={{ height:46, borderRadius:13, border:`1.5px solid ${A.line}`, background:"#fff", color:A.red, fontWeight:800, fontSize:13.5, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                  <Svg d={P.trash} />
                  Eliminar imagen
                </button>
              )}
            </div>
          </div>

          {/* Campos de texto + colores */}
          <div style={{ display:"flex", flexDirection:"column", gap:8, animation:"dtUp .4s both", animationDelay:"120ms" }}>
            <label htmlFor="dt-brand-label" style={{ ...sectionLabel, color:A.orange }}>{String(t.brand.labelField || "").toUpperCase()}</label>
            <input id="dt-brand-label" type="text" value={brandDraft.label} onChange={e => setBrandDraft(d => ({...d, label: e.target.value}))} placeholder="RECETARIO DIGITAL" style={field} autoFocus={!mobile} />
            <ColorPalette size={sw} value={brandDraft.labelColor} onChange={c => setBrandDraft(d => ({...d, labelColor:c}))} />
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:8, animation:"dtUp .4s both", animationDelay:"180ms" }}>
            <label htmlFor="dt-brand-name" style={{ ...sectionLabel, color:A.navy }}>{String(t.brand.nameField || "").toUpperCase()}</label>
            <input id="dt-brand-name" type="text" value={brandDraft.name} onChange={e => setBrandDraft(d => ({...d, name: e.target.value}))} placeholder="Don Telmo®" style={field} />
            <ColorPalette size={sw} value={brandDraft.nameColor} onChange={c => setBrandDraft(d => ({...d, nameColor:c}))} />
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:8, animation:"dtUp .4s both", animationDelay:"240ms" }}>
            <label htmlFor="dt-brand-tagline" style={{ ...sectionLabel, color:A.muted2 }}>{String(t.brand.taglineLabel || "").toUpperCase()}</label>
            <input id="dt-brand-tagline" type="text" value={brandDraft.tagline} onChange={e => setBrandDraft(d => ({...d, tagline: e.target.value}))} placeholder="1958 — Company" style={field} />
            <ColorPalette size={sw} value={brandDraft.taglineColor} onChange={c => setBrandDraft(d => ({...d, taglineColor:c}))} />
          </div>
        </div>
      </AdminShell>
      {toast}
    </>
  );
}
