"use client";
import { sha256 } from "@/lib/security";

export function ProfileGuardModal({
  show, isAdmin, onClose,
  profileHash, profileData, setProfileDraft, setProfileNewPass, setProfileNewPassConfirm,
  guardInput, setGuardInput, guardError, setGuardError,
  guardAttempts, setGuardAttempts, guardLocked, setGuardLocked, guardLockRef,
  onUnlock,
}) {
  if (!show || !isAdmin) return null;

  const verify = async (input) => {
    const hash = await sha256(input.trim());
    if (hash === profileHash) {
      setGuardInput("");
      setGuardError("");
      setGuardAttempts(0);
      setProfileDraft({ ...profileData });
      setProfileNewPass("");
      setProfileNewPassConfirm("");
      onUnlock();
    } else {
      const att = guardAttempts + 1;
      setGuardAttempts(att);
      if (att >= 3) {
        setGuardLocked(true);
        clearTimeout(guardLockRef.current);
        guardLockRef.current = setTimeout(() => { setGuardLocked(false); setGuardAttempts(0); }, 120_000);
      }
      setGuardError(`Clave incorrecta. ${3 - att > 0 ? `${3 - att} intento${3-att!==1?"s":""} restante${3-att!==1?"s":""}` : ""}`);
      setGuardInput("");
    }
  };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:9997, background:"rgba(5,10,20,0.92)", backdropFilter:"blur(12px)", display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
      <div style={{ background:"#fff", borderRadius:"24px", padding:"36px 28px", width:"100%", maxWidth:"360px", boxShadow:"0 40px 100px rgba(0,0,0,0.7)", textAlign:"center" }}>
        <div style={{ fontSize:"48px", marginBottom:"8px" }}>🔐</div>
        <div style={{ fontWeight:"700", fontSize:"18px", color:"var(--app-primary)", fontFamily:"Georgia,serif", marginBottom:"6px" }}>Zona Segura</div>
        <div style={{ color:"#888", fontSize:"13px", marginBottom:"24px" }}>Ingresa la clave de perfil para continuar</div>

        {guardLocked ? (
          <div style={{ background:"#fff5f5", border:"2px solid #e74c3c", borderRadius:"12px", padding:"16px", marginBottom:"16px" }}>
            <div style={{ color:"#c0392b", fontWeight:"700" }}>🚫 Bloqueado temporalmente</div>
            <div style={{ color:"#888", fontSize:"12px", marginTop:"4px" }}>Espera 2 minutos antes de intentar de nuevo</div>
          </div>
        ) : (
          <>
            <input
              type="password"
              value={guardInput}
              onChange={e => { setGuardInput(e.target.value); setGuardError(""); }}
              onKeyDown={e => { if (e.key === "Enter") verify(guardInput); }}
              placeholder="••••••••"
              autoFocus
              style={{ width:"100%", padding:"14px", border:"2px solid #E0D8CE", borderRadius:"12px", fontSize:"20px", outline:"none", boxSizing:"border-box", textAlign:"center", letterSpacing:"6px", marginBottom:"10px" }}
            />
            {guardError && <div style={{ color:"#e74c3c", fontSize:"13px", marginBottom:"10px", background:"#fef0ef", padding:"8px 12px", borderRadius:"8px" }}>{guardError}</div>}
            <button
              onClick={() => verify(guardInput)}
              style={{ width:"100%", padding:"13px", background:"linear-gradient(135deg,var(--app-primary),var(--app-primary-dark))", border:"none", borderRadius:"12px", color:"#fff", fontWeight:"700", fontSize:"15px", cursor:"pointer", marginBottom:"10px" }}>
              Verificar
            </button>
          </>
        )}
        <button onClick={onClose}
          style={{ width:"100%", padding:"12px", background:"#f5f0eb", border:"none", borderRadius:"12px", color:"#888", fontWeight:"600", fontSize:"14px", cursor:"pointer" }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
