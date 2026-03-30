"use client";

export function LangModal({ show, onClose, t, lang, setLang, LANGUAGES }) {
  if (!show) return null;
  return (
    <div style={{ position:"fixed", inset:0, zIndex:600, background:"rgba(10,15,25,0.92)", display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
      <div style={{ background:"#fff", borderRadius:"20px", padding:"32px 28px", width:"100%", maxWidth:"360px", boxShadow:"0 30px 80px rgba(0,0,0,0.5)", position:"relative" }}>
        <button onClick={onClose} style={{ position:"absolute", top:"14px", right:"14px", background:"rgba(0,0,0,0.08)", border:"none", borderRadius:"8px", width:"32px", height:"32px", cursor:"pointer", fontSize:"18px", color:"#555", lineHeight:"1" }}>×</button>
        <div style={{ fontSize:"32px", textAlign:"center", marginBottom:"6px" }}>🌐</div>
        <div style={{ color:"var(--app-primary)", fontSize:"18px", fontWeight:"700", fontFamily:"Georgia,serif", textAlign:"center", marginBottom:"6px" }}>
          {t.language.title}
        </div>
        <div style={{ color:"#888", fontSize:"13px", textAlign:"center", marginBottom:"24px" }}>
          {t.language.subtitle}
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:"10px", marginBottom:"24px" }}>
          {LANGUAGES.map(l => (
            <button key={l.code} onClick={() => setLang(l.code)} style={{
              display:"flex", alignItems:"center", gap:"14px",
              padding:"14px 18px", borderRadius:"12px", border:"2px solid",
              borderColor: lang === l.code ? "var(--app-primary)" : "#eee",
              background: lang === l.code ? "#f0f4f8" : "#fff",
              cursor:"pointer", textAlign:"left",
            }}>
              <span style={{ fontSize:"28px" }}>{l.flag}</span>
              <div>
                <div style={{ fontWeight:"700", color:"var(--app-primary)", fontSize:"15px" }}>{l.label}</div>
              </div>
              {lang === l.code && <span style={{ marginLeft:"auto", color:"var(--app-primary)", fontSize:"18px" }}>✓</span>}
            </button>
          ))}
        </div>
        <button onClick={onClose} style={{
          width:"100%", background:"var(--app-primary)", border:"none", padding:"13px", borderRadius:"12px",
          color:"#fff", cursor:"pointer", fontWeight:"700", fontSize:"15px",
        }}>
          {t.language.save}
        </button>
      </div>
    </div>
  );
}
