"use client";

export function ThemeModal({
  show, onClose, themeId, setTheme, THEMES, saveAppConfig,
  brandLabel, brandName, companyTagline, brandIcon, brandLabelColor, brandNameColor, brandTaglineColor,
}) {
  if (!show) return null;
  return (
    <div style={{ position:"fixed", inset:0, zIndex:9996, background:"rgba(0,0,0,0.6)", backdropFilter:"blur(20px)", display:"flex", alignItems:"flex-end", justifyContent:"center", padding:"0" }}>
      <div style={{ background:"rgba(28,28,30,0.95)", borderRadius:"28px 28px 0 0", width:"100%", maxWidth:"480px", padding:"12px 0 40px", boxShadow:"0 -20px 60px rgba(0,0,0,0.5)" }}>
        <div style={{ width:"36px", height:"4px", background:"rgba(255,255,255,0.3)", borderRadius:"2px", margin:"0 auto 20px" }} />
        <div style={{ color:"#fff", fontSize:"17px", fontWeight:"700", textAlign:"center", marginBottom:"6px", letterSpacing:"0.3px" }}>Tema de Color</div>
        <div style={{ color:"rgba(255,255,255,0.5)", fontSize:"13px", textAlign:"center", marginBottom:"24px" }}>Elige el color principal de la app</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"16px", padding:"0 24px", marginBottom:"24px" }}>
          {THEMES.map(theme => (
            <div key={theme.id} onClick={() => {
              setTheme(theme.id);
              saveAppConfig({ themeId: theme.id, brand: { label: brandLabel, name: brandName, tagline: companyTagline, icon: brandIcon, labelColor: brandLabelColor, nameColor: brandNameColor, taglineColor: brandTaglineColor } });
            }} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"8px", cursor:"pointer" }}>
              <div style={{
                width:"64px", height:"64px", borderRadius:"20px",
                background:`linear-gradient(135deg, ${theme.primary}, ${theme.dark})`,
                display:"flex", alignItems:"center", justifyContent:"center",
                boxShadow: themeId === theme.id ? `0 0 0 3px #fff, 0 0 0 5px ${theme.primary}` : "0 4px 12px rgba(0,0,0,0.4)",
                transition:"all 0.2s",
                transform: themeId === theme.id ? "scale(1.08)" : "scale(1)",
              }}>
                {themeId === theme.id && <div style={{ color:"#fff", fontSize:"22px", fontWeight:"700" }}>✓</div>}
              </div>
              <span style={{ color: themeId === theme.id ? "#fff" : "rgba(255,255,255,0.6)", fontSize:"12px", fontWeight: themeId === theme.id ? "700" : "400", transition:"all 0.2s" }}>{theme.label}</span>
            </div>
          ))}
        </div>
        <div style={{ padding:"0 24px" }}>
          <button onClick={onClose} style={{ width:"100%", background:"rgba(255,255,255,0.12)", border:"none", borderRadius:"14px", padding:"14px", color:"#fff", fontSize:"15px", fontWeight:"600", cursor:"pointer" }}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
