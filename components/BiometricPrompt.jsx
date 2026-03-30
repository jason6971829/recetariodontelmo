"use client";

export function BiometricPrompt({ show, onClose, onActivate }) {
  if (!show) return null;
  return (
    <div style={{ position:"fixed", inset:0, zIndex:500, background:"rgba(10,15,25,0.88)", backdropFilter:"blur(8px)", display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
      <div style={{ background:"#fff", borderRadius:"20px", padding:"32px 28px", width:"100%", maxWidth:"360px", textAlign:"center", boxShadow:"0 30px 80px rgba(0,0,0,0.5)" }}>
        <div style={{ fontSize:"48px", marginBottom:"16px" }}>🔐</div>
        <div style={{ color:"var(--app-primary)", fontSize:"18px", fontWeight:"700", fontFamily:"Georgia,serif", marginBottom:"8px" }}>
          Acceso Biométrico
        </div>
        <div style={{ color:"#666", fontSize:"13px", lineHeight:"1.6", marginBottom:"24px" }}>
          ¿Deseas activar el acceso con Face ID o huella dactilar para iniciar sesión más rápido?
        </div>
        <button
          onClick={onActivate}
          style={{
            width:"100%", padding:"14px",
            background:"linear-gradient(135deg,#27ae60,#1e8449)",
            border:"none", borderRadius:"10px", color:"#fff",
            fontSize:"15px", fontWeight:"700", cursor:"pointer",
            fontFamily:"Georgia,serif", marginBottom:"10px"
          }}
        >
          ✅ Sí, activar
        </button>
        <button
          onClick={onClose}
          style={{
            width:"100%", padding:"12px",
            background:"#F0ECE6", border:"none", borderRadius:"10px",
            color:"#5a3e2b", fontSize:"14px", fontWeight:"600", cursor:"pointer"
          }}
        >
          Ahora no
        </button>
      </div>
    </div>
  );
}
