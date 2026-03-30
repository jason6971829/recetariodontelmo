"use client";
import { sha256 } from "@/lib/security";
import { saveProfileConfig } from "@/lib/storage";

export function ProfileModal({
  show, isAdmin, onClose, t,
  profileData, setProfileData, profileDraft, setProfileDraft,
  profileSaved, setProfileSaved,
  profileHash, setProfileHash,
  profileNewPass, setProfileNewPass,
  profileNewPassConfirm, setProfileNewPassConfirm,
}) {
  if (!show || !isAdmin) return null;
  return (
    <div style={{ position:"fixed", inset:0, zIndex:9996, background:"rgba(10,15,25,0.85)", backdropFilter:"blur(8px)", display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
      <div style={{ background:"#fff", borderRadius:"20px", padding:"28px 24px", width:"100%", maxWidth:"420px", boxShadow:"0 30px 80px rgba(0,0,0,0.5)", maxHeight:"90vh", overflowY:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
            <span style={{ fontSize:"26px" }}>👤</span>
            <span style={{ fontWeight:"700", color:"var(--app-primary)", fontSize:"17px", fontFamily:"Georgia,serif" }}>{t.profile.title}</span>
          </div>
          <button onClick={() => { onClose(); setProfileSaved(false); }} style={{ background:"rgba(0,0,0,0.08)", border:"none", borderRadius:"8px", width:"32px", height:"32px", cursor:"pointer", fontSize:"16px" }}>×</button>
        </div>

        <div style={{ background:"linear-gradient(135deg,#1a3a1a,#2d5a2d)", borderRadius:"10px", padding:"10px 14px", marginBottom:"18px", display:"flex", alignItems:"center", gap:"10px" }}>
          <span style={{ fontSize:"20px" }}>🛡️</span>
          <div>
            <div style={{ color:"#7fff7f", fontSize:"11px", fontWeight:"700", letterSpacing:"1px" }}>ZONA PROTEGIDA</div>
            <div style={{ color:"rgba(255,255,255,0.7)", fontSize:"11px" }}>Sesión auto-cierra a los 20 min de inactividad</div>
          </div>
        </div>

        <div style={{ background:"#f0f7ff", border:"1px solid #c8dff5", borderRadius:"10px", padding:"10px 14px", marginBottom:"18px", fontSize:"12px", color:"#2c5f8a", display:"flex", gap:"8px", alignItems:"flex-start" }}>
          <span>ℹ️</span><span>{t.profile.info}</span>
        </div>

        <div style={{ marginBottom:"14px" }}>
          <label style={{ display:"block", fontSize:"11px", fontWeight:"700", color:"var(--app-primary)", letterSpacing:"1.5px", marginBottom:"6px" }}>{t.profile.nameLabel}</label>
          <input value={profileDraft.name} onChange={e => setProfileDraft(d => ({...d, name: e.target.value}))}
            placeholder={t.profile.namePlaceholder}
            style={{ width:"100%", padding:"12px 14px", border:"2px solid #E0D8CE", borderRadius:"10px", fontSize:"15px", outline:"none", boxSizing:"border-box" }} />
        </div>

        <div style={{ marginBottom:"14px" }}>
          <label style={{ display:"block", fontSize:"11px", fontWeight:"700", color:"var(--app-primary)", letterSpacing:"1.5px", marginBottom:"6px" }}>{t.profile.emailLabel}</label>
          <input type="email" value={profileDraft.email} onChange={e => setProfileDraft(d => ({...d, email: e.target.value}))}
            placeholder={t.profile.emailPlaceholder}
            style={{ width:"100%", padding:"12px 14px", border:"2px solid #E0D8CE", borderRadius:"10px", fontSize:"15px", outline:"none", boxSizing:"border-box" }} />
        </div>

        <div style={{ marginBottom:"20px" }}>
          <label style={{ display:"block", fontSize:"11px", fontWeight:"700", color:"var(--app-primary)", letterSpacing:"1.5px", marginBottom:"6px" }}>{t.profile.phoneLabel}</label>
          <input value={profileDraft.phone} onChange={e => setProfileDraft(d => ({...d, phone: e.target.value}))}
            placeholder={t.profile.phonePlaceholder}
            style={{ width:"100%", padding:"12px 14px", border:"2px solid #E0D8CE", borderRadius:"10px", fontSize:"15px", outline:"none", boxSizing:"border-box" }} />
        </div>

        <div style={{ borderTop:"1px solid #eee", paddingTop:"18px", marginBottom:"18px" }}>
          <div style={{ fontSize:"11px", fontWeight:"700", color:"var(--app-primary)", letterSpacing:"1.5px", marginBottom:"12px" }}>🔑 CAMBIAR CLAVE DE PERFIL</div>
          <input type="password" value={profileNewPass} onChange={e => setProfileNewPass(e.target.value)}
            placeholder="Nueva clave"
            style={{ width:"100%", padding:"12px 14px", border:"2px solid #E0D8CE", borderRadius:"10px", fontSize:"14px", outline:"none", boxSizing:"border-box", marginBottom:"8px" }} />
          <input type="password" value={profileNewPassConfirm} onChange={e => setProfileNewPassConfirm(e.target.value)}
            placeholder="Confirmar clave"
            style={{ width:"100%", padding:"12px 14px", border:"2px solid #E0D8CE", borderRadius:"10px", fontSize:"14px", outline:"none", boxSizing:"border-box" }} />
          {profileNewPass && profileNewPassConfirm && profileNewPass !== profileNewPassConfirm && (
            <div style={{ color:"#e74c3c", fontSize:"12px", marginTop:"6px" }}>⚠️ Las claves no coinciden</div>
          )}
        </div>

        {profileSaved && <div style={{ color:"#27ae60", fontWeight:"700", textAlign:"center", marginBottom:"12px", fontSize:"14px" }}>{t.profile.saved}</div>}

        <div style={{ display:"flex", gap:"10px" }}>
          <button onClick={() => { onClose(); setProfileSaved(false); }}
            style={{ flex:1, padding:"12px", background:"#F0ECE6", border:"none", borderRadius:"10px", cursor:"pointer", fontWeight:"600", color:"#5a3e2b", fontSize:"14px" }}>
            {t.profile.cancel}
          </button>
          <button onClick={async () => {
              let newHash = profileHash;
              if (profileNewPass) {
                if (profileNewPass !== profileNewPassConfirm) return;
                newHash = await sha256(profileNewPass.trim());
                setProfileHash(newHash);
              }
              const toSave = { ...profileDraft, profileHash: newHash };
              const saved = await saveProfileConfig(toSave);
              if (saved) {
                setProfileData(profileDraft);
                setProfileSaved(true);
                setTimeout(() => { setProfileSaved(false); onClose(); }, 1200);
              }
            }}
            style={{ flex:2, padding:"12px", background:"linear-gradient(135deg,var(--app-primary),var(--app-primary-dark))", border:"none", borderRadius:"10px", cursor:"pointer", fontWeight:"700", color:"#fff", fontSize:"14px" }}>
            {t.profile.save}
          </button>
        </div>
      </div>
    </div>
  );
}
